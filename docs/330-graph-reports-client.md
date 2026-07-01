# 330-graph-reports-client — Graph Reports Client

## Purpose

On-demand request builders and response validators for the Microsoft Graph
M365 Copilot usage reporting endpoints. No HTTP is performed — all functions
return deterministic request descriptors or validation results.

## Pillar: OBSERVE

## Module

`src/observe/graph/reports-client.mjs`

## API

| Function | Description |
| --- | --- |
| `listSupportedPeriods()` | Returns `['D7','D30','D90','D180']` |
| `isSupportedPeriod(period)` | Boolean period check |
| `buildUsageDetailRequest(tenantId, period, opts?)` | Builds request descriptor for `getMicrosoft365CopilotUsageUserDetail` |
| `buildUserCountSummaryRequest(tenantId, period)` | Builds request descriptor for `getMicrosoft365CopilotUserCountSummary` |
| `validateUsageDetailResponse(payload)` | Validates and normalizes usage detail response |
| `validateUserCountSummaryResponse(payload)` | Validates and normalizes user count summary response |
| `checkClientReadiness(config)` | Fail-closed readiness check (tenantId, credential, Reports.Read.All) |

## Graph endpoints

- `GET /v1.0/reports/getMicrosoft365CopilotUsageUserDetail(period='D30')`
- `GET /v1.0/reports/getMicrosoft365CopilotUserCountSummary(period='D30')`

## Fail-closed rules

- Missing `tenantId` → `invalid_input` error
- Unsupported period → `invalid_input` error
- Response missing required fields → `validation_error` per record
- Non-object payload → `invalid_payload` error

## Tests

`tests/observe/graph-reports-client.test.mjs` — 28 assertions
