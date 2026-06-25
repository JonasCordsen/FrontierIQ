import test from "node:test";
import assert from "node:assert/strict";

import {
  evaluateGovernanceRules,
  explainGovernanceRuleDecision,
  buildGovernanceRuleEvidence,
} from "../../src/govern/operations/governance-rules-engine-contract.mjs";

test("approves request when controls and reviewers satisfy mapping", () => {
  const decision = evaluateGovernanceRules({
    assetType: "agent",
    riskScore: 35,
    controlsPresent: [
      "access.least-privilege",
      "access.owner-accountability",
      "governance.approval-gates",
      "audit.traceability",
      "data.residency-enforcement",
      "data.retention-policy",
      "regional.storage-alignment",
      "secrets.rotation",
      "identity.byo-entra-onboarding",
      "rai.review-required",
    ],
    reviewersPresent: ["coeLead", "securityRepresentative"],
    requestedReviewGate: "standard-review",
  });

  assert.equal(decision.allowed, true);
  assert.equal(decision.status, "approved");
});

test("blocks request when required controls are missing", () => {
  const decision = evaluateGovernanceRules({
    assetType: "agent",
    riskScore: 55,
    controlsPresent: ["access.least-privilege"],
    reviewersPresent: ["coeLead", "securityRepresentative", "complianceRepresentative"],
    requestedReviewGate: "governance-board",
  });

  assert.equal(decision.allowed, false);
  assert.equal(decision.reasonCodes.some((code) => code.startsWith("missing-control:")), true);
});

test("blocks unknown rule ids fail-closed", () => {
  const decision = evaluateGovernanceRules({
    assetType: "skill",
    riskScore: 20,
    controlsPresent: [],
    reviewersPresent: [],
    enabledRules: ["risk-band-resolution", "not-supported"],
  });

  assert.equal(decision.allowed, false);
  assert.ok(decision.reasonCodes.includes("unknown-rule:not-supported"));
});

test("provides explanation and evidence envelope", () => {
  const decision = evaluateGovernanceRules({
    assetType: "skill",
    riskScore: 80,
    controlsPresent: [],
    reviewersPresent: [],
  });
  const explanation = explainGovernanceRuleDecision(decision);
  const evidence = buildGovernanceRuleEvidence(decision, "2026-01-01T00:00:00.000Z");

  assert.match(explanation, /Blocked skill governance request/);
  assert.equal(evidence.artifactType, "governance-rule-decision");
});
