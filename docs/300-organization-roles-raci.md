# Organization roles and RACI

Implements issue #17 with deterministic organization role and RACI contracts in `src/govern/operating-model/org-roles-raci.mjs`.

## What is implemented

- `buildOrganizationRoleCatalog()` defines required cross-functional ownership roles across OBSERVE, GOVERN, SECURE, and OPTIMIZE responsibilities.
- `buildRaciMatrix()` defines deterministic accountable/responsible/consulted/informed assignments for onboarding, policy, incidents, attestation, training, and value review workstreams.
- `summarizeRaciReadiness()` provides fail-closed checks for role coverage, workstream coverage, and assignment integrity.

## Contract boundaries

- **Role catalog** answers who holds organizational ownership for the FrontierIQ operating model.
- **RACI matrix** answers how ownership is distributed per governance and operations workstream.
- **Readiness summary** answers whether the role model and RACI matrix are complete and internally valid.

## Validation

- `tests/govern/org-roles-raci.test.mjs`
