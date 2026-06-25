# 540-local-dev-server-scaffold — Local Dev Server Scaffold

## Purpose

Deterministic local server startup contract for FrontierIQ API development.

## Pillar: OPTIMIZE (delivery)

## Module

`src/optimize/delivery/local-dev-server-scaffold.mjs`

## API

| Function | Description |
| --- | --- |
| `buildDevServerConfig(overrides)` | Validated host/port/environment config |
| `buildMiddlewareStack(options)` | Deterministic middleware contract list |
| `buildDevServerStartupPlan(configOverrides)` | Startup bundle with config, route count, OpenAPI summary |

## Default config

| Key | Value |
| --- | --- |
| host | `127.0.0.1` |
| port | `7071` |
| environment | `development` |

## Tests

`tests/optimize/local-dev-server-scaffold.test.mjs`

