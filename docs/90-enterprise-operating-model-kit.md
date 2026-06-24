# 90-enterprise-operating-model-kit - CoE and governance operations kit

This document defines the enterprise operating model kit delivered for Phase 3.

## Objective

Package reusable operations artifacts for:

1. CoE setup
2. RACI assignment
3. periodic attestation
4. exception handling
5. audit evidence packs

## Source files

- `src/govern/operating-model/kit.mjs`
- `src/govern/operating-model/index.mjs`

## Kit contract

`OperatingModelKit` includes:

- `organization`
- `scope` (`single-tenant`, `multi-tenant`, `hybrid`)
- role assignments
- attestation cadence
- exception SLA
- audit pack artifact list

## Default role set

Required roles:

1. executive sponsor
2. CoE lead
3. security representative
4. compliance representative
5. responsible AI lead
6. business owner

## Attestation baseline

Default cadence: every 90 days.

Minimum evidence for attestation packs:

- approval decisions
- policy baseline profile
- identity-permission graph snapshot
- governance decision traces
- attestation signoff register
- exception register

## Exception handling baseline

Default exception SLA: 10 days.

Each exception record should include:

- requesting owner
- reason and impacted control
- temporary compensating controls
- expiry date
- approver identity

## Validation

```bash
node --test tests/observe/*.test.mjs tests/govern/*.test.mjs tests/optimize/*.test.mjs
```

