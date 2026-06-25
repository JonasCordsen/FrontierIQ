# 520-tenant-access-resolver — Tenant Access Resolver

## Purpose

Fail-closed tenant authorization checks using platform roles, pillar access, and
route-level required permission checks.

## Pillar: GOVERN

## Module

`src/govern/tenant/tenant-access-resolver.mjs`

## API

| Function | Description |
| --- | --- |
| `resolvePillarAccess(userContext)` | Resolves effective pillar coverage from roles |
| `authorizeTenantPillar(userContext, tenantId, pillar)` | Validates tenant match and role-based pillar access |
| `authorizeRouteAccess(userContext, tenantId, route, grantedPermissions)` | Combines pillar and permission checks |
| `buildAccessSummary(decisions)` | Aggregates allow/deny decisions and denial reasons |

## Role examples

| Role | Pillars |
| --- | --- |
| `GlobalAdmin` | OBSERVE, GOVERN, SECURE, OPTIMIZE |
| `SecurityAdmin` | OBSERVE, SECURE |
| `Reader` | OBSERVE |

## Tests

`tests/govern/tenant-access-resolver.test.mjs`

