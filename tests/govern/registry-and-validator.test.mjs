import test from "node:test";
import assert from "node:assert/strict";

import {
  buildAgentSkillRegistry,
  queryRegistry,
} from "../../src/observe/registry/agent-skill-registry.mjs";
import {
  summarizeManifestRisk,
  validateSkillManifest,
} from "../../src/govern/validators/skill-manifest-validator.mjs";
import { SOLUTION_IDS } from "../../src/observe/foundation/solution-taxonomy.mjs";

test("agent/skill registry builds and can be queried", () => {
  const registry = buildAgentSkillRegistry([
    {
      agentId: "agent-1",
      name: "Finance Agent",
      owner: "finance-owner",
      solutionId: SOLUTION_IDS.COPILOT_STUDIO,
      riskBand: "high",
      lastAttestedAt: "2026-06-01T00:00:00Z",
      skills: [{ skillId: "s1", name: "ApproveExpense", permissionScopes: ["Mail.Send"], status: "approved" }],
    },
  ]);
  const filtered = queryRegistry(registry, { riskBand: "high" });
  assert.equal(filtered.length, 1);
});

test("skill manifest validator enforces approval for high-risk scopes", () => {
  const invalid = validateSkillManifest({
    skillId: "s1",
    name: "DangerSkill",
    owner: "owner-a",
    solutionId: SOLUTION_IDS.COPILOT_STUDIO,
    permissionScopes: ["Directory.ReadWrite.All"],
    riskBand: "high",
    testsPassed: true,
    dataSources: ["microsoft-graph"],
    modelProviders: ["microsoft"],
    responsibleAiReviewed: true,
  });
  assert.equal(invalid.ok, false);

  const valid = validateSkillManifest({
    skillId: "s2",
    name: "SafeSkill",
    owner: "owner-a",
    solutionId: SOLUTION_IDS.COPILOT_STUDIO,
    permissionScopes: ["Mail.Send"],
    riskBand: "high",
    approvalTicket: "APPR-123",
    testsPassed: true,
    dataSources: ["microsoft-graph", "teams"],
    modelProviders: ["azure-ai-foundry"],
    responsibleAiReviewed: true,
  });
  assert.equal(valid.ok, true);
  assert.ok(valid.matchedPolicyIds.includes("skill.approved-data-sources"));
});

test("manifest risk summary surfaces high risk scopes", () => {
  const summary = summarizeManifestRisk({
    permissionScopes: ["Directory.ReadWrite.All", "User.Read"],
    riskBand: "high",
  });
  assert.equal(summary.highRiskScopeCount, 1);
});
