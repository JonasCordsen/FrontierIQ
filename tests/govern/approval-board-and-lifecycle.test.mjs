import test from "node:test";
import assert from "node:assert/strict";

import {
  evaluateApprovalRequest,
  listRequiredReviewers,
} from "../../src/govern/operations/approval-board.mjs";
import {
  applyLifecycleTransition,
  canTransitionLifecycle,
  findDueAttestations,
} from "../../src/govern/operations/lifecycle-attestation.mjs";

test("approval request approved when all required reviewers approve", () => {
  const reviewers = Object.fromEntries(listRequiredReviewers().map((role) => [role, "approved"]));
  const result = evaluateApprovalRequest({
    requestId: "r-1",
    title: "Enable agent write action",
    riskBand: "medium",
    requestedBy: "owner-a",
    reviewers,
    evidenceRefs: ["evidence://approval/1"],
  });
  assert.equal(result.decision, "approved");
});

test("high risk approval request escalates", () => {
  const reviewers = Object.fromEntries(listRequiredReviewers().map((role) => [role, "approved"]));
  const result = evaluateApprovalRequest({
    requestId: "r-2",
    title: "High-risk action",
    riskBand: "high",
    requestedBy: "owner-a",
    reviewers,
    evidenceRefs: ["evidence://approval/2"],
  });
  assert.equal(result.decision, "escalate");
});

test("lifecycle transition allows valid state change", () => {
  assert.equal(canTransitionLifecycle("approved", "production"), true);
  const result = applyLifecycleTransition({
    itemId: "agent-1",
    currentState: "approved",
    nextState: "production",
    changedBy: "coe-lead",
    reason: "all checks complete",
  });
  assert.equal(result.ok, true);
});

test("attestation due finder returns expired records", () => {
  const due = findDueAttestations(
    [
      { itemId: "a", owner: "x", lastAttestedAt: "2026-01-01T00:00:00Z", cadenceDays: 90 },
      { itemId: "b", owner: "y", lastAttestedAt: "2026-06-01T00:00:00Z", cadenceDays: 120 },
    ],
    "2026-06-24T00:00:00Z"
  );
  assert.equal(due.length, 1);
  assert.equal(due[0].itemId, "a");
});

