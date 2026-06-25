# 870-recommendation-explainability-contract — Recommendation Explainability Contract

## Purpose

Deterministic rationale traces for coach actions to explain priority scoring.

## Pillar: OPTIMIZE

## Module

`src/optimize/delivery/recommendation-explainability-contract.mjs`

## API

| Function | Description |
| --- | --- |
| `buildRecommendationRationaleTrace(action)` | Produces deterministic reasoning factors and score trace |
| `buildRecommendationExplainabilityBundle(actions)` | Builds explainability traces with summary |
| `summarizeRecommendationExplainability(traces)` | Summarizes explainability coverage and status |

## Tests

`tests/optimize/recommendation-explainability-contract.test.mjs`

