import test from "node:test";
import assert from "node:assert/strict";

import {
  buildAuditReadinessPack,
  buildComplianceGapAnalysis,
  buildEvidenceCollectionPlan,
} from "../../src/govern/compliance/audit-readiness.mjs";

test("gap analysis returns remediation actions for missing artifacts", () => {
  const result = buildComplianceGapAnalysis({
    availableArtifacts: ["evidence/access-review-export.json"],
  });
  assert.ok(result.controlGaps.length >= 1);
  assert.ok(result.remediationActions.length >= 1);
});

test("evidence collection plan includes known artifact automation defaults", () => {
  const plan = buildEvidenceCollectionPlan({
    availableArtifacts: ["evidence/access-review-export.json"],
    additionalArtifacts: ["evidence/keyvault-rotation-plan.json"],
  });
  const auditLog = plan.find((item) => item.artifact === "evidence/audit-log.ndjson");
  assert.equal(auditLog?.automationType, "log-export");
  const accessReview = plan.find((item) => item.artifact === "evidence/access-review-export.json");
  assert.equal(accessReview?.present, true);
  const keyVaultPlan = plan.find((item) => item.artifact === "evidence/keyvault-rotation-plan.json");
  assert.equal(keyVaultPlan?.automationType, "configuration-snapshot");
  const siemRouting = plan.find((item) => item.artifact === "evidence/siem-alert-routing.json");
  assert.equal(siemRouting?.automationType, "route-export");
});

test("audit readiness pack combines operating model, compliance, and readiness score", () => {
  const pack = buildAuditReadinessPack({
    organization: "FrontierIQ Test Tenant",
    generatedAt: "2026-06-24T00:00:00Z",
    availableArtifacts: [
      "evidence/access-review-export.json",
      "evidence/owner-registry.csv",
      "evidence/audit-log.ndjson",
    ],
  });
  assert.equal(pack.generatedAt, "2026-06-24T00:00:00Z");
  assert.equal(pack.operatingModelKit.organization, "FrontierIQ Test Tenant");
  assert.ok(pack.auditChecklist.length >= 3);
  assert.ok(pack.readinessScore >= 0);
  assert.ok(pack.readinessScore < 100);
});
