# 760-governance-exception-workflow-contract — Governance Exception Workflow Contract

## Purpose

Deterministic governance exception lifecycle with transition enforcement,
approval trace, and expiry-aware portfolio summary.

## Pillar: GOVERN

## Module

`src/govern/operations/governance-exception-workflow-contract.mjs`

## API

| Function | Description |
| --- | --- |
| `createExceptionRequest(input)` | Creates validated exception request object |
| `advanceExceptionState(request, event)` | Applies allowed transitions with expiry checks |
| `summarizeExceptionPortfolio(requests, asOf)` | Summarizes count-by-state and overdue exception status |

## Tests

`tests/govern/governance-exception-workflow-contract.test.mjs`

