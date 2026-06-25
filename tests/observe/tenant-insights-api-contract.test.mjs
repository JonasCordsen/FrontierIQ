import test from "node:test";
import assert from "node:assert/strict";

import {
  buildTenantInsightsPayload,
  validateTenantInsightsPayload,
  buildTenantInsightsResponse,
} from "../../src/observe/api/tenant-insights-api-contract.mjs";

const payloadInput = {
  tenantId: "tenant-a",
  healthTrendSeries: {
    tenantId: "tenant-a",
    points: [{ timestamp: "2026-01-01T00:00:00.000Z", overall: 72, band: "fair" }],
    deltas: [],
  },
  costRows: [
    {
      tenantId: "tenant-a",
      solutionId: "m365-copilot",
      workload: "observe-ingestion",
      businessUnit: "it",
      environment: "prod",
      resourceId: "res-1",
      timestamp: "2026-01-01T00:00:00.000Z",
      pillar: "OBSERVE",
      totalCost: 20,
      totalValuePoints: 40,
      roiIndex: 2,
    },
  ],
  performanceSamples: [{ statusCode: 200, durationMs: 120, throughputRps: 10, cpuPercent: 55, memoryPercent: 50 }],
  coachActions: [],
  riskFlags: [],
  generatedAt: "2026-01-01T00:00:00.000Z",
};

test("builds tenant insights payload", () => {
  const result = buildTenantInsightsPayload(payloadInput);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.payload.tenantId, "tenant-a");
  assert.equal(result.payload.performanceSummary.requestCount, 1);
});

test("validates tenant insights payload", () => {
  const result = buildTenantInsightsPayload(payloadInput);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(validateTenantInsightsPayload(result.payload).ok, true);
});

test("builds success response envelope", () => {
  const result = buildTenantInsightsPayload(payloadInput);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const response = buildTenantInsightsResponse(result.payload);
  assert.equal(response.status, "success");
});

test("fails response envelope when payload is invalid", () => {
  const response = buildTenantInsightsResponse({ tenantId: "tenant-a" });
  assert.equal(response.status, "error");
  assert.equal(response.errors.length > 0, true);
});

