# 410-remediation-tracker — Remediation Tracker

## Purpose

Lifecycle tracker for coach actions from open through verification. Fail-closed:
evidence is required before resolution can be verified.

## Pillar: OPTIMIZE

## Module

`src/optimize/delivery/remediation-tracker.mjs`

## State machine

```
open → acknowledged → resolved → verified
         ↑___________|
```

Terminal state: `verified`. Transition `verified → *` is blocked.

## API

| Function | Description |
| --- | --- |
| `createRemediationRecord(action)` | Create record with status=open |
| `acknowledgeAction(record, assignee)` | open → acknowledged; requires assignee |
| `resolveAction(record, evidence)` | acknowledged → resolved; requires evidence reference |
| `verifyResolution(record)` | resolved → verified; fails if evidence is missing |
| `buildRemediationSummary(records, now?)` | Count by status, overdue list, mean time to resolve |

## Overdue thresholds

| Status | Overdue after |
| --- | --- |
| open | 72 hours |
| acknowledged | 168 hours |
| resolved | 48 hours |

## Tests

`tests/optimize/remediation-tracker.test.mjs`
