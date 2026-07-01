# 920-executive-delta-briefing-contract — Executive Delta Briefing Contract

## Purpose

Deterministic period-over-period executive briefing with variance drivers and
supporting evidence.

## Pillar: OPTIMIZE

## Module

`src/optimize/reporting/executive-delta-briefing-contract.mjs`

## API

| Function | Description |
| --- | --- |
| `buildExecutiveDeltaBriefing(previousPeriod, currentPeriod)` | Builds deterministic executive delta briefing payload |
| `summarizeExecutiveVariance(briefing)` | Summarizes positive and negative variance signals |
| `buildExecutiveDeltaEvidence(briefing, generatedAt)` | Builds executive briefing evidence envelope |

## Tests

`tests/optimize/executive-delta-briefing-contract.test.mjs`

