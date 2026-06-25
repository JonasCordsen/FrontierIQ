# 790-tenant-insights-api-contract — Tenant Insights API Contract

## Purpose

Deterministic API payload contract that combines tenant trend, cost,
performance, and briefing outputs into one unified insight response.

## Pillar: OBSERVE

## Module

`src/observe/api/tenant-insights-api-contract.mjs`

## API

| Function | Description |
| --- | --- |
| `buildTenantInsightsPayload(input)` | Builds unified tenant insights payload from contract summaries |
| `validateTenantInsightsPayload(payload)` | Validates payload shape and required sections |
| `buildTenantInsightsResponse(payload)` | Produces success/error API response envelope |

## Tests

`tests/observe/tenant-insights-api-contract.test.mjs`

