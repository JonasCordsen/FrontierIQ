# Policy catalog

Implements the shared machine-readable governance catalog for issue #12 in `src/govern/policy/policy-catalog.mjs`.

## What is implemented

- `buildPolicyCatalog()` publishes a solution-scoped catalog with stable `policyId`, `policyVersion`, `target`, `family`, `severity`, and linked `controlIds`.
- Policy families are modeled as discriminated rule types instead of one flat schema:
  - `approval`
  - `source-allowlist`
  - `model-allowlist`
  - `resource-allowlist`
  - `retention`
  - `cicd-gate`
- `validatePolicyCatalog()` fail-closes malformed catalog entries before they are consumed.
- `evaluateSkillManifestPolicies()`, `evaluateTenantOnboardingPolicies()`, and `evaluateIngestionPolicies()` let CI/CD, onboarding, and ingestion use the same rule source.

## Consumer wiring

- `src/govern/validators/skill-manifest-validator.mjs` now evaluates skill approval, data source allowlists, model/provider allowlists, and CI/CD release gates through the shared catalog.
- `src/govern/control-system/m365-copilot-control-system.mjs` now delegates `buildPolicyAsCodeCatalog()` to the shared catalog instead of maintaining a separate hardcoded rule list.
- `src/govern/onboarding/tenant-onboarding.mjs` now validates onboarding approval/resource policies and emits `policyVersion` + `policyIds` in bundle and readiness outputs.
- `src/observe/ingestion/scenario-library-ingestion.mjs` now evaluates approved ingestion source and retention/storage policy before returning runtime artifacts.

## Validation

- `tests/govern/policy-catalog.test.mjs`
- updated:
  - `tests/govern/registry-and-validator.test.mjs`
  - `tests/govern/m365-copilot-control-system.test.mjs`
  - `tests/govern/tenant-onboarding.test.mjs`
  - `tests/observe/scenario-library-ingestion.test.mjs`
