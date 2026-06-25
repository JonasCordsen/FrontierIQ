# 660-openapi-docs-sync-contract — OpenAPI Docs Sync Contract

## Purpose

Publishes generated OpenAPI metadata into docs index content in a deterministic
way.

## Pillar: OPTIMIZE (delivery)

## Module

`src/optimize/delivery/openapi-docs-sync-contract.mjs`

## API

| Function | Description |
| --- | --- |
| `buildOpenApiDocsLine(summary)` | Creates docs index metadata line |
| `upsertOpenApiDocsLine(readmeContent, summary)` | Adds or replaces OpenAPI metadata line |
| `buildOpenApiDocsSyncBundle(input)` | Produces publication bundle + updated docs content |

## Output

- publication bundle (`artifact` + `summary`)
- updated docs README content
- deterministic docs metadata line for `frontieriq-openapi.json`

## Tests

`tests/optimize/openapi-docs-sync-contract.test.mjs`

