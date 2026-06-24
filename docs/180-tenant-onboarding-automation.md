# Tenant Onboarding Automation

This slice turns the existing Lesson 2 onboarding baseline into a **deterministic tenant-onboarding bundle** that can drive provisioning review, approval, and evidence capture.

## Implemented modules

- `src/govern/onboarding/tenant-onboarding.mjs`
  - `validateTenantOnboardingRequest()` validates the onboarding request, structured permissions, create/reference resources, and discriminated credential strategy.
  - `buildTenantOnboardingBundle()` produces the top-level onboarding package with app registration, Key Vault manifest, template contract, script pack, and control/evidence alignment.
  - `buildTenantKeyVaultProvisioningManifest()` derives secret or certificate provisioning metadata from the credential strategy.
  - `buildTenantResourceTemplateContract()` emits a Bicep-ready tenant resource contract with resource modes, secret refs, role assignments, and outputs.
  - `buildTenantOnboardingScriptPack()` produces deterministic CLI/script steps for app registration, admin consent, Key Vault secret setup, and template deployment.
  - `summarizeTenantOnboardingReadiness()` returns control-driven readiness checks and failed-check codes.

## Design choices

- **Structured permissions first.** App permissions are modeled as `requiredResourceAccess`-style entries; the admin-consent URL is a derived artifact, not the source of truth.
- **Credential strategy is explicit.** Client-secret and certificate flows are modeled as separate strategies so rotation and provisioning rules stay deterministic.
- **Create vs reference is built in.** Tenant resources can be newly provisioned or referenced, which keeps the contract usable for greenfield and existing tenant baselines.
- **Control and evidence aligned.** Onboarding outputs map directly into the existing evidence catalog and audit-readiness automation defaults.

## Evidence integration

This slice extends:

- `src/govern/policy/evidence-mapping.mjs`
- `src/govern/compliance/audit-readiness.mjs`

New onboarding artifacts:

- `evidence/tenant-onboarding-bundle.json`
- `evidence/tenant-resource-template.json`
- `evidence/tenant-onboarding-scripts.json`

## Test coverage

- `tests/govern/tenant-onboarding.test.mjs`
