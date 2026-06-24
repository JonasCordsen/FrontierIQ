# 390-signal-correlator — Signal Correlator

## Purpose

Cross-pillar signal correlation that detects co-occurring signals for the same
resource in a time window and elevates combined risk above individual severity.

## Pillar: OBSERVE (primary)

## Module

`src/observe/signal-correlator.mjs`

## API

| Function | Description |
| --- | --- |
| `buildCorrelationKey(signal, windowHours?)` | Deterministic grouping key by tenantId + resourceId + time bucket |
| `correlateSignals(signals, windowHours?)` | Group signals into correlation groups with elevatedSeverity |
| `classifyCorrelationRisk(group)` | Combined risk from pillar coverage + max severity |
| `listHighRiskCorrelations(correlations)` | Filter groups where elevatedSeverity is high or critical |
| `buildCorrelationSummary(correlations)` | Count by severity and pillar coverage |

## Elevation rules

| Pillar count | Elevation |
| --- | --- |
| 1 | +0 bands |
| 2 | +1 band |
| 3+ | +2 bands (capped at critical) |

## Tests

`tests/observe/signal-correlator.test.mjs`
