import test from "node:test";
import assert from "node:assert/strict";

import {
  appendWaiverAuditEvent,
  buildWaiverApprovalLineage,
  summarizeWaiverAuditTrail,
} from "../../src/govern/operations/governance-waiver-audit-trail-contract.mjs";

const TS = "2026-01-01T00:00:00.000Z";

test("appends valid audit event", () => {
  const result = appendWaiverAuditEvent([], {
    waiverId: "w-1",
    eventType: "created",
    actor: "owner-a",
    at: TS,
  });
  assert.equal(result.ok, true);
  assert.equal(result.trail.length, 1);
});

test("rejects invalid audit event", () => {
  const result = appendWaiverAuditEvent([], {
    waiverId: "w-1",
    eventType: "unknown",
    actor: "owner-a",
    at: TS,
  });
  assert.equal(result.ok, false);
  assert.equal(result.errors.length > 0, true);
});

test("builds waiver approval lineage and summary", () => {
  const trail = [
    { waiverId: "w-1", eventType: "created", actor: "owner-a", at: TS, reason: null },
    { waiverId: "w-1", eventType: "approved", actor: "approver-a", at: "2026-01-02T00:00:00.000Z", reason: null },
  ];
  const lineage = buildWaiverApprovalLineage(trail, "w-1");
  const summary = summarizeWaiverAuditTrail(trail);
  assert.equal(lineage.events.length, 2);
  assert.equal(lineage.approvers[0], "approver-a");
  assert.equal(summary.totalWaivers, 1);
});

