# 70-cost-value-model - Unified cost and value model

This document defines the Phase 3 cost/value model foundation.

## Objective

Provide one normalized model for showback/chargeback and ROI tracking across Microsoft AI solutions.

## Source files

- `src/optimize/model/showback-dimensions.mjs`
- `src/optimize/model/cost-value-model.mjs`
- `src/optimize/model/index.mjs`

## Showback dimensions

Required attribution dimensions:

1. `tenantId`
2. `solutionId`
3. `workload`
4. `businessUnit`
5. `environment`
6. `resourceId`

## Cost/value record contract

Each record includes:

- showback dimensions
- `timestamp`
- `usageQuantity`
- `unitCost`
- `valuePoints`

## Output views

`buildCostValueSummary()` returns:

- global totals (`totalCost`, `totalValuePoints`, `roiIndex`)
- grouped views by:
  - solution
  - business unit
  - tenant
  - environment

`detectBudgetAnomalies()` supports rule-based anomaly extraction for budget guardrails.

## Validation

```bash
node --test tests/observe/*.test.mjs tests/govern/*.test.mjs tests/optimize/*.test.mjs
```

