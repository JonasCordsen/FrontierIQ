import test from "node:test";
import assert from "node:assert/strict";

import { createNormalizedSignal, summarizeSignalFreshness } from "../../src/observe/foundation/normalized-signal.mjs";
import { buildAgentSkillRegistry, summarizeAgentInvocations } from "../../src/observe/registry/agent-skill-registry.mjs";
import { summarizeIngestionRuntime } from "../../src/observe/ingestion/runtime-pipeline.mjs";
import { summarizeSiemReadiness } from "../../src/secure/siem/siem-integration.mjs";
import { buildCostValueSummary } from "../../src/optimize/model/cost-value-model.mjs";
import { summarizeLicenseUtilization } from "../../src/optimize/model/license-utilization.mjs";
import { buildScenarioPortfolioSummary, initializeUseCaseTracker, updateUseCaseTracker } from "../../src/optimize/planning/scenario-usecase-management.mjs";
import {
  buildDashboardApiPayload,
  buildOperationsDashboard,
  buildValueDashboard,
  summarizeIngestionOperations,
  summarizeOvershareMetrics,
  validateDashboardApiPayload,
} from "../../src/optimize/reporting/metrics-dashboards.mjs";

const signals = [
  createNormalizedSignal({
    tenantId: "tenant-a",
    solutionId: "m365-copilot",
    workload: "work-iq",
    resourceId: "resource-1",
    source: "graph",
    timestamp: "2026-06-24T10:00:00Z",
    signalType: "copilot-usage",
    severity: "info",
    confidence: 0.98,
    freshnessMinutes: 0,
    dimensions: { region: "northeurope" },
    evidence: { endpoint: "reports" },
  }),
  createNormalizedSignal({
    tenantId: "tenant-a",
    solutionId: "m365-copilot",
    workload: "work-iq",
    resourceId: "resource-2",
    source: "graph",
    timestamp: "2026-06-24T10:30:00Z",
    signalType: "copilot-usage",
    severity: "info",
    confidence: 0.92,
    freshnessMinutes: 30,
    dimensions: { region: "northeurope" },
    evidence: { endpoint: "reports" },
  }),
  createNormalizedSignal({
    tenantId: "tenant-a",
    solutionId: "fabric",
    workload: "fabric-iq",
    resourceId: "resource-3",
    source: "fabric",
    timestamp: "2026-06-24T11:30:00Z",
    signalType: "index-freshness",
    severity: "medium",
    confidence: 0.88,
    freshnessMinutes: 90,
    dimensions: { region: "westeurope" },
    evidence: { endpoint: "capacityMetrics" },
  }),
];

const registry = buildAgentSkillRegistry([
  {
    agentId: "work-iq-1",
    name: "Work IQ",
    owner: "work-owner",
    solutionId: "m365-copilot",
    riskBand: "medium",
    lastAttestedAt: "2026-06-24T10:00:00Z",
    skills: [
      {
        skillId: "work-iq-ask",
        name: "WorkIQAgent.Ask",
        permissionScopes: ["Mail.Read"],
        status: "approved",
      },
    ],
  },
  {
    agentId: "fabric-iq-1",
    name: "Fabric IQ",
    owner: "data-owner",
    solutionId: "fabric",
    riskBand: "medium",
    lastAttestedAt: "2026-06-24T10:05:00Z",
    skills: [
      {
        skillId: "fabric-iq-query",
        name: "Fabric.Query",
        permissionScopes: ["Workspace.Read.All"],
        status: "approved",
      },
    ],
  },
]);

function createRuntime(overrides = {}) {
  return summarizeIngestionRuntime({
    scope: {
      tenantId: "tenant-a",
      businessUnit: "it",
      environment: "prod",
      sourceSystem: "microsoft-graph",
      connectionId: "conn-1",
    },
    trigger: {
      tenantId: "tenant-a",
      businessUnit: "it",
      environment: "prod",
      sourceSystem: "microsoft-graph",
      connectionId: "conn-1",
      triggerType: "reconcile",
      receivedAt: "2026-06-24T12:00:00Z",
      correlationId: "corr-1",
      subscriptionId: null,
      eventId: null,
      cursorType: "deltaLink",
      cursorValue: "delta-1",
      payloadRef: null,
      idempotencyKey: "tenant-a|conn-1|deltaLink|delta-1",
    },
    startedAt: "2026-06-24T12:00:01Z",
    completedAt: "2026-06-24T12:00:04Z",
    apiCalls: 2,
    handoffBatches: [{ byteCount: 100, documentCount: 4 }],
    customMetrics: { recordsObserved: 4 },
    ...overrides,
  });
}

