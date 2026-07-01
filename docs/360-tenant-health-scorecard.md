# 360-tenant-health-scorecard — Tenant Health Scorecard

## Purpose

Combines OBSERVE / GOVERN / SECURE / OPTIMIZE pillar scores into a single
weighted per-tenant health posture. Fail-closed: missing pillar data → score 0.

## Pillar: OPTIMIZE

## Module

`src/optimize/reporting/tenant-health-scorecard.mjs`

## API

| Function | Description |
| --- | --- |
| `classifyHealthBand(score)` | Maps 0–100 to `critical / at-risk / fair / healthy` |
| `buildHealthScorecard(tenantId, pillarInputs)` | Weighted scorecard with per-pillar scores and bands |
| `listScoreDrivers(scorecard, n?)` | Top N positive and negative drivers |
| `buildScorecardDelta(current, previous)` | Per-pillar and overall trend: improved / stable / regressed |

## Pillar weights

| Pillar | Weight |
| --- | --- |
| OBSERVE | 20% |
| GOVERN | 30% |
| SECURE | 30% |
| OPTIMIZE | 20% |

## Health bands

| Score | Band |
| --- | --- |
| 0–39 | critical |
| 40–59 | at-risk |
| 60–79 | fair |
| 80–100 | healthy |

## Tests

`tests/optimize/tenant-health-scorecard.test.mjs` — 26 assertions
