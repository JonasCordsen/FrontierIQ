import test from "node:test";
import assert from "node:assert/strict";

import {
  buildBenchmarkCohorts,
  calculateTenantPercentiles,
  buildCrossTenantBenchmarkSummary,
} from "../../src/optimize/reporting/cross-tenant-benchmark-contract.mjs";

const tenantMetrics = [
  { tenantId: "tenant-a", cohort: "enterprise", metrics: { adoptionRate: 80 } },
  { tenantId: "tenant-b", cohort: "enterprise", metrics: { adoptionRate: 60 } },
  { tenantId: "tenant-c", cohort: "enterprise", metrics: { adoptionRate: 30 } },
];

test("builds cohort rows sorted by metric value", () => {
  const rows = buildBenchmarkCohorts(tenantMetrics, "adoptionRate");
  assert.equal(rows.length, 3);
  assert.equal(rows[0].tenantId, "tenant-a");
});

test("calculates deterministic percentile bands", () => {
  const percentiles = calculateTenantPercentiles(tenantMetrics, "adoptionRate");
  const tenantA = percentiles.find((item) => item.tenantId === "tenant-a");
  assert.equal(tenantA.percentile >= 90, true);
  assert.equal(["top_quartile", "mid_band", "lagging"].includes(tenantA.benchmarkBand), true);
});

test("summarizes benchmark current state", () => {
  const summary = buildCrossTenantBenchmarkSummary(calculateTenantPercentiles(tenantMetrics, "adoptionRate"));
  assert.equal(summary.totalTenants, 3);
  assert.equal(summary.topTenantId, "tenant-a");
});

