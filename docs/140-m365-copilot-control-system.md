# M365 Copilot Control System

This slice implements Module 4 Lesson 2 as an **M365-specific control-system posture** layered onto the existing FrontierIQ governance spine instead of changing every solution baseline.

## Implemented modules

- `src/govern/control-system/m365-copilot-control-system.mjs`
  - `buildCopilotControlSystemProfile()` extends the existing control/evidence model with Lesson 2 controls for:
    - RBAC role segregation
    - BYO Entra onboarding
    - secret rotation
    - policy-as-code enforcement
    - CI/CD validation gates
  - `validateRoleAssignments()` reuses the high-risk RBAC matcher to enforce separation of duties.
  - `buildByoEntraOnboardingPackage()` produces the deterministic admin-consent package for controlled tenant onboarding.
  - `buildKeyVaultRotationPlan()` records rotation cadence, owners, and secret classes.
  - `buildPolicyAsCodeCatalog()` now delegates to the shared catalog in `src/govern/policy/policy-catalog.mjs`.
  - `buildCiCdComplianceBundle()` composes manifest validation with role-assignment checks.
  - `summarizeControlSystemPosture()` creates the executive-report-ready Lesson 2 summary.

## Control and evidence integration

The Lesson 2 implementation extends:

- `src/govern/policy/control-catalog.mjs`
- `src/govern/policy/evidence-mapping.mjs`
- `src/govern/compliance/audit-readiness.mjs`

This keeps Lesson 2 artifacts in the same control/evidence/audit workflow as the existing compliance foundation.

## Reporting impact

`src/optimize/reporting/executive-report.mjs` now accepts `controlSystemSummary` so executive reporting can surface Lesson 2 posture without inventing a separate reporting pipeline.
