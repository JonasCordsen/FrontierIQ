# Support model and SLAs

Implements issue #21 with deterministic support operations contracts in `src/govern/operations/support-model.mjs`.

## What is implemented

- `buildSupportTierModel()` defines L1/L2/L3 ownership, responsibilities, and handoff criteria.
- `buildEscalationPolicy()` defines severity-based escalation paths and notification roles for `sev1`, `sev2`, and `sev3`.
- `buildSlaCatalog()` defines first-response, mitigation, and update-cadence targets per severity.
- `summarizeSupportModelReadiness()` provides fail-closed readiness checks for tier coverage, escalation coverage, SLA completeness, and escalation-path integrity.

## Contract boundaries

- **Support tier model** answers who owns each incident/support stage.
- **Escalation policy** answers how incidents move between tiers by severity.
- **SLA catalog** answers which response and mitigation targets are contractually expected.
- **Readiness summary** answers whether support operations are complete versus partially defined.

## Validation

- `tests/govern/support-model.test.mjs`
