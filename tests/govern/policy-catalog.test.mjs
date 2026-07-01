import test from "node:test";
import assert from "node:assert/strict";

import {
  buildPolicyCatalog,
  evaluateIngestionPolicies,
  evaluateSkillManifestPolicies,
  evaluateTenantOnboardingPolicies,
  getPolicyIdsForControl,
  validatePolicyCatalog,
} from "../../src/govern/policy/policy-catalog.mjs";
import { CONTROL_IDS } from "../../src/govern/policy/control-catalog.mjs";

test("policy catalog is valid and exposes control-linked policy ids", () => {
  const catalog = buildPolicyCatalog();
  const validation = validatePolicyCatalog(catalog);
  const approvalPolicies = getPolicyIdsForControl(catalog, CONTROL_IDS.APPROVAL_GATES);

  assert.equal(validation.ok, true);
  assert.ok(catalog.policies.length >= 8);
  assert.ok(approvalPolicies.includes("skill.high-risk-approval"));
  assert.ok(approvalPolicies.includes("tenant.high-risk-approval"));
});

test("skill manifest policy evaluation fails closed for unapproved sources and providers", () => {
  const result = evaluateSkillManifestPolicies({
    skillId: "skill-a",
    name: "Skill A",
    owner: "owner-a",
    solutionId: "m365-copilot",
    permissionScopes: ["User.Read.All"],
    riskBand: "medium",
    testsPassed: true,
    dataSources: ["unknown-source"],
    modelProviders: ["unknown-provider"],
    responsibleAiReviewed: true,
  });

  assert.equal(result.ok, false);
  assert.ok(result.violatedPolicyIds.includes("skill.approved-data-sources"));
  assert.ok(result.violatedPolicyIds.includes("skill.approved-model-providers"));
});

test("tenant onboarding and ingestion policy evaluation share the catalog contract", () => {
  const tenantResult = evaluateTenantOnboardingPolicies({
    solutionId: "m365-copilot",
    approvalTicket: "ADO-123",
    permissions: [
      {
        appRoles: ["Reports.Read.All"],
        delegatedScopes: [],
      },
    ],
    resources: [
      { type: "Microsoft.KeyVault/vaults" },
      { type: "Microsoft.Storage/storageAccounts" },
    ],
  });
  const ingestionResult = evaluateIngestionPolicies({
    solutionId: "m365-copilot",
    sourceSystem: "microsoft-scenario-library",
    storageProvider: "onelake",
    retentionClass: "short-term",
    retentionDays: 14,
  });

  assert.equal(tenantResult.ok, true);
  assert.equal(tenantResult.policyVersion, "2026.06.1");
  assert.equal(ingestionResult.ok, true);
  assert.ok(ingestionResult.matchedPolicyIds.includes("ingestion.retention-and-storage"));
});
