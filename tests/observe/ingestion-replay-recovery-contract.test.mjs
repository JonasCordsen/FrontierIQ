import test from "node:test";
import assert from "node:assert/strict";

import {
  planReplayWindows,
  evaluateReplayDedupSafety,
  buildReplayRecoveryEvidence,
} from "../../src/observe/ingestion/ingestion-replay-recovery-contract.mjs";

const failures = [
  {
    sourceId: "graph-reports",
    failedAt: "2026-01-01T00:00:00.000Z",
    resumedAt: "2026-01-01T00:30:00.000Z",
    reason: "throttled",
  },
];

test("plans deterministic replay windows", () => {
  const windows = planReplayWindows(failures, 60);
  assert.equal(windows.length, 1);
  assert.equal(windows[0].plannedWindowMinutes, 30);
});

test("evaluates replay dedupe safety", () => {
  const dedupe = evaluateReplayDedupSafety([
    { sourceId: "s1", signalId: "x", fingerprint: "f1" },
    { sourceId: "s1", signalId: "x", fingerprint: "f1" },
  ]);
  assert.equal(dedupe.duplicates, 1);
  assert.equal(dedupe.status, "blocked");
});

test("builds replay recovery evidence envelope", () => {
  const windows = planReplayWindows(failures, 60);
  const dedupe = evaluateReplayDedupSafety([
    { sourceId: "s1", signalId: "x", fingerprint: "f1" },
  ]);
  const evidence = buildReplayRecoveryEvidence(windows, dedupe, "2026-01-01T01:00:00.000Z");
  assert.equal(evidence.artifactType, "ingestion-replay-recovery");
  assert.equal(evidence.summary.replayWindows, 1);
});

