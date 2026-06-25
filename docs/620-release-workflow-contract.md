# 620-release-workflow-contract — Release Workflow Contract

## Purpose

Defines tagged-release CI behavior for validation and artifact publication.

## Workflow

`.github/workflows/release.yml`

## Trigger

- `push` on tags matching `v*`
- `workflow_dispatch`

## Steps

1. Checkout repository
2. Setup Node 22
3. Run `node --test`
4. Generate OpenAPI artifacts using publication contract
5. Upload artifacts:
   - `artifacts/frontieriq-openapi.json`
   - `artifacts/frontieriq-openapi-summary.json`

## Why

Ensures tagged releases are test-validated and include machine-consumable API
artifacts.

