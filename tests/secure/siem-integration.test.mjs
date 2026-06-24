import test from "node:test";
import assert from "node:assert/strict";

import { createDecisionTraceRecord } from "../../src/govern/enforcement/audit-trace.mjs";
import { evaluateOvershareEnforcement } from "../../src/secure/overshare/overshare-detection.mjs";
import {
  buildGovernanceDecisionSiemEvent,
  buildIncidentPlaybookCatalog,
  buildIncidentRoutingPlan,
  buildOvershareEnforcementSiemEvent,
  buildOvershareIncidentSiemEvent,
  buildSiemConnectorRegistration,
  resolveSiemRoute,
  summarizeSiemReadiness,
} from "../../src/secure/siem/siem-integration.mjs";

test("siem connector registration supports Sentinel metadata", () => {
  const connector = buildSiemConnectorRegistration({
    connectorId: "sentinel-prod",
    tenantId: "tenant-001",
    platform: "sentinel",
    owner: "secops@frontieriq.local",
    destinationName: "FrontierIQ Sentinel",
    workspaceId: "ws-001",
    workspaceName: "frontieriq-sentinel",
  });

  assert.equal(connector.platform, "sentinel");
  assert.equal(connector.destination.workspaceId, "ws-001");
  assert.deepEqual(connector.supportedEventKinds, [
    "governance-decision",
    "overshare-enforcement",
    "overshare-incident",
  ]);
});

test("governance decision events stay audit-only for allow and incident for deny", () => {
  const allowEvent = buildGovernanceDecisionSiemEvent({
    trace: createDecisionTraceRecord({
      tenantId: "tenant-001",
      solutionId: "m365-copilot",
      principalId: "user-001",
      actionType: "query-kb",
      resourceId: "kb-001",
      decision: "allow",
      reasons: ["All required controls passed."],
      enforcedControls: ["audit.traceability"],
      evaluatedAt: "2026-06-24T12:00:00Z",
      metadata: { riskBand: "low" },
    }),
  });
  const denyEvent = buildGovernanceDecisionSiemEvent({
    trace: createDecisionTraceRecord({
      tenantId: "tenant-001",
      solutionId: "m365-copilot",
      principalId: "app-001",
      actionType: "deploy-agent",
      resourceId: "agent-001",
      decision: "deny",
      reasons: ["Audit traceability is not enabled."],
      enforcedControls: ["audit.traceability", "data.residency-enforcement"],
      evaluatedAt: "2026-06-24T12:01:00Z",
      metadata: { riskBand: "high", permissionName: "Sites.Read.All" },
    }),
  });

  assert.equal(allowEvent.deliveryKind, "audit");
  assert.equal(allowEvent.recommendedPlaybookId, null);
  assert.equal(denyEvent.deliveryKind, "incident");
  assert.equal(denyEvent.recommendedPlaybookId, "access-revocation");
  assert.equal(denyEvent.severity, "high");
});

test("overshare incident and enforcement events split containment from revocation", () => {
  const incident = {
    assessmentId: "incident-critical",
    tenantId: "tenant-001",
    solutionId: "m365-copilot",
    stage: "query",
    severity: "critical",
    riskScore: 92,
    reasonCodes: ["query_hit_pii_exposed", "deny_precedence_lost"],
    controlIds: ["data.pii-detection-redaction", "access.least-privilege"],
    evidenceArtifacts: ["evidence/overshare-incidents.ndjson"],
    actualExposure: true,
    generatedAt: "2026-06-24T12:02:00Z",
  };
  const decision = evaluateOvershareEnforcement({
    incident,
    priorState: "throttled",
    recurrenceCount: 2,
  });

  const incidentEvent = buildOvershareIncidentSiemEvent({ incident });
  const enforcementEvent = buildOvershareEnforcementSiemEvent({ incident, decision });

  assert.equal(incidentEvent.eventKind, "overshare-incident");
  assert.equal(incidentEvent.recommendedPlaybookId, "risk-containment");
  assert.equal(enforcementEvent.eventKind, "overshare-enforcement");
  assert.equal(enforcementEvent.outcome, "suspend");
  assert.equal(enforcementEvent.recommendedPlaybookId, "access-revocation");
  assert.ok(enforcementEvent.evidenceArtifacts.includes("evidence/overshare-enforcement-decisions.ndjson"));
});

