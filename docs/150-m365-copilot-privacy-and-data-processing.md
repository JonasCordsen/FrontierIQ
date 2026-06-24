# M365 Copilot Privacy And Data Processing

This slice implements Module 4 Lesson 3 as an **M365-specific privacy posture model** wired into the existing FrontierIQ control/evidence/reporting contracts.

## Implemented modules

- `src/secure/privacy/m365-copilot-privacy-posture.mjs`
  - `buildPrivacyControlProfile()` publishes the Lesson 3 control bundle for residency, labeling, PII handling, consent, and deletion.
  - `buildDataResidencyMap()` measures workload alignment to the tenant default region.
  - `buildRegionalStoragePlan()` records dataset placement and regional alignment.
  - `evaluatePurviewLabelCoverage()` flags required-vs-applied label gaps.
  - `detectPiiFindings()` and `redactSensitiveText()` provide deterministic privacy scanning and redaction helpers.
  - `buildConsentUxModel()` captures the admin/user privacy-notice contract.
  - `buildRetentionDeletionWorkflow()` models retention expiry vs legal-hold behavior.
  - `summarizePrivacyPosture()` creates the executive-report-ready Lesson 3 summary.

## Control and evidence integration

The Lesson 3 implementation extends:

- `src/govern/policy/control-catalog.mjs`
- `src/govern/policy/evidence-mapping.mjs`
- `src/govern/compliance/audit-readiness.mjs`

That keeps privacy artifacts aligned to the same evidence export and readiness workflow used for Lesson 1.

## Reporting impact

`src/optimize/reporting/executive-report.mjs` now accepts `privacySummary` so Lesson 3 posture appears in the same executive payload as maturity, cost, scenarios, and compliance.
