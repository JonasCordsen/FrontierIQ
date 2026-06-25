# 740-governance-rules-engine-contract — Governance Rules Engine Contract

## Purpose

Deterministic governance decision contract evaluating risk band, control
coverage, reviewer coverage, and review-gate alignment.

## Pillar: GOVERN

## Module

`src/govern/operations/governance-rules-engine-contract.mjs`

## API

| Function | Description |
| --- | --- |
| `evaluateGovernanceRules(input)` | Applies governance rules and returns approved/blocked decision |
| `explainGovernanceRuleDecision(decision)` | Produces deterministic decision explanation string |
| `buildGovernanceRuleEvidence(decision, generatedAt)` | Builds evidence envelope for governance decision traceability |

## Rule set

- risk-band-resolution
- control-coverage
- reviewer-coverage
- review-gate-alignment

Unknown rule IDs fail-closed and block the decision.

## Tests

`tests/govern/governance-rules-engine-contract.test.mjs`

