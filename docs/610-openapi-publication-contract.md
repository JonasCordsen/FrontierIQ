# 610-openapi-publication-contract — OpenAPI Publication Contract

## Purpose

Produces deterministic OpenAPI publication artifacts (JSON content + summary)
for docs/client workflows and release automation.

## Pillar: OPTIMIZE (delivery)

## Module

`src/optimize/delivery/openapi-publication-contract.mjs`

## API

| Function | Description |
| --- | --- |
| `buildOpenApiArtifact(input)` | Builds `frontieriq-openapi.json` artifact payload |
| `buildOpenApiPublicationSummary(artifact)` | Builds byte/route count summary |
| `buildOpenApiPublicationBundle(input)` | Returns artifact + summary together |

## Output artifacts

- `frontieriq-openapi.json`
- summary object with `routeCount`, `bytes`, and `generatedAt`

## Tests

`tests/optimize/openapi-publication-contract.test.mjs`

