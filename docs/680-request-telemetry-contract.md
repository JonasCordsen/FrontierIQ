# 680-request-telemetry-contract — Request Telemetry Contract

## Purpose

Normalized API request/response telemetry event contract for observability and
governance evidence.

## Pillar: OBSERVE

## Module

`src/observe/api/request-telemetry-contract.mjs`

## API

| Function | Description |
| --- | --- |
| `classifyRequestOutcome(statusCode)` | Classifies status into success/client_error/server_error/unknown |
| `buildRequestTelemetryEvent(input)` | Builds normalized request telemetry event |
| `buildRequestTelemetrySummary(events)` | Aggregates telemetry outcomes and latency stats |
| `buildRequestTelemetryEvidence(events, generatedAt)` | Wraps telemetry events in evidence envelope |

## Event fields

- requestId, tenantId, userId
- method, path, routePath, pillar
- statusCode, outcome, durationMs, errorCode
- generatedAt

## Tests

`tests/observe/request-telemetry-contract.test.mjs`

