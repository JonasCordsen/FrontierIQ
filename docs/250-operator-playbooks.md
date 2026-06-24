# Operator playbooks

Implements issue #11 with deterministic operator runbook contracts in `src/govern/operations/operator-playbooks.mjs`.

## What is implemented

- `buildOperatorPlaybookCatalog()` defines runbook templates and automation-script contracts for:
  - tenant onboarding
  - incident response
  - token/secret rotation
  - index rehydration
  - tenant suspend/revoke
- `buildOnboardingRunbookExecution()` turns onboarding bundles into executable runbook steps tied to generated onboarding scripts.
- `buildIncidentResponseRunbookExecution()` binds SIEM events and routes to typed response actions from incident playbook catalogs.
- `buildTokenRotationRunbookExecution()` computes due secret/certificate rotations from Key Vault rotation policy and last-rotated timestamps.
- `buildIndexRehydrationRunbookExecution()` determines incremental vs full rehydration mode based on connector readiness and indexing failures.
- `buildTenantSuspendRevokeRunbookExecution()` applies lifecycle transitions for suspend/revoke flows and returns deterministic operator actions.
- `summarizeOperatorPlaybookReadiness()` fails closed unless catalog coverage and all runbook workflow checks are ready.

## Contract boundaries

- **Playbook catalog** answers: "Which workflows are operationally mandatory, and which automation scripts are expected?"
- **Execution builders** answer: "For this workflow trigger, what exact steps/actions should operators run now?"
- **Readiness summary** answers: "Do we have complete runbook coverage and executable workflows across all operator-critical paths?"

This keeps runbook templates and per-incident execution state separate, so dashboards and workflow engines can track readiness without losing operator step detail.

## Validation

- `tests/govern/operator-playbooks.test.mjs`