test("signal freshness summary marks stale signals against threshold", () => {
  const summary = summarizeSignalFreshness(signals, { staleAfterMinutes: 60 });

  assert.equal(summary.totalSignals, 3);
  assert.equal(summary.staleCount, 1);
  assert.equal(summary.freshCount, 2);
  assert.equal(summary.averageFreshnessMinutes, 40);
  assert.equal(summary.byWorkload["fabric-iq"].staleCount, 1);
});

test("license utilization handles zero denominators and computes rates", () => {
  const summary = summarizeLicenseUtilization([
    {
      timestamp: "2026-06-24T12:00:00Z",
      tenantId: "tenant-a",
      solutionId: "m365-copilot",
      workload: "work-iq",
      businessUnit: "it",
      assignedSeats: 100,
      activeSeats: 70,
      provisionedSeats: 120,
    },
    {
      timestamp: "2026-06-24T12:00:00Z",
      tenantId: "tenant-b",
      solutionId: "fabric",
      workload: "fabric-iq",
      businessUnit: "finance",
      assignedSeats: 0,
      activeSeats: 0,
      provisionedSeats: 10,
    },
  ]);

  assert.equal(summary.totals.assignedSeats, 100);
  assert.equal(summary.totals.activeSeats, 70);
  assert.equal(summary.totals.provisionedSeats, 130);
  assert.equal(summary.totals.utilizationRate, 0.7);
  assert.equal(summary.byWorkload["fabric-iq"].utilizationRate, 0);
});

test("agent invocation summary computes totals and failure rate", () => {
  const summary = summarizeAgentInvocations({
    registry,
    invocations: [
      {
        agentId: "work-iq-1",
        skillId: "work-iq-ask",
        tenantId: "tenant-a",
        timestamp: "2026-06-24T12:00:00Z",
        status: "success",
        count: 40,
      },
      {
        agentId: "fabric-iq-1",
        skillId: "fabric-iq-query",
        tenantId: "tenant-a",
        timestamp: "2026-06-24T12:00:00Z",
        status: "failure",
        count: 5,
      },
      {
        agentId: "fabric-iq-1",
        skillId: "fabric-iq-query",
        tenantId: "tenant-a",
        timestamp: "2026-06-24T12:10:00Z",
        status: "throttled",
        count: 3,
      },
    ],
  });

  assert.equal(summary.totals.totalInvocations, 48);
  assert.equal(summary.totals.failureInvocations, 5);
  assert.equal(summary.totals.throttledInvocations, 3);
  assert.equal(summary.totals.failureRate, 0.1042);
  assert.equal(summary.byAgent["fabric-iq-1"].totalInvocations, 8);
});

test("operations dashboard surfaces blocked readiness and critical exposure", () => {
  const signalFreshness = summarizeSignalFreshness(signals, { staleAfterMinutes: 60 });
  const agentInvocations = summarizeAgentInvocations({
    registry,
    invocations: [
      {
        agentId: "work-iq-1",
        skillId: "work-iq-ask",
        tenantId: "tenant-a",
        timestamp: "2026-06-24T12:00:00Z",
        status: "success",
        count: 20,
      },
    ],
  });
  const overshareMetrics = summarizeOvershareMetrics({
    incidents: [
      { severity: "critical", stage: "query", actualExposure: true },
      { severity: "medium", stage: "ingestion", actualExposure: false },
    ],
    enforcementDecisions: [
      { recommendedAction: "suspend" },
      { recommendedAction: "throttle" },
    ],
  });
  const connectorReadiness = {
    aclSyncReady: { status: "blocked", reasonCodes: ["acl_drift"] },
    queryReady: { status: "ready", reasonCodes: [] },
  };
  const iqReadinessSummaries = [
    {
      workload: "work-iq",
      checks: {
        consentReady: { status: "ready", reasonCodes: [] },
      },
    },
  ];
  const siemReadiness = summarizeSiemReadiness({
    connector: {
      connectorId: "sentinel-prod",
      tenantId: "tenant-a",
      platform: "sentinel",
      owner: "secops@frontieriq.local",
      destinationName: "FrontierIQ Sentinel",
      workspaceId: "ws-001",
      workspaceName: "frontieriq-sentinel",
    },
    routingPlan: {
      routingId: "routing-1",
      tenantId: "tenant-a",
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
      ],
    },
    playbookCatalog: {
      playbooks: [
        {
          playbookId: "risk-containment",
          supportedEventKinds: ["overshare-incident"],
          supportedOutcomes: ["exposed"],
        },
      ],
    },
    sampleEvents: [
      {
        eventId: "ev-1",
        eventKind: "overshare-incident",
        outcome: "exposed",
        severity: "critical",
        deliveryKind: "incident",
      },
    ],
  });
  const dashboard = buildOperationsDashboard({
    signalFreshness,
    runtimes: [createRuntime(), createRuntime({ completedAt: "2026-06-24T12:00:06Z" })],
    connectorReadiness,
    iqReadinessSummaries,
    siemReadiness,
    overshareMetrics,
    agentInvocations,
  });

  assert.equal(dashboard.ingestionLag.p95Ms, 6000);
  assert.equal(dashboard.readiness.blockedSurfaceCount, 2);
  assert.equal(dashboard.overshare.criticalExposures, 1);
  assert.equal(dashboard.health, "critical");
});

