# 950-cross-tenant-benchmark-contract — Cross-Tenant Benchmark Contract

## Purpose

Deterministic percentile benchmarking across tenant cohorts for KPI comparisons.

## Pillar: OPTIMIZE

## Module

`src/optimize/reporting/cross-tenant-benchmark-contract.mjs`

## API

| Function | Description |
| --- | --- |
| `buildBenchmarkCohorts(tenantMetrics, metricKey)` | Normalizes and sorts cohort rows for a metric |
| `calculateTenantPercentiles(tenantMetrics, metricKey)` | Computes deterministic percentile and benchmark band by cohort |
| `buildCrossTenantBenchmarkSummary(percentiles)` | Produces current-state benchmark summary across tenants |

## Tests

`tests/optimize/cross-tenant-benchmark-contract.test.mjs`

