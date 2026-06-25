import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizePerformanceMetricSample,
  buildPerformanceMetricsSummary,
  classifyPerformanceHealth,
  buildPerformanceMetricsEvidence,
} from "../../src/observe/api/performance-metrics-contract.mjs";

const samples = [
  { requestId: "r1", statusCode: 200, durationMs: 120, throughputRps: 20, cpuPercent: 55, memoryPercent: 50 },
  { requestId: "r2", statusCode: "200", durationMs: 200, throughputRps: 18, cpuPercent: 60, memoryPercent: 58 },
  { requestId: "r3", statusCode: 500, durationMs: 1400, throughputRps: 8, cpuPercent: 85, memoryPercent: 82 },
];

test("normalizes performance metric sample", () => {
  const normalized = normalizePerformanceMetricSample(samples[1]);
  assert.equal(normalized.statusCode, 200);
  assert.equal(normalized.outcome, "success");
  assert.equal(normalized.resourceUtilizationPercent, 60);
});

test("builds performance summary and health classification", () => {
  const summary = buildPerformanceMetricsSummary(samples);
  assert.equal(summary.requestCount, 3);
  assert.equal(summary.errorRate > 0, true);
  assert.equal(summary.health, classifyPerformanceHealth(summary));
});

test("returns critical for empty sample set", () => {
  const summary = buildPerformanceMetricsSummary([]);
  assert.equal(summary.requestCount, 0);
  assert.equal(summary.health, "critical");
});

test("builds performance metrics evidence envelope", () => {
  const evidence = buildPerformanceMetricsEvidence(samples, "2026-01-01T00:00:00.000Z");
  assert.equal(evidence.artifactType, "api-performance-metrics");
  assert.equal(evidence.generatedAt, "2026-01-01T00:00:00.000Z");
  assert.equal(evidence.samples.length, 3);
});

