/**
 * @param {{
 *   signalFreshness: {
 *     staleAfterMinutes: number;
 *     totalSignals: number;
 *     staleCount: number;
 *     freshCount: number;
 *     averageFreshnessMinutes: number;
 *     maxFreshnessMinutes: number;
 *   };
 *   runtimes: Array<{
 *     latency: { endToEndMs: number };
 *     counters: { apiCalls: number; documentsIndexed: number; failureCount: number };
 *     costs: { totalEstimatedCost: number };
 *   }>;
 *   connectorReadiness?: Record<string, { status: "ready"|"blocked"; reasonCodes?: string[] }> | null;
 *   iqReadinessSummaries?: Array<{
 *     workload: string;
 *     checks: Record<string, { status: "ready"|"blocked"; reasonCodes?: string[] }>;
 *   }>;
 *   siemReadiness?: { ready: boolean; blockedChecks: string[] } | null;
 *   overshareMetrics: ReturnType<typeof summarizeOvershareMetrics>;
 *   agentInvocations: {
 *     totals: {
 *       totalInvocations: number;
 *       successInvocations: number;
 *       failureInvocations: number;
 *       throttledInvocations: number;
 *       failureRate: number;
 *       uniqueAgentsInvoked: number;
 *     };
 *   };
 * }} input
 */
export function buildOperationsDashboard(input) {
  const ingestionLag = summarizeIngestionLag(input.runtimes);
  const ingestionVolume = summarizeIngestionVolume(input.runtimes);
  const readiness = summarizeIngestionOperations({
    runtimes: input.runtimes,
    connectorReadiness: input.connectorReadiness ?? null,
    iqReadinessSummaries: input.iqReadinessSummaries ?? [],
    siemReadiness: input.siemReadiness ?? null,
  });
  const health = classifyOperationsHealth({
    blockedSurfaceCount: readiness.blockedSurfaceCount,
    staleCount: input.signalFreshness.staleCount,
    criticalExposures: input.overshareMetrics.criticalExposures,
    failureRate: input.agentInvocations.totals.failureRate,
  });

  return {
    dashboardId: "operations",
    health,
    ingestionLag,
    indexFreshness: { ...input.signalFreshness },
    ingestionVolume,
    agentInvocations: { ...input.agentInvocations.totals },
    overshare: {
      totalIncidents: input.overshareMetrics.totalIncidents,
      exposedCount: input.overshareMetrics.exposedCount,
      atRiskCount: input.overshareMetrics.atRiskCount,
      criticalExposures: input.overshareMetrics.criticalExposures,
      throttleCount: input.overshareMetrics.enforcementActions.throttle ?? 0,
      suspensionCount: input.overshareMetrics.enforcementActions.suspend ?? 0,
    },
    readiness,
  };
}

/**
 * @param {{
 *   costSummary: {
 *     totals: { totalCost: number; totalValuePoints: number; roiIndex: number; records: number };
 *   };
 *   licenseSummary: ReturnType<typeof import("../model/license-utilization.mjs").summarizeLicenseUtilization>;
 *   scenarioPortfolio: {
 *     totalUseCases: number;
 *     byStatus: Record<string, number>;
 *     withKpi: number;
 *     kpiCoverage: number;
 *   };
 * }} input
 */
export function buildValueDashboard(input) {
  const health = classifyValueHealth({
    roiIndex: input.costSummary.totals.roiIndex,
    kpiCoverage: input.scenarioPortfolio.kpiCoverage,
    utilizationRate: input.licenseSummary.totals.utilizationRate,
  });

  return {
    dashboardId: "value",
    health,
    roi: {
      totalCost: input.costSummary.totals.totalCost,
      totalValuePoints: input.costSummary.totals.totalValuePoints,
      roiIndex: input.costSummary.totals.roiIndex,
      records: input.costSummary.totals.records,
    },
    licenseUtilization: {
      assignedSeats: input.licenseSummary.totals.assignedSeats,
      activeSeats: input.licenseSummary.totals.activeSeats,
      provisionedSeats: input.licenseSummary.totals.provisionedSeats,
      strandedSeats: input.licenseSummary.totals.strandedSeats,
      utilizationRate: input.licenseSummary.totals.utilizationRate,
      activationRate: input.licenseSummary.totals.activationRate,
    },
    scenarioPortfolio: {
      totalUseCases: input.scenarioPortfolio.totalUseCases,
      adoptedUseCases: input.scenarioPortfolio.byStatus.adopted ?? 0,
      withKpi: input.scenarioPortfolio.withKpi,
      kpiCoverage: input.scenarioPortfolio.kpiCoverage,
    },
  };
}

