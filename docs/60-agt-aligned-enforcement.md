# 60-agt-aligned-enforcement - Deterministic governance decisions

This document defines the AGT-aligned enforcement layer added in Phase 2.

## Objective

Introduce deterministic governance decision points that are:

- fail-closed for critical control violations
- explicit about allow/deny/require-approval outcomes
- traceable through structured audit records

## Source files

- `src/govern/enforcement/policy-evaluator.mjs`
- `src/govern/enforcement/audit-trace.mjs`
- `src/govern/enforcement/index.mjs`

## Decision model

Input:

- request context (`tenantId`, `solutionId`, `principalId`, action, risk)
- governance context (owner assignment, residency, retention, audit, RAI review, approval ticket)

Output:

- `effect`: `allow` | `deny` | `require_approval`
- `reasons[]`
- `missingControls[]`
- `trace` (deterministic decision record)

## Fail-closed behavior

Requests are denied when critical controls are missing:

- data residency enforcement
- audit traceability

Requests require approval when risk requires approval gates and no approval ticket is present.

## Alignment intent

This layer is AGT-aligned at architecture level:

- deterministic policy evaluation point before action execution
- explicit decision object
- immutable-style trace record for evidence pipelines

It is intentionally lightweight and local to FrontierIQ's current MVP foundation.

## Validation

```bash
node --test tests/observe/*.test.mjs tests/govern/*.test.mjs
```

