# 970-ingestion-replay-recovery-contract — Ingestion Replay Recovery Contract

## Purpose

Deterministic replay-window recovery planning, dedupe-safety checks, and
backlog-clearance evidence for ingestion failures.

## Pillar: OBSERVE

## Module

`src/observe/ingestion/ingestion-replay-recovery-contract.mjs`

## API

| Function | Description |
| --- | --- |
| `planReplayWindows(failures, maxWindowMinutes)` | Produces deterministic replay windows from failures |
| `evaluateReplayDedupSafety(replayItems)` | Calculates duplicate ratio and dedupe readiness |
| `buildReplayRecoveryEvidence(windows, dedupe, generatedAt)` | Builds replay recovery evidence envelope with summary |

## Tests

`tests/observe/ingestion-replay-recovery-contract.test.mjs`

