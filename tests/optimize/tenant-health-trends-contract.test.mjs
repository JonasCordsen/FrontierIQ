import test from "node:test";
import assert from "node:assert/strict";

import {
  buildTenantHealthTrendSeries,
  summarizeTenantHealthTrends,
  buildTenantHealthTrendEvidence,
} from "../../src/optimize/reporting/tenant-health-trends-contract.mjs";

const snapshots = [
  {
    tenantId: "tenant-a",
    timestamp: "2026-01-01T00:00:00.000Z",
    overall: 60,
    pillars: { OBSERVE: { score: 60 }, GOVERN: { score: 60 }, SECURE: { score: 60 }, OPTIMIZE: { score: 60 } },
  },
  {
    tenantId: "tenant-a",
    timestamp: "2026-02-01T00:00:00.000Z",
    overall: 70,
    pillars: { OBSERVE: { score: 65 }, GOVERN: { score: 70 }, SECURE: { score: 75 }, OPTIMIZE: { score: 70 } },
  },
  {
    tenantId: "tenant-a",
    timestamp: "2026-03-01T00:00:00.000Z",
    overall: 68,
    pillars: { OBSERVE: { score: 63 }, GOVERN: { score: 70 }, SECURE: { score: 74 }, OPTIMIZE: { score: 65 } },
  },
];

test("builds ordered trend series with deltas", () => {
  const result = buildTenantHealthTrendSeries([...snapshots].reverse());
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.series.points[0].timestamp, "2026-01-01T00:00:00.000Z");
  assert.equal(result.series.deltas.length, 2);
});

test("fails for mixed-tenant snapshots", () => {
  const result = buildTenantHealthTrendSeries([
    snapshots[0],
    { ...snapshots[1], tenantId: "tenant-b" },
  ]);
  assert.equal(result.ok, false);
});

test("summarizes trend transitions and net change", () => {
  const result = buildTenantHealthTrendSeries(snapshots);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const summary = summarizeTenantHealthTrends(result.series);
  assert.equal(summary.periods, 3);
  assert.equal(summary.netChange, 8);
  assert.equal(summary.byTrend.improved >= 1, true);
});

test("builds trend evidence envelope", () => {
  const result = buildTenantHealthTrendSeries(snapshots);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const evidence = buildTenantHealthTrendEvidence(result.series, "2026-03-01T00:00:00.000Z");
  assert.equal(evidence.artifactType, "tenant-health-trends");
  assert.equal(evidence.summary.currentScore, 68);
});