test("routing plan resolves outcome-specific routes and closed-loop readiness", () => {
  const connector = buildSiemConnectorRegistration({
    connectorId: "sentinel-prod",
    tenantId: "tenant-001",
    platform: "sentinel",
    owner: "secops@frontieriq.local",
    destinationName: "FrontierIQ Sentinel",
    workspaceId: "ws-001",
    workspaceName: "frontieriq-sentinel",
  });
  const routingPlan = buildIncidentRoutingPlan({
    routingId: "routing-001",
    tenantId: "tenant-001",
    routes: [
      {
        routeId: "gov-audit",
        eventKind: "governance-decision",
        deliveryKind: "audit",
        minimumSeverity: "low",
        targetQueue: "audit-log",
        destination: "sentinel-audit",
        outcomes: ["allow"],
      },
      {
        routeId: "gov-containment",
        eventKind: "governance-decision",
        deliveryKind: "incident",
        minimumSeverity: "medium",
        targetQueue: "soc-tier2",
        destination: "sentinel-incidents",
        outcomes: ["require_approval"],
        playbookId: "risk-containment",
      },
      {
        routeId: "gov-revoke",
        eventKind: "governance-decision",
        deliveryKind: "incident",
        minimumSeverity: "high",
        targetQueue: "soc-tier3",
        destination: "sentinel-incidents",
        outcomes: ["deny"],
        playbookId: "access-revocation",
      },
      {
        routeId: "overshare-incident",
        eventKind: "overshare-incident",
        deliveryKind: "incident",
        minimumSeverity: "medium",
        targetQueue: "soc-tier2",
        destination: "sentinel-incidents",
        playbookId: "risk-containment",
      },
      {
        routeId: "overshare-enforcement-audit",
        eventKind: "overshare-enforcement",
        deliveryKind: "audit",
        minimumSeverity: "low",
        targetQueue: "audit-log",
        destination: "sentinel-audit",
        outcomes: ["allow", "warn"],
      },
      {
        routeId: "overshare-enforcement-incident",
        eventKind: "overshare-enforcement",
        deliveryKind: "incident",
        minimumSeverity: "medium",
        targetQueue: "soc-tier3",
        destination: "sentinel-incidents",
        outcomes: ["review", "throttle", "suspend"],
        playbookId: "risk-containment",
      },
    ],
  });
  const playbookCatalog = buildIncidentPlaybookCatalog();
  const approvalEvent = buildGovernanceDecisionSiemEvent({
    trace: createDecisionTraceRecord({
      tenantId: "tenant-001",
      solutionId: "m365-copilot",
      principalId: "app-002",
      actionType: "deploy-agent",
      resourceId: "agent-002",
      decision: "require_approval",
      reasons: ["High-risk request requires approval ticket."],
      enforcedControls: ["governance.approval-gates"],
      evaluatedAt: "2026-06-24T12:10:00Z",
      metadata: { riskBand: "high" },
    }),
  });
  const incident = {
    assessmentId: "incident-high",
    tenantId: "tenant-001",
    solutionId: "m365-copilot",
    stage: "query",
    severity: "high",
    riskScore: 72,
    reasonCodes: ["query_hit_pii_exposed", "source_acl_drift_exposed"],
    controlIds: ["data.pii-detection-redaction", "access.least-privilege"],
    evidenceArtifacts: ["evidence/overshare-incidents.ndjson"],
    actualExposure: true,
    generatedAt: "2026-06-24T12:12:00Z",
  };
  const enforcementDecision = evaluateOvershareEnforcement({
    incident,
    priorState: "warned",
    recurrenceCount: 0,
  });
  const enforcementEvent = buildOvershareEnforcementSiemEvent({
    incident,
    decision: enforcementDecision,
  });
  const allowEvent = buildGovernanceDecisionSiemEvent({
    trace: createDecisionTraceRecord({
      tenantId: "tenant-001",
      solutionId: "m365-copilot",
      principalId: "user-001",
      actionType: "query-kb",
      resourceId: "kb-001",
      decision: "allow",
      reasons: ["All required controls passed."],
      enforcedControls: ["audit.traceability"],
      evaluatedAt: "2026-06-24T12:09:00Z",
      metadata: { riskBand: "low" },
    }),
  });
  const incidentEvent = buildOvershareIncidentSiemEvent({ incident });

  assert.equal(resolveSiemRoute(routingPlan, allowEvent)?.routeId, "gov-audit");
  assert.equal(resolveSiemRoute(routingPlan, approvalEvent)?.routeId, "gov-containment");
  assert.equal(resolveSiemRoute(routingPlan, enforcementEvent)?.routeId, "overshare-enforcement-incident");

  const readiness = summarizeSiemReadiness({
    connector,
    routingPlan,
    playbookCatalog,
    sampleEvents: [allowEvent, approvalEvent, incidentEvent, enforcementEvent],
  });

  assert.equal(readiness.ready, true);
  assert.equal(readiness.blockedChecks.length, 0);
  assert.ok(readiness.eventKindCoverage.every((entry) => entry.covered));
  assert.ok(readiness.sampleCoverage.every((entry) => entry.covered));
});

