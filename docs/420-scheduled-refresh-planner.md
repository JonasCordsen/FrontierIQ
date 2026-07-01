# 420-scheduled-refresh-planner — Scheduled Refresh Planner

## Purpose

Per-pillar data refresh schedules and staleness detection. Fail-closed: missing
lastRefreshedAt for any pillar → overdue.

## Pillar: OBSERVE

## Module

`src/observe/graph/scheduled-refresh-planner.mjs`

## API

| Function | Description |
| --- | --- |
| `buildDefaultRefreshPolicy()` | Default intervalHours per pillar |
| `buildRefreshSchedule(tenantId, policy?, anchorAt?)` | Per-pillar schedule with nextRefreshAt timestamps |
| `checkStaleness(schedule, lastRefreshedAt, now?)` | fresh / stale / overdue status per pillar |
| `listOverduePillars(schedule, lastRefreshedAt, now?)` | Names of pillars past their refresh window |

## Default intervals

| Pillar | Interval |
| --- | --- |
| OBSERVE | 6 hours |
| SECURE | 12 hours |
| GOVERN | 24 hours |
| OPTIMIZE | 24 hours |

## Staleness classification

| Age vs interval | Status |
| --- | --- |
| ≤ 1× | fresh |
| 1×–2× | stale |
| > 2× | overdue |
| null lastRefreshedAt | overdue (fail-closed) |

## Tests

`tests/observe/scheduled-refresh-planner.test.mjs`
