import test from "node:test";
import assert from "node:assert/strict";

import {
  buildValueRealizationSnapshot,
  buildValueRealizationTrend,
  summarizeValueRealizationHealth,
} from "../../src/optimize/reporting/value-realization-contract.mjs";

test("builds value realization snapshot", () => {
  const snapshot = buildValueRealizationSnapshot({
    period: "2026-01",
    expectedValue: 100,
    realizedValue: 90,
    totalCost: 30,
  });
  assert.equal(snapshot.realizationRate, 0.9);
  assert.equal(snapshot.roiIndex, 3);
});

test("builds realization trend with deltas", () => {
  const trend = buildValueRealizationTrend([
    { period: "2026-01", expectedValue: 100, realizedValue: 80, totalCost: 40 },
    { period: "2026-02", expectedValue: 100, realizedValue: 95, totalCost: 40 },
  ]);
  assert.equal(trend.snapshots.length, 2);
  assert.equal(trend.deltas.length, 1);
});

test("summarizes value realization health", () => {
  const trend = buildValueRealizationTrend([
    { period: "2026-01", expectedValue: 100, realizedValue: 90, totalCost: 30 },
    { period: "2026-02", expectedValue: 100, realizedValue: 95, totalCost: 30 },
  ]);
  const summary = summarizeValueRealizationHealth(trend);
  assert.equal(summary.status, "ready");
});

