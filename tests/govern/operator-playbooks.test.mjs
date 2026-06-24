import test from "node:test";
import assert from "node:assert/strict";

import { createDecisionTraceRecord } from "../../src/govern/enforcement/audit-trace.mjs";
import {
  buildTenantOnboardingBundle,
  validateTenantOnboardingRequest,
} from "../../src/govern/onboarding/tenant-onboarding.mjs";
import {
  buildIncidentPlaybookCatalog,
  buildIncidentRoutingPlan,
  buildGovernanceDecisionSiemEvent,
  resolveSiemRoute,
} from "../../src/secure/siem/siem-integration.mjs";
import {
  buildIncidentResponseRunbookExecution,
  buildIndexRehydrationRunbookExecution,
  buildOnboardingRunbookExecution,
  buildOperatorPlaybookCatalog,
  buildTenantSuspendRevokeRunbookExecution,
  buildTokenRotationRunbookExecution,
  summarizeOperatorPlaybookReadiness,
  validateOperatorPlaybookCatalog,
} from "../../src/govern/operations/operator-playbooks.mjs";

function createValidatedOnboardingRequest() {
  const validation = validateTenantOnboardingRequest({
    tenantId: "contoso.onmicrosoft.com",
    appDisplayName: "FrontierIQ Contoso",
    redirectUri: "https://frontieriq.example.com/callback",
    environment: "prod",
    location: "northeurope",
    dataBoundary: "EU",
    owners: ["owner-a"],
    credentialStrategy: {
      type: "clientSecret",
      secretName: "frontieriq-client-secret",
      expiryDays: 180,
      rotationDays: 30,
    },
    permissions: [
      {
        resourceAppId: "00000003-0000-0000-c000-000000000000",
        resourceName: "Microsoft Graph",
        appRoles: ["Reports.Read.All"],
      },
    ],
    resources: [
      {
        type: "Microsoft.KeyVault/vaults",
        name: "kv-frontieriq",
        provisioningMode: "create",
        apiProfile: "2023-07-01",
        location: "northeurope",
      },
      {
        type: "Microsoft.Storage/storageAccounts",
        name: "stfrontieriq",
        provisioningMode: "create",
        apiProfile: "2023-01-01",
        location: "northeurope",
      },
    ],
    keyVault: {
      vaultName: "kv-frontieriq",
      provisioningMode: "create",
      secretTypes: ["clientSecret"],
    },
  });
  assert.equal(validation.ok, true);
  return validation.value;
}

test("operator playbook catalog includes all required workflow types", () => {
  const catalog = buildOperatorPlaybookCatalog();
  const validation = validateOperatorPlaybookCatalog(catalog);

  assert.equal(validation.ok, true);
  assert.equal(catalog.playbooks.length, 5);
});

test("onboarding runbook execution uses onboarding bundle scripts and readiness", () => {
  const bundle = buildTenantOnboardingBundle(createValidatedOnboardingRequest());
  const runbook = buildOnboardingRunbookExecution({
    tenantOnboardingBundle: bundle,
  });

  assert.equal(runbook.workflowType, "onboarding");
  assert.equal(runbook.status, "ready");
  assert.equal(runbook.automationSteps.length, 4);
});

