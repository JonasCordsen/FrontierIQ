# 460-permission-scope-checker — Permission Scope Checker

## Purpose

Maps FrontierIQ pillars to their required Microsoft Graph API permissions and
verifies that a granted permission set covers each pillar's minimum requirements.

## Pillar: GOVERN

## Module

`src/govern/auth/permission-scope-checker.mjs`

## API

| Function | Description |
| --- | --- |
| `checkPillarPermissions(pillar, grantedPermissions)` | Check coverage for a single pillar |
| `checkAllPillarPermissions(grantedPermissions)` | Check all four pillars; returns uncoveredPillars list |
| `hasPermission(permission, grantedPermissions)` | Point check for a single permission string |
| `buildScopeGapReport(checkResult)` | Human-readable gap report: requiresAction, gaps by pillar |

## Required permissions per pillar

| Pillar | Required |
| --- | --- |
| OBSERVE | `Reports.Read.All` |
| GOVERN | `Reports.Read.All`, `User.Read.All` |
| SECURE | `AuditLog.Read.All`, `User.Read.All` |
| OPTIMIZE | `Reports.Read.All`, `User.Read.All` |

## Tests

`tests/govern/permission-scope-checker.test.mjs`
