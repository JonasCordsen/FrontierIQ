import test from "node:test";
import assert from "node:assert/strict";

import {
  buildTenantInsightsDiff,
  summarizeTenantInsightsDiff,
  buildTenantInsightsDiffEvidence,
} from "../../src/observe/api/tenant-insights-diff-contract.mjs";

const previousPayload = {
  tenantId: "tenant-a",
  trendSummary: { currentScore: 70 },
  costSummary: { totalCost: 100 },
  performanceSummary: { errorRate: 0.02 },
  briefing: { requiresImmediateAction: false },
};

const currentPayload = {
  tenantId: "tenant-a",
  trendSummary: { currentScore: 72 },
  costSummary: { totalCost: 100 },
  performanceSummary: { errorRate: 0.05 },
  briefing: { requiresImmediateAction: true },
};

test("builds deterministic insight diff", () => {
  const diff = buildTenantInsightsDiff(currentPayload, previousPayload);
  assert.equal(diff.changed, true);
  assert.ok(diff.changedFields.includes("trendSummary"));
  assert.ok(diff.changedFields.includes("performanceSummary"));
});

test("summarizes insight diff", () => {
  const diff = buildTenantInsightsDiff(currentPayload, previousPayload);
  const summary = summarizeTenantInsightsDiff(diff);
  assert.equal(summary.status, "changed");
  assert.equal(summary.changedFieldCount, 3);
});

test("builds insight diff evidence", () => {
  const diff = buildTenantInsightsDiff(currentPayload, previousPayload);
  const evidence = buildTenantInsightsDiffEvidence(diff, "2026-01-01T00:00:00.000Z");
  assert.equal(evidence.artifactType, "tenant-insights-diff");
});

