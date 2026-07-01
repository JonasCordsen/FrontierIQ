# 470-api-route-builder — API Route Builder

## Purpose

Typed route definitions for all FrontierIQ API endpoints, one per pillar feature.
Decouples route metadata from HTTP framework — consumers bind these definitions at startup.

## Pillar: OPTIMIZE (delivery)

## Module

`src/optimize/delivery/api-route-builder.mjs`

## API

| Function | Description |
| --- | --- |
| `buildRoute(opts)` | Build a single route definition with pillar, method, path, requiredPermissions |
| `buildAllRoutes()` | Build all 13 FrontierIQ routes across four pillars |
| `findRoute(routes, method, fullPath)` | Look up route by method + full path |
| `routesByPillar(routes, pillar)` | Filter routes to a single pillar |
| `buildRouteIndex(routes)` | Index by `METHOD:path` key for O(1) lookup |

## Routes (13 total)

| Pillar | Method | Path |
| --- | --- | --- |
| OBSERVE | GET | `/api/v1/observe/usage` |
| OBSERVE | GET | `/api/v1/observe/agents` |
| OBSERVE | POST | `/api/v1/observe/signals/correlate` |
| GOVERN | GET | `/api/v1/govern/onboarding` |
| GOVERN | GET | `/api/v1/govern/compliance` |
| GOVERN | PUT | `/api/v1/govern/remediation/:actionId` |
| SECURE | GET | `/api/v1/secure/audit` |
| SECURE | GET | `/api/v1/secure/alerts` |
| OPTIMIZE | GET | `/api/v1/optimize/scorecard` |
| OPTIMIZE | GET | `/api/v1/optimize/actions` |
| OPTIMIZE | GET | `/api/v1/optimize/briefing` |
| OPTIMIZE | GET | `/api/v1/optimize/export/powerbi` |
| OPTIMIZE | GET | `/api/v1/optimize/export/fabric` |

## Tests

`tests/optimize/api-route-builder.test.mjs`
