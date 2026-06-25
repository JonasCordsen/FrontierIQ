# 840-value-realization-contract — Value Realization Contract

## Purpose

Deterministic realized-vs-expected value scoring and trend health summary for
value tracking.

## Pillar: OPTIMIZE

## Module

`src/optimize/reporting/value-realization-contract.mjs`

## API

| Function | Description |
| --- | --- |
| `buildValueRealizationSnapshot(input)` | Builds one realization/ROI snapshot |
| `buildValueRealizationTrend(snapshots)` | Builds ordered snapshots and period deltas |
| `summarizeValueRealizationHealth(trend)` | Produces readiness summary from trend history |

## Tests

`tests/optimize/value-realization-contract.test.mjs`

