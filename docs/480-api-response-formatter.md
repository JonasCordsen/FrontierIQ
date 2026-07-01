# 480-api-response-formatter — API Response Formatter

## Purpose

Consistent response envelope for all FrontierIQ API endpoints.
Every response is wrapped in `{ status, data, meta, errors, pagination? }`.

## Pillar: OPTIMIZE (delivery)

## Module

`src/optimize/delivery/api-response-formatter.mjs`

## API

| Function | Description |
| --- | --- |
| `formatSuccess(opts)` | Build success envelope: status=success, data, meta, errors=[] |
| `formatError(opts)` | Build error envelope: status=error, data=null, errors normalized |
| `formatPartial(opts)` | Build partial envelope: data present but errors non-empty |
| `buildMeta(opts)` | Build meta block: version, tenantId, generatedAt, pillar? |
| `buildPagination(opts)` | Build pagination: page, pageSize, totalCount, totalPages, hasNextPage |
| `normalizeErrors(errors)` | Convert string / object / array to `{ code, message }[]` |
| `deriveStatus(data, errors)` | Infer success / error / partial from data and errors presence |

## Envelope shape

```json
{
  "status": "success",
  "data": { ... },
  "meta": {
    "version": "1.0",
    "tenantId": "...",
    "generatedAt": "...",
    "pillar": "OPTIMIZE"
  },
  "errors": [],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "totalCount": 100,
    "totalPages": 5,
    "hasNextPage": true
  }
}
```

## Tests

`tests/optimize/api-response-formatter.test.mjs`
