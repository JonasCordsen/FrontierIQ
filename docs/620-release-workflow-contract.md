# 620-release-workflow-contract — Release Workflow Contract

## Purpose

Defines tagged-release CI behavior for validation and artifact publication.

## Workflow

`.github/workflows/release.yml`

## Trigger

- `push` on tags matching `v*`

## Steps

1. Checkout repository
2. Setup Node 22
3. Run `node --test`
4. Generate OpenAPI artifacts using publication contract
5. Upload artifacts:
   - `artifacts/frontieriq-openapi.json`
   - `artifacts/frontieriq-openapi-summary.json`
6. Retain workflow artifacts for 30 days

## Hardening notes

- Uses workflow-level `contents: read` permissions
- Pins third-party actions to full commit SHAs
- Disables persisted checkout credentials
- Accepts release validation only from matching tag pushes

## Why

Ensures tagged releases are test-validated and include machine-consumable API
artifacts.
