# Governance matrix and risk taxonomy

Implements issue #19 with deterministic governance matrix and risk taxonomy contracts in `src/govern/operations/governance-matrix-risk-taxonomy.mjs`.

## What is implemented

- `buildRiskTaxonomy()` defines risk bands (`low`, `medium`, `high`, `critical`) with score ranges, review gates, and baseline attestation cadences.
- `buildGovernanceMatrix()` defines governance mappings for both `agent` and `skill` assets across all risk bands, including required reviewers and required policy controls.
- `buildAttestationCadencePolicy()` defines attestation cadence policy by asset type and risk band.
- `summarizeGovernanceRiskReadiness()` provides fail-closed checks for risk-band coverage, governance mapping completeness, policy mapping integrity, and attestation cadence coverage.

## Contract boundaries

- **Risk taxonomy** answers how risk is classified and which review gate applies.
- **Governance matrix** answers which controls and reviewers are required per asset/risk combination.
- **Attestation cadence policy** answers how often each asset/risk path must be re-attested.
- **Readiness summary** answers whether governance and risk taxonomy are complete and executable.

## Validation

- `tests/govern/governance-matrix-risk-taxonomy.test.mjs`
