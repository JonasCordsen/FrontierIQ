import test from "node:test";
import assert from "node:assert/strict";

import { evaluateGovernanceRequest } from "../../src/govern/enforcement/policy-evaluator.mjs";
import { SOLUTION_IDS } from "../../src/observe/foundation/solution-taxonomy.mjs";

const baseRequest = {
  tenantId: "tenant-1",
  solutionId: SOLUTION_IDS.M365_COPILOT,
  principalId: "spn-01",
  actionType: "deploy-agent",
  resourceId: "agent-1",
  riskBand: "high",
};

const baseContext = {
  ownerAssigned: true,
  regionCompliant: true,
  retentionConfigured: true,
  auditEnabled: true,
  raiReviewed: true,
  hasApprovalTicket: true,
};

test("allows compliant request with approval", () => {
  const result = evaluateGovernanceRequest(baseRequest, baseContext);
  assert.equal(result.effect, "allow");
  assert.equal(result.trace.decision, "allow");
});

test("denies request when audit or residency controls are missing", () => {
  const result = evaluateGovernanceRequest(baseRequest, {
    ...baseContext,
    auditEnabled: false,
    regionCompliant: false,
  });
  assert.equal(result.effect, "deny");
  assert.match(result.reasons.join(" "), /Data residency|Audit traceability/);
});

test("requires approval for high-risk permission without ticket", () => {
  const result = evaluateGovernanceRequest(
    {
      ...baseRequest,
      riskBand: "medium",
      permissionName: "Directory.ReadWrite.All",
      permissionKind: "appRole",
      actionType: "grant-permission",
    },
    {
      ...baseContext,
      hasApprovalTicket: false,
    }
  );

  assert.equal(result.effect, "require_approval");
  assert.match(result.reasons.join(" "), /requires approval ticket/);
});

test("denies unknown solution profile", () => {
  const result = evaluateGovernanceRequest(
    { ...baseRequest, solutionId: "unknown-solution" },
    baseContext
  );
  assert.equal(result.effect, "deny");
});

