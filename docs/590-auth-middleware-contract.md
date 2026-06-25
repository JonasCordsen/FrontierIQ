# 590-auth-middleware-contract — Auth Middleware Contract

## Purpose

Defines deterministic bearer extraction and route-level auth guard wrappers for
host handlers.

## Pillar: GOVERN

## Module

`src/govern/auth/auth-middleware-contract.mjs`

## API

| Function | Description |
| --- | --- |
| `extractBearerToken(header)` | Parses Bearer token from Authorization header |
| `authorizeClaimsForRoute(input)` | Runs tenant + permission gate against decoded claims |
| `authorizeRequest(request)` | Builds auth decision for request contract |
| `withAuthGuard(handler)` | Wraps handler and blocks unauthorized requests |

## Guard behavior

- Missing bearer → `bearer_missing`
- Claim/tenant mismatch and missing permissions propagated from auth validator
- Unauthorized wrapper response returns deterministic error envelope

## Tests

`tests/govern/auth-middleware-contract.test.mjs`

