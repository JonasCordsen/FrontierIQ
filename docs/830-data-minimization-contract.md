# 830-data-minimization-contract — Data Minimization Contract

## Purpose

Deterministic minimization and redaction contract for PII-bearing payloads.

## Pillar: SECURE

## Module

`src/secure/privacy/data-minimization-contract.mjs`

## API

| Function | Description |
| --- | --- |
| `validateMinimizationPolicy(policy)` | Validates allowlist/redaction policy shape |
| `minimizeDataRecord(record, policy)` | Applies allowlist and redaction to one record |
| `buildMinimizationAudit(records, policy, generatedAt)` | Builds minimization audit envelope and summary |

## Tests

`tests/secure/data-minimization-contract.test.mjs`

