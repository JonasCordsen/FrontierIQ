# 850-review-cadence-orchestrator-contract — Review Cadence Orchestrator Contract

## Purpose

Deterministic governance review cadence scheduling and workload readiness
summary.

## Pillar: GOVERN

## Module

`src/govern/operations/review-cadence-orchestrator-contract.mjs`

## API

| Function | Description |
| --- | --- |
| `buildReviewCadenceSchedule(items, asOf)` | Computes next review windows and status |
| `summarizeReviewCadenceLoad(schedule)` | Summarizes overdue/upcoming/scheduled load |
| `buildReviewCadenceEvidence(schedule, generatedAt)` | Builds evidence envelope for cadence governance |

## Tests

`tests/govern/review-cadence-orchestrator-contract.test.mjs`

