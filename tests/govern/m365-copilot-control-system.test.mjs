import test from "node:test";
import assert from "node:assert/strict";

import {
  buildByoEntraOnboardingPackage,
  buildCiCdComplianceBundle,
  buildCopilotControlSystemProfile,
  buildKeyVaultRotationPlan,
  buildPolicyAsCodeCatalog,
  summarizeControlSystemPosture,
  validateRoleAssignments,
} from "../../src/govern/control-system/m365-copilot-control-system.mjs";

test("builds lesson 2 control-system profile with integrated evidence artifacts", () => {
  const profile = buildCopilotControlSystemProfile();
  assert.equal(profile.solutionId, "m365-copilot");
  assert.ok(profile.lesson2Controls.length >= 7);
  assert.ok(profile.lesson2Controls.every((control) => control.evidenceArtifacts.length >= 1));
});

test("flags invalid high-risk role assignments for segregated roles", () => {
  const result = validateRoleAssignments([
    { principalId: "user-1", role: "reviewer", assignedRole: "Owner" },
  ]);
  assert.equal(result.ok, false);
  assert.match(result.errors[0], /cannot hold high-risk role/i);
});

test("builds onboarding, rotation, and CI/CD control posture summaries", () => {
  const onboarding = buildByoEntraOnboardingPackage({
    tenantId: "contoso.onmicrosoft.com",
    clientId: "11111111-1111-1111-1111-111111111111",
    redirectUri: "https://frontieriq.example.com/auth/callback",
    scopes: ["https://graph.microsoft.com/.default"],
  });
  const keyVaultPlan = buildKeyVaultRotationPlan({ vaultName: "contoso-frontieriq-kv" });
  const policyCatalog = buildPolicyAsCodeCatalog();
  const ciCd = buildCiCdComplianceBundle({
    manifests: [
      {
        skillId: "skill-1",
        name: "M365 Copilot Governance",
        owner: "coeLead",
        solutionId: "m365-copilot",
        permissionScopes: ["User.Read.All"],
        riskBand: "medium",
        testsPassed: true,
        dataSources: ["microsoft-graph"],
        modelProviders: ["microsoft"],
        responsibleAiReviewed: true,
      },
    ],
    assignments: [
      { principalId: "user-2", role: "securityOperator", assignedRole: "Privileged Role Administrator" },
    ],
  });
  const summary = summarizeControlSystemPosture({
    manifests: [
      {
        skillId: "skill-1",
        name: "M365 Copilot Governance",
        owner: "coeLead",
        solutionId: "m365-copilot",
        permissionScopes: ["User.Read.All"],
        riskBand: "medium",
        testsPassed: true,
        dataSources: ["microsoft-graph"],
        modelProviders: ["microsoft"],
        responsibleAiReviewed: true,
      },
    ],
    assignments: [
      { principalId: "user-2", role: "securityOperator", assignedRole: "Privileged Role Administrator" },
    ],
    onboardingPackage: onboarding,
    keyVaultPlan,
  });

  assert.match(onboarding.adminConsentUrl, /adminconsent/);
  assert.equal(keyVaultPlan.vaultName, "contoso-frontieriq-kv");
  assert.equal(policyCatalog.policies.length >= 8, true);
  assert.equal(policyCatalog.policyVersion, "2026.06.1");
  assert.equal(ciCd.passed, true);
  assert.equal(summary.roleAssignmentsValid, true);
  assert.equal(summary.onboardingReady, true);
});
