# 500-fabric-export-adapter — Fabric Export Adapter

## Purpose

Converts FrontierIQ signals, audit events, and scorecard history into Microsoft
Fabric lakehouse Delta table format for long-term analytics and trend analysis.

## Pillar: OPTIMIZE (reporting)

## Module

`src/optimize/reporting/fabric-export-adapter.mjs`

## API

| Function | Description |
| --- | --- |
| `buildSignalsTableSchema()` | Fabric schema for `frontieriq_signals` Delta table |
| `buildAuditEventsTableSchema()` | Fabric schema for `frontieriq_audit_events` Delta table |
| `buildScorecardHistoryTableSchema()` | Fabric schema for `frontieriq_scorecard_history` Delta table |
| `exportSignals(signals, tenantId, exportedAt)` | Convert signals array → `{ tableName, schema, rows }` |
| `exportAuditEvents(events, tenantId, exportedAt)` | Convert audit events array → `{ tableName, schema, rows }` |
| `exportScorecardHistory(scorecard, tenantId, exportedAt)` | Convert scorecard → 1-row history record |
| `buildFabricExportBundle(opts)` | Full bundle: `{ tables: [...] }` with all three tables |

## Delta tables

| Table | Key columns |
| --- | --- |
| `frontieriq_signals` | signalId, tenantId, pillar, severity, detectedAt, exportedAt |
| `frontieriq_audit_events` | eventId, tenantId, userId, activityType, severity, occurredAt, exportedAt |
| `frontieriq_scorecard_history` | tenantId, overallScore, healthBand, pillarScores×4, generatedAt, exportedAt |

## Column types

Uses Spark/Delta Lake types: `string`, `long`, `double`, `boolean`, `timestamp`, `integer`.

## Tests

`tests/optimize/fabric-export-adapter.test.mjs`
