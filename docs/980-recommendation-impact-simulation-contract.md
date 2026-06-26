# 980-recommendation-impact-simulation-contract — Recommendation Impact Simulation Contract

## Purpose

Deterministic before/after impact projections for coach actions across baseline
KPIs.

## Pillar: OPTIMIZE

## Module

`src/optimize/model/recommendation-impact-simulation-contract.mjs`

## API

| Function | Description |
| --- | --- |
| `simulateRecommendationImpact(recommendation, baseline)` | Projects confidence-adjusted KPI impact for one recommendation |
| `simulatePortfolioImpact(items)` | Simulates impact for multiple recommendation/baseline pairs |
| `summarizeImpactSimulation(simulations)` | Summarizes portfolio-level net impact and readiness |

## Tests

`tests/optimize/recommendation-impact-simulation-contract.test.mjs`

