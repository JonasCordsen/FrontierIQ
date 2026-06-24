# 440-change-detector — Change Detector

## Purpose

Detects meaningful changes in tenant posture between successive scorecard runs
and classifies them as regressions, improvements, or noise.

## Pillar: OPTIMIZE

## Module

`src/optimize/reporting/change-detector.mjs`

## API

| Function | Description |
| --- | --- |
| `detectChanges(current, previous?)` | Per-pillar and overall change list; previous=null → new-baseline |
| `classifyChange(change)` | noise / medium / high based on magnitude |
| `buildChangeReport(changes)` | Structured report: regressions, improvements, unchanged pillars |
| `listCriticalRegressions(changes)` | High-magnitude regression changes only |

## Magnitude thresholds

| Score diff | Magnitude |
| --- | --- |
| ≤ 2 | noise (suppressed) |
| 3–5 | medium |
| > 5 | high |

## Fail-closed rule

When `previous` is null or undefined, all current metrics are reported as
`new-baseline` — not regressions. This prevents false alerts on first run.

## Tests

`tests/optimize/change-detector.test.mjs`
