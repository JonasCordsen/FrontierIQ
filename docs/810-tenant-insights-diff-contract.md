# 810-tenant-insights-diff-contract — Tenant Insights Diff Contract

## Purpose

Deterministic change-delta contract for tenant insights payload comparisons.

## Pillar: OBSERVE

## Module

`src/observe/api/tenant-insights-diff-contract.mjs`

## API

| Function | Description |
| --- | --- |
| `buildTenantInsightsDiff(current, previous)` | Computes deterministic changed fields and value deltas |
| `summarizeTenantInsightsDiff(diff)` | Summarizes changed field count and status |
| `buildTenantInsightsDiffEvidence(diff, generatedAt)` | Wraps diff and summary in evidence envelope |

## Tests

`tests/observe/tenant-insights-diff-contract.test.mjs`

