# 570-api-host-adapter — API Host Adapter Contract

## Purpose

Maps API route contracts to handler execution with deterministic route matching
and standardized error envelopes.

## Pillar: OBSERVE (delivery integration)

## Module

`src/observe/api/api-host-adapter.mjs`

## API

| Function | Description |
| --- | --- |
| `matchRoutePath(routePath, requestPath)` | Matches static/dynamic paths and extracts `:params` |
| `resolveRoute(routes, method, requestPath)` | Resolves route + params for incoming request |
| `buildHandlerKey(method, routePath)` | Builds `METHOD:path` handler key |
| `dispatchApiRequest(input)` | Dispatches request to matched handler or returns deterministic error |

## Error contracts

- `route_not_found`
- `handler_not_registered`

## Tests

`tests/observe/api-host-adapter.test.mjs`