test("incident response runbook resolves queue and typed response steps", () => {
  const event = buildGovernanceDecisionSiemEvent({
    trace: createDecisionTraceRecord({
      tenantId: "tenant-a",
      solutionId: "m365-copilot",
      principalId: "principal-1",
      actionType: "deploy-agent",
      resourceId: "agent-1",
      decision: "deny",
      reasons: ["Audit traceability is not enabled."],
      enforcedControls: ["audit.traceability"],
      evaluatedAt: "2026-06-24T12:00:00Z",
      metadata: { riskBand: "high" },
    }),
  });
  const routing = buildIncidentRoutingPlan({
    routingId: "routing-1",
    tenantId: "tenant-a",
    routes: [
      {
        routeId: "deny-route",
        eventKind: "governance-decision",
        deliveryKind: "incident",
        minimumSeverity: "high",
        targetQueue: "soc-tier3",
        destination: "sentinel-incidents",
        outcomes: ["deny"],
        playbookId: "access-revocation",
      },
    ],
  });
  const route = resolveSiemRoute(routing, event);
  const runbook = buildIncidentResponseRunbookExecution({
    siemEvent: event,
    siemRoute: route,
    incidentPlaybookCatalog: buildIncidentPlaybookCatalog(),
  });

  assert.equal(runbook.status, "ready");
  assert.equal(runbook.escalation.targetQueue, "soc-tier3");
  assert.ok(runbook.responseSteps.some((step) => step.actionType === "disable-principal"));
});

test("token rotation marks overdue secrets for rotation", () => {
  const runbook = buildTokenRotationRunbookExecution({
    keyVaultManifest: {
      vaultName: "kv-frontieriq",
      rotationDays: 30,
      secrets: [
        { name: "frontieriq-client-secret", kind: "clientSecret" },
        { name: "frontieriq-signing-cert", kind: "certificate" },
      ],
    },
    secretStates: [
      { name: "frontieriq-client-secret", lastRotatedAt: "2026-05-01T00:00:00Z" },
      { name: "frontieriq-signing-cert", lastRotatedAt: "2026-06-20T00:00:00Z" },
    ],
    asOfIso: "2026-06-24T00:00:00Z",
  });

  assert.equal(runbook.status, "ready");
  assert.equal(runbook.dueSecrets.length, 1);
  assert.equal(runbook.dueSecrets[0].name, "frontieriq-client-secret");
});

test("index rehydration runbook escalates to full mode on blocked readiness", () => {
  const runbook = buildIndexRehydrationRunbookExecution({
    connectorReadiness: {
      aclSyncReady: { status: "blocked", reasonCodes: ["acl_drift"] },
      purviewEnforcementReady: { status: "ready", reasonCodes: [] },
    },
    indexingJob: {
      jobId: "job-1",
      sourceArtifactIds: ["artifact-1"],
    },
    runtimeTelemetry: {
      counters: { failureCount: 2 },
    },
  });

  assert.equal(runbook.status, "blocked");
  assert.equal(runbook.rehydrationMode, "full");
  assert.ok(runbook.failedChecks.includes("aclSyncReady"));
});

test("tenant suspend and revoke runbook uses lifecycle transitions", () => {
  const runbook = buildTenantSuspendRevokeRunbookExecution({
    tenantId: "tenant-a",
    currentLifecycleState: "production",
    trigger: {
      source: "overshare-enforcement",
      outcome: "suspend",
      principalId: "principal-1",
      reasonCodes: ["suspension_recommended"],
    },
  });

  assert.equal(runbook.status, "ready");
  assert.equal(runbook.lifecycleChanges.suspendTransition.to, "deprecated");
  assert.equal(runbook.lifecycleChanges.revokeTransition.to, "archived");
});

test("operator playbook readiness fails closed when catalog coverage is incomplete", () => {
  const catalog = buildOperatorPlaybookCatalog();
  catalog.playbooks = catalog.playbooks.filter((item) => item.workflowType !== "token-rotation");

  const readiness = summarizeOperatorPlaybookReadiness({
    catalog,
    onboarding: { status: "ready", failedChecks: [] },
    incidentResponse: { status: "ready", failedChecks: [] },
    tokenRotation: { status: "ready", failedChecks: [] },
    indexRehydration: { status: "ready", failedChecks: [] },
    tenantSuspendRevoke: { status: "ready", failedChecks: [] },
  });

  assert.equal(readiness.overallStatus, "blocked");
  assert.ok(readiness.failedChecks.includes("missing workflow playbook: token-rotation"));
});

