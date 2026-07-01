# 730-performance-metrics-contract — Performance Metrics Contract

## Purpose

Deterministic API performance metrics normalization for latency, throughput, and
resource utilization health scoring.

## Pillar: OBSERVE

## Module

`src/observe/api/performance-metrics-contract.mjs`

## API

| Function | Description |
| --- | --- |
| `normalizePerformanceMetricSample(sample)` | Normalizes single metric sample and derives outcome/utilization |
| `buildPerformanceMetricsSummary(samples)` | Builds aggregate summary including p95 latency and error rate |
| `classifyPerformanceHealth(summary)` | Classifies summary into healthy/fair/at-risk/critical |
| `buildPerformanceMetricsEvidence(samples, generatedAt)` | Wraps normalized samples and summary in evidence envelope |

## Health thresholds

- error rate, p95 latency, and peak utilization are evaluated fail-closed
- empty sample set returns `critical` health

## Tests

`tests/observe/performance-metrics-contract.test.mjs`

