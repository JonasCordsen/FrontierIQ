# 720-compliance-evidence-export-contract — Compliance Evidence Export Contract

## Purpose

Deterministic export bundle combining compliance report and audit-readiness pack
for attestation workflows.

## Pillar: GOVERN

## Module

`src/govern/compliance/compliance-evidence-export-contract.mjs`

## API

| Function | Description |
| --- | --- |
| `buildComplianceEvidenceExport(input)` | Builds export bundle from available artifacts and readiness pack |
| `summarizeComplianceEvidenceExport(exportBundle)` | Summarizes certification coverage and missing evidence status |
| `validateComplianceEvidenceExport(exportBundle)` | Validates export structure and required fields |

## Determinism

- generatedAt defaults to deterministic sentinel when omitted
- compliance report and audit pack both receive explicit generatedAt
- missing evidence always blocks readiness status

## Tests

`tests/govern/compliance-evidence-export-contract.test.mjs`

