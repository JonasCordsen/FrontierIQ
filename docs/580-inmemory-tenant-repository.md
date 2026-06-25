# 580-inmemory-tenant-repository — In-Memory Tenant Repository Contract

## Purpose

Provides deterministic immutable repository helpers for local/dev tenant data
operations without external persistence.

## Pillar: GOVERN

## Module

`src/govern/tenant/inmemory-tenant-repository.mjs`

## API

| Function | Description |
| --- | --- |
| `initializeTenantRepository(records)` | Initializes repository state |
| `listTenants(repository)` | Returns tenant list copy |
| `getTenantById(repository, tenantId)` | Gets one tenant |
| `upsertTenantRecord(repository, payload)` | Validates and inserts/updates tenant |
| `transitionTenant(repository, tenantId, nextState, updatedAt)` | Runs lifecycle transition |
| `summarizeRepository(repository)` | Builds by-state summary |

## Notes

- Fail-closed validation for invalid payloads.
- Immutable update style for deterministic local flow testing.

## Tests

`tests/govern/inmemory-tenant-repository.test.mjs`

