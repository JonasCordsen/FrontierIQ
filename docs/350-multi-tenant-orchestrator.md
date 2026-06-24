# 350-multi-tenant-orchestrator — Multi-Tenant Orchestrator

## Purpose

Deterministic contracts for scheduling and sequencing Graph API calls across
multiple tenants. Fail-closed: tenants without credentials are skipped, never
block others.

## Pillar: OBSERVE (primary) / GOVERN

## Module

`src/observe/graph/multi-tenant-orchestrator.mjs`

## API

| Function | Description |
| --- | --- |
| `classifyTenantPriority(meta)` | Returns `urgent / standard / low` based on incident, new status, and tier |
| `buildTenantQueue(tenants)` | Ordered execution queue; excludes uncredentialed tenants |
| `applyRateLimitPolicy(queue, policy?)` | Applies delay slots, retry budget, and backoff |
| `buildOrchestrationSummary(results)` | Counts ok/error/skipped, successRate, health band |
| `checkOrchestratorReadiness(config)` | Fail-closed check for tenant list and permission |

## Priority order

`urgent` → `standard` → `low`

Urgent triggers: `hasOpenIncident: true`, `isNew: true`

## Health bands

| successRate | health |
| --- | --- |
| ≥ 95% | healthy |
| 80–94% | degraded |
| < 80% | critical |

## Tests

`tests/observe/multi-tenant-orchestrator.test.mjs` — 26 assertions
