# 550-openapi-spec-builder — OpenAPI Spec Builder

## Purpose

Generates deterministic OpenAPI 3.1 documents from FrontierIQ route contracts.

## Pillar: OPTIMIZE (delivery)

## Module

`src/optimize/delivery/openapi-spec-builder.mjs`

## API

| Function | Description |
| --- | --- |
| `toOpenApiPath(path)` | Converts `:param` route segments to `{param}` |
| `buildPathParameters(pathParams)` | Builds OpenAPI path parameter objects |
| `buildQueryParameters(queryParams)` | Builds OpenAPI query parameter objects |
| `buildOperation(route)` | Builds OpenAPI operation object with tags/security/responses |
| `buildOpenApiSpec(input)` | Builds full OpenAPI 3.1 document from routes |

## Output notes

- OpenAPI version: `3.1.0`
- Security scheme: OAuth2 client credentials (`entraBearerAuth`)
- Paths generated from route contracts

## Tests

`tests/optimize/openapi-spec-builder.test.mjs`

