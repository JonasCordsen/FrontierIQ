# 370-coach-action-aggregator — Coach Action Aggregator

## Purpose

Merges coach actions from all four pillars into a ranked, deduplicated list
for IT admin consumption. Ranked by `impact × confidence × severity weight`.

## Pillar: OPTIMIZE

## Module

`src/optimize/delivery/coach-action-aggregator.mjs`

## API

| Function | Description |
| --- | --- |
| `aggregateCoachActions(pillarActions)` | Merge + deduplicate + rank actions from all pillars |
| `deduplicateActions(actions)` | Remove duplicates by ID; keep one per controlId (highest score) |
| `groupByPillar(actions)` | Pillar-keyed map of actions |
| `applyAdminFilter(actions, filter)` | Filter by pillar, minimum severity, maximum effort |
| `buildActionSummary(actions)` | Count by pillar/severity, total impact, top action |

## Scoring formula

```
score = impact × confidence × severityWeight
severityWeight: critical=4, high=3, medium=2, low=1
```

## Filter parameters

| Parameter | Values |
| --- | --- |
| pillar | OBSERVE / GOVERN / SECURE / OPTIMIZE |
| severity | critical / high / medium / low (minimum threshold) |
| effort | low / medium / high (maximum threshold) |

## Tests

`tests/optimize/coach-action-aggregator.test.mjs` — 34 assertions
