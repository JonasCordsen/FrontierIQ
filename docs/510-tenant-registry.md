# 510-tenant-registry — Tenant Registry Contract

## Purpose

Deterministic tenant registry model for FrontierIQ onboarding and lifecycle state
tracking.

## Pillar: GOVERN

## Module

`src/govern/tenant/tenant-registry.mjs`

## API

| Function | Description |
| --- | --- |
| `buildTenantRecord(input)` | Builds normalized tenant records with defaults |
| `validateTenantRecord(record)` | Validates required tenant fields and state |
| `transitionTenantState(record, nextState, updatedAt)` | Enforces lifecycle transition rules |
| `buildTenantRegistrySummary(records)` | Aggregates totals by state and active tenants |

## Lifecycle states

`draft → onboarding → active ↔ suspended → offboarded`

## Tests

`tests/govern/tenant-registry.test.mjs`

