# 750-signal-quality-gate-contract — Signal Quality Gate Contract

## Purpose

Deterministic quality gate for normalized signals with validation, threshold
checks, and evidence scoring.

## Pillar: OBSERVE

## Module

`src/observe/ingestion/signal-quality-gate-contract.mjs`

## API

| Function | Description |
| --- | --- |
| `evaluateSignalQualityGate(signals, options)` | Applies validation, confidence, and freshness thresholds to signals |
| `summarizeSignalQualityByWorkload(gateResult)` | Aggregates pass/reject counts per workload |
| `buildSignalQualityEvidence(gateResult, generatedAt)` | Builds evidence envelope with workload summary |

## Tests

`tests/observe/signal-quality-gate-contract.test.mjs`

