# 40-identity-permission-graph - Phase 2 foundation

This document defines the identity and permission graph introduced in Phase 2.

## Why

FrontierIQ needs one cross-solution model to answer:

1. Which principals hold which permissions?
2. Across which Microsoft AI solutions?
3. Which assignments represent high-risk blast radius?

## Model

Core records:

- `IdentityPermissionBinding` - normalized assignment input
- principal nodes
- permission nodes
- resource nodes
- edges (`principal -> permission -> resource`) with tenant + solution context

Source file:

- `src/govern/identity/identity-permission-graph.mjs`

## Inputs

The graph can be built from:

1. direct binding snapshots (identity/access exports)
2. normalized signals that contain identity dimensions

Signal-to-binding mapper:

- `src/govern/identity/from-normalized-signals.mjs`

## Risk baseline

High-risk permission rules are currently explicit baseline matchers:

- `src/secure/permissions/high-risk-rules.mjs`

This baseline is intentionally minimal and deterministic. It will be expanded under policy baseline work (#49).

## Validation

```bash
node --test tests/observe/*.test.mjs tests/govern/*.test.mjs
```

