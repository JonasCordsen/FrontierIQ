import test from "node:test";
import assert from "node:assert/strict";

import {
  buildOnboardingWorkflowPlan,
  evaluateOnboardingWorkflowCheckpoints,
  summarizeOnboardingWorkflowOutcome,
} from "../../src/govern/onboarding/tenant-onboarding-workflow-contract.mjs";

function createRequest(overrides = {}) {
  return {
    tenantId: "contoso.onmicrosoft.com",
    appDisplayName: "FrontierIQ Governance",
    redirectUri: "https://frontieriq.example.com/auth/callback",
    environment: "prod",
    location: "swedencentral",
    dataBoundary: "EU Data Boundary",
    approvalTicket: "ADO-1000",
    owners: ["securityRepresentative", "coeLead"],
    credentialStrategy: {
      type: "clientSecret",
      secretName: "frontieriq-client-secret",
      rotationDays: 30,
      expiryDays: 90,
    },
    permissions: [
      {
        resourceAppId: "00000003-0000-0000-c000-000000000000",
        resourceName: "Microsoft Graph",
        appRoles: ["Reports.Read.All", "User.Read.All"],
      },
    ],
    resources: [
      {
        type: "Microsoft.KeyVault/vaults",
        name: "contoso-frontieriq-kv",
        provisioningMode: "create",
        apiProfile: "2023-07-01",
        location: "swedencentral",
      },
      {
        type: "Microsoft.Storage/storageAccounts",
        name: "contosofrontieriqraw",
        provisioningMode: "create",
        apiProfile: "2023-05-01",
        location: "swedencentral",
      },
    ],
    keyVault: {
      vaultName: "contoso-frontieriq-kv",
      provisioningMode: "create",
      secretTypes: ["clientSecret"],
    },
    ...overrides,
  };
}

test("builds ready workflow plan for valid request", () => {
  const result = buildOnboardingWorkflowPlan(createRequest(), "2026-01-01T00:00:00.000Z");
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.plan.overallStatus, "ready");
  assert.equal(result.plan.checkpointIds.length, 4);
});

test("blocks workflow plan when high-risk permission misses approval ticket", () => {
  const result = buildOnboardingWorkflowPlan(
    createRequest({
      approvalTicket: undefined,
      permissions: [
        {
          resourceAppId: "00000003-0000-0000-c000-000000000000",
          resourceName: "Microsoft Graph",
          appRoles: ["Application.ReadWrite.All"],
        },
      ],
    })
  );
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.reason, "invalid_request");
  assert.ok(result.errors.some((error) => error.includes("approvalTicket")));
});

test("evaluates workflow execution and detects unknown checkpoint ids", () => {
  const planResult = buildOnboardingWorkflowPlan(createRequest());
  assert.equal(planResult.ok, true);
  if (!planResult.ok) return;

  const evaluation = evaluateOnboardingWorkflowCheckpoints(planResult.plan, [
    { checkpointId: "validate-request", status: "completed" },
    { checkpointId: "approval-gate", status: "completed" },
    { checkpointId: "provisioning-bundle", status: "completed" },
    { checkpointId: "unknown", status: "completed" },
  ]);

  assert.equal(evaluation.overallStatus, "blocked");
  assert.ok(evaluation.failedCheckpoints.includes("unknown-checkpoint:unknown"));
});

test("summarizes onboarding workflow outcome counts", () => {
  const planResult = buildOnboardingWorkflowPlan(createRequest());
  assert.equal(planResult.ok, true);
  if (!planResult.ok) return;

  const evaluation = evaluateOnboardingWorkflowCheckpoints(planResult.plan, [
    { checkpointId: "validate-request", status: "completed" },
    { checkpointId: "approval-gate", status: "completed" },
    { checkpointId: "provisioning-bundle", status: "completed" },
    { checkpointId: "evidence-bundle", status: "completed" },
  ]);
  const summary = summarizeOnboardingWorkflowOutcome(planResult.plan, evaluation);
  assert.equal(summary.overallStatus, "completed");
  assert.equal(summary.readyForActivation, true);
  assert.equal(summary.counts.completed, 4);
});
