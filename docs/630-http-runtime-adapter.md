# 630-http-runtime-adapter — HTTP Runtime Adapter Contract

## Purpose

Composable request pipeline contract that binds route resolution, auth decisions,
handler dispatch, and request telemetry.

## Pillar: OBSERVE

## Module

`src/observe/api/http-runtime-adapter.mjs`

## API

| Function | Description |
| --- | --- |
| `inferStatusCode(response)` | Maps response envelopes to HTTP-like status codes |
| `executeRuntimeRequest(input)` | Executes route resolution → auth → dispatch and returns response + telemetry |

## Notes

- Auth failures are surfaced as deterministic error responses.
- Unknown routes still produce telemetry with `route_not_found`.
- Telemetry is emitted for all execution outcomes.

## Tests

`tests/observe/http-runtime-adapter.test.mjs`

