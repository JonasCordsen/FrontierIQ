import test from "node:test";
import assert from "node:assert/strict";

import {
  buildOrganizationRoleCatalog,
  buildRaciMatrix,
  summarizeRaciReadiness,
} from "../../src/govern/operating-model/org-roles-raci.mjs";

test("builds role catalog with required cross-functional roles", () => {
  const catalog = buildOrganizationRoleCatalog();
  const roleIds = catalog.roles.map((role) => role.roleId);

  assert.equal(roleIds.includes("executive-sponsor"), true);
  assert.equal(roleIds.includes("coe-lead"), true);
  assert.equal(roleIds.includes("security-lead"), true);
  assert.equal(roleIds.includes("compliance-lead"), true);
  assert.equal(roleIds.includes("business-owner"), true);
});

test("builds RACI matrix for required workstreams", () => {
  const raci = buildRaciMatrix();
  const workstreamIds = raci.assignments.map((assignment) => assignment.workstreamId);

  assert.equal(workstreamIds.includes("agent-onboarding-approval"), true);
  assert.equal(workstreamIds.includes("incident-response"), true);
  assert.equal(workstreamIds.includes("value-and-adoption-review"), true);
});

test("RACI readiness blocks when role coverage is incomplete", () => {
  const readiness = summarizeRaciReadiness({
    roleCatalog: buildOrganizationRoleCatalog({
      roles: [{ roleId: "executive-sponsor", title: "Executive Sponsor", pillar: "optimize", ownerType: "business" }],
    }),
    raciMatrix: buildRaciMatrix(),
  });

  assert.equal(readiness.overallStatus, "blocked");
  assert.ok(readiness.failedChecks.some((code) => code.startsWith("missing-role:")));
});

test("RACI readiness blocks when assignment references unknown role", () => {
  const readiness = summarizeRaciReadiness({
    roleCatalog: buildOrganizationRoleCatalog(),
    raciMatrix: buildRaciMatrix({
      assignments: [
        {
          workstreamId: "agent-onboarding-approval",
          accountableRoleId: "nonexistent-role",
          responsibleRoleIds: ["platform-engineering-lead"],
          consultedRoleIds: [],
          informedRoleIds: [],
        },
      ],
    }),
  });

  assert.equal(readiness.overallStatus, "blocked");
  assert.ok(readiness.failedChecks.includes("unknown-accountable-role:agent-onboarding-approval:nonexistent-role"));
});

test("RACI readiness is ready with complete role and assignment coverage", () => {
  const readiness = summarizeRaciReadiness({
    roleCatalog: buildOrganizationRoleCatalog(),
    raciMatrix: buildRaciMatrix(),
  });

  assert.equal(readiness.overallStatus, "ready");
  assert.equal(readiness.failedChecks.length, 0);
});
