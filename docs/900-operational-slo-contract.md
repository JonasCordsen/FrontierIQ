# 900-operational-slo-contract — Operational SLO Contract

## Purpose

Deterministic operational SLO target evaluation with burn-rate classification
and breach alerts.

## Pillar: OBSERVE

## Module

`src/observe/api/operational-slo-contract.mjs`

## API

| Function | Description |
| --- | --- |
| `evaluateOperationalSlo(measurements)` | Evaluates SLO measurements against targets |
| `classifySloBurnRate(burnRate)` | Classifies burn rate severity |
| `buildSloBreachAlerts(evaluations)` | Produces deterministic breach alerts |

## Tests

`tests/observe/operational-slo-contract.test.mjs`

