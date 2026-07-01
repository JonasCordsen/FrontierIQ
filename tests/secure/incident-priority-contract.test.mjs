import test from "node:test";
import assert from "node:assert/strict";

import {
  calculateOversharePriority,
  rankOvershareIncidents,
  summarizeOversharePriorityQueue,
} from "../../src/secure/overshare/incident-priority-contract.mjs";

const incidents = [
  {
    id: "inc-1",
    severity: "high",
    affectedUsers: 120,
    dataClassifications: ["confidential", "restricted"],
    exposureType: "external_share",
  },
  {
    id: "inc-2",
    severity: "medium",
    affectedUsers: 15,
    dataClassifications: ["internal"],
    exposureType: "broad_internal",
  },
];

test("calculates deterministic priority score", () => {
  const priority = calculateOversharePriority(incidents[0]);
  assert.equal(priority.priorityScore > 0, true);
  assert.equal(["critical", "high", "medium", "low"].includes(priority.priorityBand), true);
});

test("ranks incidents by priority descending", () => {
  const ranked = rankOvershareIncidents(incidents);
  assert.equal(ranked[0].id, "inc-1");
  assert.equal(ranked[0].priorityScore >= ranked[1].priorityScore, true);
});

test("summarizes queue bands and top incident", () => {
  const summary = summarizeOversharePriorityQueue(incidents);
  assert.equal(summary.total, 2);
  assert.equal(summary.topIncident.id, "inc-1");
});

