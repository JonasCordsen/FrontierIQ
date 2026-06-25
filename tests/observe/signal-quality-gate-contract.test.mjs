import test from "node:test";
import assert from "node:assert/strict";

import {
  evaluateSignalQualityGate,
  summarizeSignalQualityByWorkload,
  buildSignalQualityEvidence,
} from "../../src/observe/ingestion/signal-quality-gate-contract.mjs";

const validSignal = {
  tenantId: "tenant-a",
  solutionId: "m365-copilot",
  workload: "copilot-usage",
  resourceId: "res-1",
  source: "graph",
  timestamp: "2026-01-01T00:00:00.000Z",
  signalType: "usage",
  severity: "medium",
  confidence: 0.9,
  freshnessMinutes: 30,
  dimensions: {},
  evidence: {},
};

test("evaluates gate and accepts valid signals", () => {
  const result = evaluateSignalQualityGate([validSignal], { minPassRate: 0.5 });
  assert.equal(result.status, "ready");
  assert.equal(result.summary.passed, 1);
});

test("rejects low confidence and stale signals", () => {
  const result = evaluateSignalQualityGate([
    { ...validSignal, resourceId: "res-2", confidence: 0.4 },
    { ...validSignal, resourceId: "res-3", freshnessMinutes: 500 },
  ]);
  assert.equal(result.summary.rejected, 2);
  assert.ok(result.rejectedSignals.some((item) => item.reasonCode === "low_confidence"));
  assert.ok(result.rejectedSignals.some((item) => item.reasonCode === "stale_signal"));
});

test("summarizes quality by workload", () => {
  const result = evaluateSignalQualityGate([validSignal, { ...validSignal, resourceId: "res-2", confidence: 0.4 }]);
  const summary = summarizeSignalQualityByWorkload(result);
  assert.equal(summary["copilot-usage"].passed, 1);
  assert.equal(summary["copilot-usage"].rejected, 1);
});

test("builds evidence envelope", () => {
  const result = evaluateSignalQualityGate([validSignal]);
  const evidence = buildSignalQualityEvidence(result, "2026-01-01T00:00:00.000Z");
  assert.equal(evidence.artifactType, "signal-quality-gate");
  assert.equal(evidence.generatedAt, "2026-01-01T00:00:00.000Z");
});

