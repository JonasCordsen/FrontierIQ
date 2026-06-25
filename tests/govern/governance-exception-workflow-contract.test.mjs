import test from "node:test";
import assert from "node:assert/strict";

import {
  createExceptionRequest,
  advanceExceptionState,
  summarizeExceptionPortfolio,
} from "../../src/govern/operations/governance-exception-workflow-contract.mjs";

function createRequest() {
  const request = createExceptionRequest({
    id: "ex-1",
    tenantId: "tenant-a",
    controlId: "data.retention-policy",
    requestedBy: "coeLead",
    justification: "temporary legal hold conflict",
    expiresAt: "2026-12-31T00:00:00.000Z",
    requestedAt: "2026-01-01T00:00:00.000Z",
  });
  if (!request.ok) throw new Error("expected valid request");
  return request.request;
}

test("creates exception request", () => {
  const result = createExceptionRequest({
    id: "ex-1",
    tenantId: "tenant-a",
    controlId: "data.retention-policy",
    requestedBy: "coeLead",
    justification: "temporary legal hold conflict",
    expiresAt: "2026-12-31T00:00:00.000Z",
  });
  assert.equal(result.ok, true);
});

test("advances allowed state transitions", () => {
  const request = createRequest();
  const moved = advanceExceptionState(request, {
    to: "under_review",
    actor: "securityRepresentative",
    reason: "review started",
    at: "2026-01-02T00:00:00.000Z",
  });
  assert.equal(moved.ok, true);
  if (!moved.ok) return;
  assert.equal(moved.request.state, "under_review");
});

test("blocks invalid transition", () => {
  const request = createRequest();
  const moved = advanceExceptionState(request, {
    to: "implemented",
    actor: "coeLead",
    reason: "skip review",
    at: "2026-01-02T00:00:00.000Z",
  });
  assert.equal(moved.ok, false);
});

test("summarizes overdue exceptions", () => {
  const summary = summarizeExceptionPortfolio(
    [
      { ...createRequest(), state: "approved", expiresAt: "2026-01-10T00:00:00.000Z" },
      { ...createRequest(), id: "ex-2", state: "closed", expiresAt: "2026-01-10T00:00:00.000Z" },
    ],
    "2026-02-01T00:00:00.000Z"
  );
  assert.equal(summary.overdue, 1);
  assert.equal(summary.status, "blocked");
});

