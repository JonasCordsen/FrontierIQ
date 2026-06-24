# 80-maturity-and-next-best-action - Maturity scorecard and action prioritization

This document defines the Phase 3 maturity scoring and next-best-action foundation.

## Objective

Translate cross-solution posture into:

1. maturity scores by tenant and solution
2. ranked recommendations with explicit priority scoring

## Source files

- `src/optimize/model/maturity-scorecard.mjs`
- `src/optimize/model/next-best-action-engine.mjs`
- `src/optimize/model/index.mjs`

## Maturity model

Input:

- `tenantId`
- `solutionId`
- pillar scores (`observe`, `govern`, `secure`, `optimize`) from 0-100

Output:

- per-solution overall score (average of pillar scores)
- per-tenant overall score (average across solutions)
- global summary (`tenants`, `overall`)

## Next-best-action model

Each candidate action is scored using:

- impact
- effort (inverse contribution)
- risk reduction
- confidence
- pillar weight

Output:

- sorted action list with deterministic `priorityScore`

## Validation

```bash
node --test tests/observe/*.test.mjs tests/govern/*.test.mjs tests/optimize/*.test.mjs
```

