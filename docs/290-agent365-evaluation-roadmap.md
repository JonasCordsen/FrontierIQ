# Agent 365 evaluation and roadmap

Implements issue #23 with deterministic Agent 365 evaluation and integration-planning contracts in `src/govern/operations/agent365-evaluation-roadmap.mjs`.

## What is implemented

- `buildAgent365CapabilityCatalog()` defines required capability tracking for governance hooks, identity context, telemetry export, and admin governance actions.
- `buildAgent365EvaluationCriteria()` defines deterministic weighted criteria and pass thresholds for security, governance, operations, and value.
- `buildAgent365DecisionGates()` defines fail-closed decision gates across discovery, proof-of-value, pilot, and production readiness phases.
- `buildAgent365IntegrationRoadmap()` defines milestone sequencing and target decision date for integrate-vs-fallback planning.
- `summarizeAgent365EvaluationReadiness()` provides fail-closed readiness checks across capability coverage, criteria weight integrity, gate completeness, and roadmap completeness.

## Contract boundaries

- **Capability catalog** answers what Agent 365 functionality must exist for control-plane fit.
- **Evaluation criteria** answers how fit is scored and gated.
- **Decision gates** answers which evidence and approvals are required at each phase.
- **Integration roadmap** answers when decisions are made and who owns each milestone.
- **Readiness summary** answers whether the evaluation workflow is executable versus partially specified.

## Validation

- `tests/govern/agent365-evaluation-roadmap.test.mjs`