/**
 * @param {{
 *   runtimes: Array<{
 *     latency: { endToEndMs: number };
 *     counters: { apiCalls: number; documentsIndexed: number; failureCount: number };
 *     costs: { totalEstimatedCost: number };
 *   }>;
 *   connectorReadiness?: Record<string, { status: "ready"|"blocked"; reasonCodes?: string[] }> | null;
 *   iqReadinessSummaries?: Array<{
 *     workload: string;
 *     checks: Record<string, { status: "ready"|"blocked"; reasonCodes?: string[] }>;
 *   }>;
 *   siemReadiness?: { ready: boolean; blockedChecks: string[] } | null;
 * }} input
 */
export function summarizeIngestionOperations(input) {
  /** @type {Array<{ surface: string; reasonCodes: string[] }>} */
  const blockedSurfaces = [];

  for (const [name, check] of Object.entries(input.connectorReadiness ?? {})) {
    if (check.status === "blocked") {
      blockedSurfaces.push({ surface: `foundry_connector.${name}`, reasonCodes: check.reasonCodes ?? [] });
    }
  }

  for (const summary of input.iqReadinessSummaries ?? []) {
    for (const [name, check] of Object.entries(summary.checks)) {
      if (check.status === "blocked") {
        blockedSurfaces.push({ surface: `${summary.workload}.${name}`, reasonCodes: check.reasonCodes ?? [] });
      }
    }
  }

  if (input.siemReadiness && !input.siemReadiness.ready) {
    blockedSurfaces.push({
      surface: "siem.readiness",
      reasonCodes: input.siemReadiness.blockedChecks,
    });
  }

  return {
    blockedSurfaceCount: blockedSurfaces.length,
    blockedSurfaces,
    runtimeCount: input.runtimes.length,
  };
}

/**
 * @param {{
 *   incidents: Array<{
 *     severity: "none"|"low"|"medium"|"high"|"critical";
 *     stage: "ingestion"|"query";
 *     actualExposure: boolean;
 *   }>;
 *   enforcementDecisions: Array<{
 *     recommendedAction: "allow"|"warn"|"review"|"throttle"|"suspend";
 *   }>;
 * }} input
 */
export function summarizeOvershareMetrics(input) {
  const bySeverity = { none: 0, low: 0, medium: 0, high: 0, critical: 0 };
  const byStage = { ingestion: 0, query: 0 };
  const enforcementActions = { allow: 0, warn: 0, review: 0, throttle: 0, suspend: 0 };

  let exposedCount = 0;
  let atRiskCount = 0;
  let criticalExposures = 0;

  for (const incident of input.incidents) {
    bySeverity[incident.severity] += 1;
    byStage[incident.stage] += 1;
    if (incident.actualExposure) {
      exposedCount += 1;
      if (incident.severity === "critical") criticalExposures += 1;
    } else {
      atRiskCount += 1;
    }
  }

  for (const decision of input.enforcementDecisions) {
    enforcementActions[decision.recommendedAction] += 1;
  }

  return {
    totalIncidents: input.incidents.length,
    exposedCount,
    atRiskCount,
    criticalExposures,
    bySeverity,
    byStage,
    enforcementActions,
  };
}

/**
 * @param {{
 *   operationsDashboard: ReturnType<typeof buildOperationsDashboard>;
 *   valueDashboard: ReturnType<typeof buildValueDashboard>;
 *   generatedAt?: string;
 * }} input
 */
