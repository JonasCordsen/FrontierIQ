import test from "node:test";
import assert from "node:assert/strict";

import {
  registerGovernanceWaiver,
  enforceWaiverExpiry,
  summarizeWaiverRegistry,
} from "../../src/govern/operations/governance-waiver-registry-contract.mjs";

const waiverInput = {
  waiverId: "w-1",
  tenantId: "t1",
  controlId: "data.retention-policy",
  owner: "coeLead",
  justification: "migration window",
  expiresAt: "2026-01-31T00:00:00.000Z",
};

test("registers governance waiver", () => {
  const result = registerGovernanceWaiver(waiverInput);
  assert.equal(result.ok, true);
});

test("enforces waiver expiry", () => {
  const result = registerGovernanceWaiver(waiverInput);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const enforced = enforceWaiverExpiry([result.waiver], "2026-02-01T00:00:00.000Z");
  assert.equal(enforced[0].state, "expired");
});

test("summarizes waiver registry", () => {
  const summary = summarizeWaiverRegistry([
    { ...waiverInput, state: "active" },
    { ...waiverInput, waiverId: "w-2", state: "expired" },
  ]);
  assert.equal(summary.total, 2);
  assert.equal(summary.status, "blocked");
});

