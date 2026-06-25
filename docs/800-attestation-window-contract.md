# 800-attestation-window-contract — Attestation Window Contract

## Purpose

Deterministic attestation scheduling contract for due-window classification,
overdue detection, and evidence export.

## Pillar: GOVERN

## Module

`src/govern/compliance/attestation-window-contract.mjs`

## API

| Function | Description |
| --- | --- |
| `buildAttestationWindows(records, asOf)` | Computes due windows and status for attestation records |
| `summarizeAttestationWindows(windows)` | Builds aggregate overdue/upcoming summary |
| `buildAttestationWindowEvidence(records, asOf, generatedAt)` | Exports evidence envelope with windows and summary |

## Tests

`tests/govern/attestation-window-contract.test.mjs`

