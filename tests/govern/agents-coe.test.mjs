import test from "node:test";
import assert from "node:assert/strict";

import {
  buildAgentsCoeCharter,
  buildAgentsCoeOnboardingTemplate,
  buildAgentsCoeOperatingCadence,
  buildAgentsCoeRoleModel,
  summarizeAgentsCoeReadiness,
} from "../../src/govern/operating-model/agents-coe.mjs";

test("builds CoE charter with deterministic defaults", () => {
  const charter = buildAgentsCoeCharter({ organization: "Contoso" });

  assert.equal(charter.organization, "Contoso");
  assert.equal(charter.scope.length >= 4, true);
  assert.equal(charter.approvedBy, null);
});

test("builds role model with required cross-disciplinary roles", () => {
  const roles = buildAgentsCoeRoleModel();

  assert.ok(roles.assignments.securityLead);
  assert.ok(roles.assignments.complianceLead);
  assert.ok(roles.assignments.dataLead);
  assert.ok(roles.assignments.engineeringLead);
  assert.ok(roles.assignments.changeManagementLead);
});

test("builds operating cadence with weekly, monthly, and quarterly ceremonies", () => {
  const cadence = buildAgentsCoeOperatingCadence();

  assert.equal(cadence.ceremonies.length, 3);
  assert.equal(cadence.ceremonies[0].cadence, "weekly");
  assert.equal(cadence.ceremonies[1].cadence, "monthly");
});

test("builds onboarding template with required sections and approvals", () => {
  const template = buildAgentsCoeOnboardingTemplate();

  assert.equal(template.sections.length >= 5, true);
  assert.equal(template.requiredApprovals.includes("securityLead"), true);
  assert.equal(template.requiredApprovals.includes("dataLead"), true);
});

test("CoE readiness is blocked until charter is approved", () => {
  const readiness = summarizeAgentsCoeReadiness({
    charter: buildAgentsCoeCharter(),
    roles: buildAgentsCoeRoleModel(),
    cadence: buildAgentsCoeOperatingCadence(),
    onboardingTemplate: buildAgentsCoeOnboardingTemplate(),
  });

  assert.equal(readiness.overallStatus, "blocked");
  assert.ok(readiness.failedChecks.includes("charter-not-approved"));
});

test("CoE readiness is ready with approved charter and complete model", () => {
  const readiness = summarizeAgentsCoeReadiness({
    charter: buildAgentsCoeCharter({ approvedBy: "CIO" }),
    roles: buildAgentsCoeRoleModel(),
    cadence: buildAgentsCoeOperatingCadence(),
    onboardingTemplate: buildAgentsCoeOnboardingTemplate(),
  });

  assert.equal(readiness.overallStatus, "ready");
  assert.equal(readiness.failedChecks.length, 0);
});

