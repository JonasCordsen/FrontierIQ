# 600-tenant-api-smoke-fixture-runner — Tenant API Smoke Fixture Runner

## Purpose

Runs deterministic local smoke scenarios for tenant list/get/upsert/readiness
through route dispatch and handler contracts.

## Pillar: OBSERVE

## Module

`src/observe/api/tenant-api-smoke-fixture-runner.mjs`

## API

| Function | Description |
| --- | --- |
| `buildSmokeFixtures(generatedAt)` | Builds deterministic fixture set |
| `buildTenantHandlerMap()` | Builds route handler map for host dispatch |
| `runTenantApiSmoke(fixtures)` | Executes four smoke flows and returns status bundle |

## Smoke scenarios

1. list tenants
2. get tenant
3. upsert tenant
4. readiness check

## Tests

`tests/observe/tenant-api-smoke-fixture-runner.test.mjs`

