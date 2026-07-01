# 860-source-health-contract — Source Health Contract

## Purpose

Deterministic ingestion source health scoring and outage classification evidence
contract.

## Pillar: OBSERVE

## Module

`src/observe/ingestion/source-health-contract.mjs`

## API

| Function | Description |
| --- | --- |
| `evaluateSourceHealth(sources)` | Computes source score/status from reliability metrics |
| `classifySourceOutage(score)` | Classifies outage state from score |
| `buildSourceHealthEvidence(health, generatedAt)` | Produces source-health evidence envelope |

## Tests

`tests/observe/source-health-contract.test.mjs`

