# 700-tenant-health-trends-contract — Tenant Health Trends Contract

## Purpose

Deterministic multi-period scorecard trend and delta contract for per-tenant
health evolution reporting.

## Pillar: OPTIMIZE

## Module

`src/optimize/reporting/tenant-health-trends-contract.mjs`

## API

| Function | Description |
| --- | --- |
| `buildTenantHealthTrendSeries(snapshots)` | Builds ordered score snapshots and transition deltas for one tenant |
| `summarizeTenantHealthTrends(series)` | Computes trend counts, net change, volatility, and current band |
| `buildTenantHealthTrendEvidence(series, generatedAt)` | Wraps trend series and summary in evidence envelope |

## Trend outputs

- ordered score points with band per period
- per-transition delta (improved/regressed/stable)
- summary with current band and net change

## Tests

`tests/optimize/tenant-health-trends-contract.test.mjs`

