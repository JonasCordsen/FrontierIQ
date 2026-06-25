# 710-cost-attribution-adapter-contract — Cost Attribution Adapter Contract

## Purpose

Deterministic cost attribution contract mapping usage records to coaching
pillars and summarized cost/value evidence.

## Pillar: OPTIMIZE

## Module

`src/optimize/model/cost-attribution-adapter-contract.mjs`

## API

| Function | Description |
| --- | --- |
| `mapUsageToCostAttribution(records)` | Validates and maps usage records into pillar-attributed cost rows |
| `summarizeCostAttributionByPillar(rows)` | Aggregates total cost, value points, share percent, and average ROI by pillar |
| `buildCostAttributionEvidence(rows, generatedAt)` | Produces evidence envelope for export/reporting |

## Attribution rules

- fail-closed numeric validation for usage, unit cost, and value points
- workload/solution token hints resolve pillar classification
- default pillar is `OPTIMIZE` when no hint matches

## Tests

`tests/optimize/cost-attribution-adapter-contract.test.mjs`

