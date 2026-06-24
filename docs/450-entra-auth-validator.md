# 450-entra-auth-validator — Entra Auth Validator

## Purpose

Validates decoded Entra ID JWT token claims and enforces tenant binding.
Fail-closed: any missing or invalid claim returns `{ valid: false }` or `{ allowed: false }`.

## Pillar: GOVERN

## Module

`src/govern/auth/entra-auth-validator.mjs`

## API

| Function | Description |
| --- | --- |
| `classifyPermissionType(claims)` | `'application'` (roles) · `'delegated'` (scp) · `'unknown'` |
| `validateTokenClaims(claims, expectedTenantId)` | Validates tid, oid, iss, tenant binding, token expiry |
| `extractGrantedScopes(claims)` | Splits scp string into scope array |
| `extractGrantedRoles(claims)` | Returns roles array from application token |
| `authorizeTokenPermissions(claims, requiredPermissions)` | Checks granted ⊇ required; returns missing list |
| `enforceAuthGate(claims, expectedTenantId, requiredPermissions)` | Single fail-closed entry point |

## Token types

| Type | Claim used | Permission check |
| --- | --- | --- |
| Application | `roles[]` | Role names must match required |
| Delegated | `scp` (space-separated) | Scope strings must match required |

## Tests

`tests/govern/entra-auth-validator.test.mjs`
