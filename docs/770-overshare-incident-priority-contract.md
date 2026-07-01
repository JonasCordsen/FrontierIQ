# 770-overshare-incident-priority-contract — Overshare Incident Priority Contract

## Purpose

Deterministic priority scoring and ranking for overshare incident triage using
severity, user impact, sensitivity, and exposure context.

## Pillar: SECURE

## Module

`src/secure/overshare/incident-priority-contract.mjs`

## API

| Function | Description |
| --- | --- |
| `calculateOversharePriority(incident)` | Computes priority score and band for one incident |
| `rankOvershareIncidents(incidents)` | Returns incidents sorted by descending priority |
| `summarizeOversharePriorityQueue(incidents)` | Builds queue summary with top incident and band distribution |

## Tests

`tests/secure/incident-priority-contract.test.mjs`

