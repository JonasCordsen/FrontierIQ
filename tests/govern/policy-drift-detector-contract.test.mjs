import test from "node:test";
import assert from "node:assert/strict";

import {
  detectPolicyDrift,
  summarizePolicyDrift,
  buildPolicyDriftEvidence,
} from "../../src/govern/policy/policy-drift-detector-contract.mjs";

test("detects drift between baseline and runtime", () => {
  const drifts = detectPolicyDrift(
    [{ policyId: "p1", controls: ["c1", "c2"] }],
    [{ policyId: "p1", controls: ["c2", "c3"] }]
  );
  assert.equal(drifts[0].drifted, true);
  assert.deepEqual(drifts[0].missingControls, ["c1"]);
  assert.deepEqual(drifts[0].unexpectedControls, ["c3"]);
});

test("summarizes drift status", () => {
  const drifts = detectPolicyDrift(
    [{ policyId: "p1", controls: ["c1"] }],
    [{ policyId: "p1", controls: ["c1"] }]
  );
  const summary = summarizePolicyDrift(drifts);
  assert.equal(summary.status, "ready");
  assert.equal(summary.driftedPolicies, 0);
});

test("builds drift evidence envelope", () => {
  const drifts = detectPolicyDrift([], []);
  const evidence = buildPolicyDriftEvidence(drifts, "2026-01-01T00:00:00.000Z");
  assert.equal(evidence.artifactType, "policy-drift");
});

