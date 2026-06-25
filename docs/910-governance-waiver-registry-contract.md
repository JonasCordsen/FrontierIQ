# 910-governance-waiver-registry-contract — Governance Waiver Registry Contract

## Purpose

Deterministic waiver registry for governance exceptions, ownership, and expiry
enforcement.

## Pillar: GOVERN

## Module

`src/govern/operations/governance-waiver-registry-contract.mjs`

## API

| Function | Description |
| --- | --- |
| `registerGovernanceWaiver(input)` | Registers deterministic waiver entries |
| `enforceWaiverExpiry(registry, now)` | Classifies active/expiring/expired waivers |
| `summarizeWaiverRegistry(registry)` | Produces waiver ownership and status summary |

## Tests

`tests/govern/governance-waiver-registry-contract.test.mjs`

