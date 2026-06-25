import test from "node:test";
import assert from "node:assert/strict";

import {
  evaluateSourceHealth,
  classifySourceOutage,
  buildSourceHealthEvidence,
} from "../../src/observe/ingestion/source-health-contract.mjs";

const sourceMetrics = [
  { sourceId: "graph-reports", successRate: 0.99, latencyMs: 200, freshnessMinutes: 10, errorCount: 0 },
  { sourceId: "audit", successRate: 0.7, latencyMs: 2200, freshnessMinutes: 140, errorCount: 5 },
];

test("evaluates source health scores", () => {
  const health = evaluateSourceHealth(sourceMetrics);
  assert.equal(health.length, 2);
  assert.equal(health[0].score > health[1].score, true);
});

test("classifies outage levels", () => {
  assert.equal(classifySourceOutage(90), "none");
  assert.equal(classifySourceOutage(70), "partial");
  assert.equal(classifySourceOutage(40), "major");
});

test("builds source health evidence envelope", () => {
  const health = evaluateSourceHealth(sourceMetrics);
  const evidence = buildSourceHealthEvidence(health, "2026-01-01T00:00:00.000Z");
  assert.equal(evidence.artifactType, "source-health");
  assert.equal(evidence.summary.totalSources, 2);
});

