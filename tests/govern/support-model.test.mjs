import test from "node:test";
import assert from "node:assert/strict";

import {
  buildEscalationPolicy,
  buildSlaCatalog,
  buildSupportTierModel,
  summarizeSupportModelReadiness,
} from "../../src/govern/operations/support-model.mjs";

test("builds L1 L2 L3 support tiers with deterministic responsibilities", () => {
  const model = buildSupportTierModel();

  const tiers = model.tiers.map((tier) => tier.tierId);
  assert.equal(tiers.includes("l1"), true);
  assert.equal(tiers.includes("l2"), true);
  assert.equal(tiers.includes("l3"), true);
});

test("builds escalation policy for sev1 sev2 sev3", () => {
  const escalation = buildEscalationPolicy();

  const severities = escalation.policies.map((policy) => policy.severity);
  assert.equal(severities.includes("sev1"), true);
  assert.equal(severities.includes("sev2"), true);
  assert.equal(severities.includes("sev3"), true);
});

test("builds SLA catalog with positive response and mitigation targets", () => {
  const slaCatalog = buildSlaCatalog();

  for (const target of slaCatalog.targets) {
    assert.equal(target.firstResponseMinutes > 0, true);
    assert.equal(target.mitigationMinutes > 0, true);
    assert.equal(target.updateCadenceMinutes > 0, true);
  }
});

test("support model readiness blocks when SLA target is invalid", () => {
  const readiness = summarizeSupportModelReadiness({
    supportModel: buildSupportTierModel(),
    escalationPolicy: buildEscalationPolicy(),
    slaCatalog: buildSlaCatalog({
      targets: [{ severity: "sev1", firstResponseMinutes: 0, mitigationMinutes: 120, updateCadenceMinutes: 30 }],
    }),
  });

  assert.equal(readiness.overallStatus, "blocked");
  assert.ok(readiness.failedChecks.includes("invalid-first-response:sev1"));
  assert.ok(readiness.failedChecks.includes("missing-sla-target:sev2"));
});

test("support model readiness blocks when escalation path starts at wrong tier", () => {
  const readiness = summarizeSupportModelReadiness({
    supportModel: buildSupportTierModel(),
    escalationPolicy: buildEscalationPolicy({
      policies: [
        {
          severity: "sev1",
          startsAtTier: "l2",
          escalationPath: ["l1", "l3"],
          notifyRoles: ["securityLead"],
          requiresWarRoom: true,
        },
        {
          severity: "sev2",
          startsAtTier: "l1",
          escalationPath: ["l1", "l2"],
          notifyRoles: ["platformOperator"],
          requiresWarRoom: false,
        },
        {
          severity: "sev3",
          startsAtTier: "l1",
          escalationPath: ["l1"],
          notifyRoles: ["serviceDeskAnalyst"],
          requiresWarRoom: false,
        },
      ],
    }),
    slaCatalog: buildSlaCatalog(),
  });

  assert.equal(readiness.overallStatus, "blocked");
  assert.ok(readiness.failedChecks.includes("invalid-escalation-start-tier:sev1"));
});

test("support model readiness is ready with complete tier escalation and SLA coverage", () => {
  const readiness = summarizeSupportModelReadiness({
    supportModel: buildSupportTierModel(),
    escalationPolicy: buildEscalationPolicy(),
    slaCatalog: buildSlaCatalog(),
  });

  assert.equal(readiness.overallStatus, "ready");
  assert.equal(readiness.failedChecks.length, 0);
});