test("value dashboard and API payload validate computed KPI fields", () => {
  const costSummary = buildCostValueSummary([
    {
      timestamp: "2026-06-24T12:00:00Z",
      tenantId: "tenant-a",
      solutionId: "m365-copilot",
      workload: "work-iq",
      businessUnit: "it",
      environment: "prod",
      resourceId: "workiq-requests",
      usageQuantity: 1000,
      unitCost: 0.2,
      valuePoints: 500,
    },
  ]);
  const licenseSummary = summarizeLicenseUtilization([
    {
      timestamp: "2026-06-24T12:00:00Z",
      tenantId: "tenant-a",
      solutionId: "m365-copilot",
      workload: "work-iq",
      businessUnit: "it",
      assignedSeats: 100,
      activeSeats: 80,
      provisionedSeats: 120,
    },
  ]);
  const tracker = initializeUseCaseTracker(
    [
      {
        useCaseId: "incident-triage",
        name: "Reduce incident triage time",
        functionArea: "IT",
        scenarioLevel: "buy",
        solutionIds: ["m365-copilot"],
        hasPromptGallery: true,
        hasDemoVideo: true,
        isFrontlineWorker: false,
      },
      {
        useCaseId: "knowledge-search",
        name: "Knowledge search",
        functionArea: "IT",
        scenarioLevel: "extend",
        solutionIds: ["fabric"],
        hasPromptGallery: true,
        hasDemoVideo: false,
        isFrontlineWorker: false,
      },
    ],
    { tenantId: "tenant-a", businessUnit: "it" }
  );
  updateUseCaseTracker(tracker, [
    {
      useCaseId: "incident-triage",
      status: "adopted",
      kpiName: "Average incident triage time",
      kpiBaseline: 42,
      kpiTarget: 20,
      adoptedAt: "2026-06-24T12:00:00Z",
    },
  ]);
  const scenarioPortfolio = buildScenarioPortfolioSummary(tracker);
  const valueDashboard = buildValueDashboard({
    costSummary,
    licenseSummary,
    scenarioPortfolio,
  });
  const operationsDashboard = buildOperationsDashboard({
    signalFreshness: summarizeSignalFreshness(signals, { staleAfterMinutes: 60 }),
    runtimes: [createRuntime()],
    connectorReadiness: {},
    iqReadinessSummaries: [],
    siemReadiness: null,
    overshareMetrics: summarizeOvershareMetrics({ incidents: [], enforcementDecisions: [] }),
    agentInvocations: summarizeAgentInvocations({
      registry,
      invocations: [],
    }),
  });
  const payload = buildDashboardApiPayload({
    operationsDashboard,
    valueDashboard,
    generatedAt: "2026-06-24T13:00:00Z",
  });
  const validation = validateDashboardApiPayload(payload);

  assert.equal(valueDashboard.licenseUtilization.utilizationRate, 0.8);
  assert.equal(valueDashboard.scenarioPortfolio.kpiCoverage, 0.5);
  assert.equal(payload.integrations.rest.path, "/api/dashboard-metrics");
  assert.equal(validation.ok, true);
});
