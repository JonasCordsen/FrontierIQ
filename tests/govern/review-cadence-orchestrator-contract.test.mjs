import test from "node:test";
import assert from "node:assert/strict";

import {
  buildReviewCadenceSchedule,
  summarizeReviewCadenceLoad,
  buildReviewCadenceEvidence,
} from "../../src/govern/operations/review-cadence-orchestrator-contract.mjs";

const items = [
  {
    itemId: "agent-a",
    owner: "coeLead",
    cadenceDays: 30,
    lastReviewedAt: "2026-01-01T00:00:00.000Z",
    riskBand: "high",
  },
  {
    itemId: "agent-b",
    owner: "securityRepresentative",
    cadenceDays: 90,
    lastReviewedAt: "2026-01-20T00:00:00.000Z",
    riskBand: "medium",
  },
];

test("builds review cadence schedule", () => {
  const schedule = buildReviewCadenceSchedule(items, "2026-02-15T00:00:00.000Z");
  assert.equal(schedule.length, 2);
  assert.equal(schedule[0].status, "overdue");
});

test("summarizes cadence load", () => {
  const schedule = buildReviewCadenceSchedule(items, "2026-02-15T00:00:00.000Z");
  const summary = summarizeReviewCadenceLoad(schedule);
  assert.equal(summary.total, 2);
  assert.equal(summary.status, "blocked");
});

test("builds cadence evidence", () => {
  const schedule = buildReviewCadenceSchedule(items, "2026-02-15T00:00:00.000Z");
  const evidence = buildReviewCadenceEvidence(schedule, "2026-02-15T00:00:00.000Z");
  assert.equal(evidence.artifactType, "review-cadence-schedule");
});

