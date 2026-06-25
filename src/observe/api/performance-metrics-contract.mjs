/**
 * Performance metrics contract.
 * Pillar: OBSERVE
 *
 * Normalizes latency, throughput, and resource utilization metrics for API
 * runtime performance evidence.
 */

import { classifyRequestOutcome } from "./request-telemetry-contract.mjs";

/**
 * Normalize a single metric sample.
 * @param {object} sample
 * @returns {object}
 */
export function normalizePerformanceMetricSample(sample = {}) {
  const statusCode = normalizeStatusCode(sample.statusCode);
  const outcome = classifyRequestOutcome(statusCode);
  return {
    requestId: sample.requestId ?? null,
    tenantId: sample.tenantId ?? null,
    generatedAt: sample.generatedAt ?? null,
    statusCode,
    outcome,
    durationMs: clampMin(sample.durationMs, 0),
    throughputRps: clampMin(sample.throughputRps, 0),
    cpuPercent: clampRange(sample.cpuPercent, 0, 100),
    memoryPercent: clampRange(sample.memoryPercent, 0, 100),
    resourceUtilizationPercent: Math.max(
      clampRange(sample.cpuPercent, 0, 100),
      clampRange(sample.memoryPercent, 0, 100)
    ),
  };
}

/**
 * Build summary from metric samples.
 * @param {object[]} samples
 * @returns {object}
 */
export function buildPerformanceMetricsSummary(samples) {
  const normalized = (Array.isArray(samples) ? samples : []).map(normalizePerformanceMetricSample);
  if (normalized.length === 0) {
    return {
      requestCount: 0,
      avgDurationMs: 0,
      p95DurationMs: 0,
      avgThroughputRps: 0,
      peakThroughputRps: 0,
      avgCpuPercent: 0,
      avgMemoryPercent: 0,
      peakResourceUtilizationPercent: 0,
      errorRate: 0,
      health: "critical",
    };
  }

  const durations = normalized.map((sample) => sample.durationMs).sort((left, right) => left - right);
  const throughput = normalized.map((sample) => sample.throughputRps);
  const cpu = normalized.map((sample) => sample.cpuPercent);
  const memory = normalized.map((sample) => sample.memoryPercent);
  const errors = normalized.filter((sample) => sample.outcome !== "success").length;

  const summary = {
    requestCount: normalized.length,
    avgDurationMs: average(durations),
    p95DurationMs: percentile(durations, 95),
    avgThroughputRps: average(throughput),
    peakThroughputRps: maxOrZero(throughput),
    avgCpuPercent: average(cpu),
    avgMemoryPercent: average(memory),
    peakResourceUtilizationPercent: maxOrZero(
      normalized.map((sample) => sample.resourceUtilizationPercent)
    ),
    errorRate: Number((errors / normalized.length).toFixed(4)),
  };

  return {
    ...summary,
    health: classifyPerformanceHealth(summary),
  };
}

/**
 * Classify performance health from summary thresholds.
 * @param {object} summary
 * @returns {'healthy'|'fair'|'at-risk'|'critical'}
 */
export function classifyPerformanceHealth(summary) {
  if (!summary || typeof summary !== "object") return "critical";
  if (
    summary.errorRate >= 0.2 ||
    summary.p95DurationMs >= 5000 ||
    summary.peakResourceUtilizationPercent >= 95
  ) {
    return "critical";
  }
  if (
    summary.errorRate >= 0.1 ||
    summary.p95DurationMs >= 2000 ||
    summary.peakResourceUtilizationPercent >= 90
  ) {
    return "at-risk";
  }
  if (
    summary.errorRate >= 0.03 ||
    summary.p95DurationMs >= 800 ||
    summary.peakResourceUtilizationPercent >= 75
  ) {
    return "fair";
  }
  return "healthy";
}

/**
 * Build evidence envelope from samples.
 * @param {object[]} samples
 * @param {string} generatedAt
 * @returns {object}
 */
export function buildPerformanceMetricsEvidence(samples, generatedAt) {
  const normalized = (Array.isArray(samples) ? samples : []).map(normalizePerformanceMetricSample);
  return {
    artifactType: "api-performance-metrics",
    generatedAt: generatedAt ?? null,
    summary: buildPerformanceMetricsSummary(normalized),
    samples: normalized,
  };
}

function normalizeStatusCode(statusCode) {
  if (Number.isInteger(statusCode)) return statusCode;
  if (typeof statusCode === "string" && /^\d+$/.test(statusCode)) return Number(statusCode);
  return 0;
}

function clampMin(value, min) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, value);
}

function clampRange(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function average(values) {
  if (!values.length) return 0;
  return Number((values.reduce((acc, value) => acc + value, 0) / values.length).toFixed(2));
}

function percentile(sortedValues, p) {
  if (!sortedValues.length) return 0;
  const index = Math.ceil((p / 100) * sortedValues.length) - 1;
  return sortedValues[Math.max(0, Math.min(sortedValues.length - 1, index))];
}

function maxOrZero(values) {
  return values.length > 0 ? Math.max(...values) : 0;
}

