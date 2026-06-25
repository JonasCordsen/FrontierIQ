# 530-tenant-management-api — Tenant Management API Contract

## Purpose

Framework-agnostic tenant management API handlers that compose existing route,
response, and governance contracts.

## Pillar: OBSERVE (API surface) + GOVERN (data domain)

## Module

`src/observe/api/tenant-management-api.mjs`

## Routes

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/v1/tenants` | List tenant records with registry summary |
| GET | `/api/v1/tenants/:tenantId` | Get one tenant |
| PUT | `/api/v1/tenants/:tenantId` | Upsert tenant record |
| GET | `/api/v1/tenants/:tenantId/readiness` | Resolve tenant readiness |

## Handler API

| Function | Description |
| --- | --- |
| `handleListTenants(...)` | Returns `success` or `partial` if invalid records are filtered |
| `handleGetTenant(...)` | Returns tenant or `tenant_not_found` |
| `handleUpsertTenant(...)` | Validates and upserts tenant payload |
| `handleTenantReadiness(...)` | Returns `ready` or `blocked` readiness state |

## Tests

`tests/observe/tenant-management-api.test.mjs`