test("readiness fails closed when a produced event lacks route coverage", () => {
  const connector = buildSiemConnectorRegistration({
    connectorId: "sentinel-prod",
    tenantId: "tenant-001",
    platform: "sentinel",
    owner: "secops@frontieriq.local",
    destinationName: "FrontierIQ Sentinel",
    workspaceId: "ws-001",
    workspaceName: "frontieriq-sentinel",
  });
  const routingPlan = buildIncidentRoutingPlan({
    routingId: "routing-broken",
    tenantId: "tenant-001",
    routes: [
      {
        routeId: "gov-audit",
        eventKind: "governance-decision",
        deliveryKind: "audit",
        minimumSeverity: "low",
        targetQueue: "audit-log",
        destination: "sentinel-audit",
        outcomes: ["allow"],
      },
      {
        routeId: "overshare-incident",
        eventKind: "overshare-incident",
        deliveryKind: "incident",
        minimumSeverity: "medium",
        targetQueue: "soc-tier2",
        destination: "sentinel-incidents",
        playbookId: "risk-containment",
      },
    ],
  });
  const playbookCatalog = buildIncidentPlaybookCatalog();
  const enforcementEvent = buildOvershareEnforcementSiemEvent({
    incident: {
      assessmentId: "incident-high",
      tenantId: "tenant-001",
      solutionId: "m365-copilot",
      stage: "query",
      severity: "high",
      evidenceArtifacts: ["evidence/overshare-incidents.ndjson"],
      controlIds: ["data.pii-detection-redaction"],
    },
    decision: {
      decisionId: "decision-001",
      incidentId: "incident-high",
      recommendedAction: "throttle",
      nextState: "throttled",
      reviewRequired: true,
      controlIds: ["data.pii-detection-redaction"],
      evidenceArtifacts: ["evidence/overshare-enforcement-decisions.ndjson"],
      reasonCodes: ["throttle_recommended"],
    },
  });

  const readiness = summarizeSiemReadiness({
    connector,
    routingPlan,
    playbookCatalog,
    sampleEvents: [enforcementEvent],
  });

  assert.equal(readiness.ready, false);
  assert.ok(readiness.blockedChecks.includes("missing-route-or-connector-support:overshare-enforcement"));
  assert.ok(readiness.blockedChecks.includes("unrouted-sample:overshare-enforcement:throttle"));
});