export function buildDashboardApiPayload(input) {
  const generatedAt = input.generatedAt ?? new Date().toISOString();

  return {
    version: "2026.06.1",
    generatedAt,
    resource: "dashboard-metrics",
    integrations: {
      fabricPowerBi: {
        format: "tabular-json",
        recommendedTables: ["operations_dashboard", "value_dashboard"],
      },
      rest: {
        path: "/api/dashboard-metrics",
        contentType: "application/json",
      },
    },
    dashboards: {
      operations: input.operationsDashboard,
      value: input.valueDashboard,
    },
  };
}

/**
 * @param {ReturnType<typeof buildDashboardApiPayload>} payload
 */
export function validateDashboardApiPayload(payload) {
  /** @type {string[]} */
  const errors = [];

  if (!payload || typeof payload !== "object") {
    return { ok: false, errors: ["payload must be an object"] };
  }
  if (typeof payload.version !== "string" || !payload.version) errors.push("version must be set");
  if (typeof payload.generatedAt !== "string" || Number.isNaN(Date.parse(payload.generatedAt))) {
    errors.push("generatedAt must be ISO-8601");
  }
  if (payload.resource !== "dashboard-metrics") errors.push("resource must be dashboard-metrics");
  if (!payload.dashboards || typeof payload.dashboards !== "object") {
    errors.push("dashboards must be present");
  } else {
    validateFiniteNumber(payload.dashboards.operations?.ingestionLag?.p95Ms, "operations.ingestionLag.p95Ms", errors);
    validateFiniteNumber(payload.dashboards.operations?.indexFreshness?.averageFreshnessMinutes, "operations.indexFreshness.averageFreshnessMinutes", errors);
    validateFiniteNumber(payload.dashboards.operations?.agentInvocations?.totalInvocations, "operations.agentInvocations.totalInvocations", errors);
    validateFiniteNumber(payload.dashboards.value?.roi?.roiIndex, "value.roi.roiIndex", errors);
    validateFiniteNumber(payload.dashboards.value?.licenseUtilization?.utilizationRate, "value.licenseUtilization.utilizationRate", errors);
    validateFiniteNumber(payload.dashboards.value?.scenarioPortfolio?.kpiCoverage, "value.scenarioPortfolio.kpiCoverage", errors);
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true };
}

function summarizeIngestionLag(runtimes) {
  const latencies = runtimes.map((item) => item.latency.endToEndMs).sort((left, right) => left - right);
  return {
    samples: latencies.length,
    averageMs: latencies.length ? round(latencies.reduce((sum, value) => sum + value, 0) / latencies.length) : 0,
    p95Ms: percentile(latencies, 0.95),
    maxMs: latencies.length ? latencies[latencies.length - 1] : 0,
  };
}

function summarizeIngestionVolume(runtimes) {
  return {
    apiCalls: runtimes.reduce((sum, item) => sum + item.counters.apiCalls, 0),
    documentsIndexed: runtimes.reduce((sum, item) => sum + item.counters.documentsIndexed, 0),
    failureCount: runtimes.reduce((sum, item) => sum + item.counters.failureCount, 0),
    totalEstimatedCost: round(runtimes.reduce((sum, item) => sum + item.costs.totalEstimatedCost, 0)),
  };
}

function classifyOperationsHealth(input) {
  if (input.criticalExposures > 0 || input.blockedSurfaceCount > 2) return "critical";
  if (input.blockedSurfaceCount > 0 || input.staleCount > 0 || input.failureRate > 0) return "warning";
  return "healthy";
}

function classifyValueHealth(input) {
  if (input.roiIndex <= 0 || input.kpiCoverage === 0) return "critical";
  if (input.utilizationRate < 0.6 || input.kpiCoverage < 0.5) return "warning";
  return "healthy";
}

function percentile(sortedValues, quantile) {
  if (sortedValues.length === 0) return 0;
  const index = Math.max(Math.ceil(sortedValues.length * quantile) - 1, 0);
  return sortedValues[index];
}

function round(value) {
  return Number(value.toFixed(4));
}

function validateFiniteNumber(value, field, errors) {
  if (typeof value !== "number" || Number.isNaN(value) || !Number.isFinite(value)) {
    errors.push(`${field} must be a finite number`);
  }
}
