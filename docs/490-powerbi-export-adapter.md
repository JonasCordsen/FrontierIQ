# 490-powerbi-export-adapter — Power BI Export Adapter

## Purpose

Converts FrontierIQ scorecard and coach action data into Power BI Push Dataset
format (tables with typed columns and row arrays) ready for the Power BI REST API.

## Pillar: OPTIMIZE (reporting)

## Module

`src/optimize/reporting/powerbi-export-adapter.mjs`

## API

| Function | Description |
| --- | --- |
| `buildDatasetSchema()` | Full Push Dataset schema: TenantScorecard, CoachActions, PillarScores tables |
| `scorecardToRows(scorecard, tenantId, generatedAt)` | 1 row per scorecard with all pillar scores |
| `pillarScoresToRows(scorecard, tenantId, generatedAt)` | 1 row per pillar (4 rows per scorecard) |
| `actionsToRows(actions, tenantId, generatedAt)` | 1 row per coach action with rank |
| `buildPowerBIPayload(opts)` | Full push payload: { schema, rows: { TenantScorecard, PillarScores, CoachActions } } |

## Tables

| Table | Rows |
| --- | --- |
| `TenantScorecard` | 1 per export (overall + pillar scores, health band) |
| `PillarScores` | 4 per export (one row per pillar) |
| `CoachActions` | 1 per ranked action |

## Column types

Uses Power BI Push Dataset types: `String`, `Int64`, `Double`, `Boolean`, `DateTime`.

## Tests

`tests/optimize/powerbi-export-adapter.test.mjs`
