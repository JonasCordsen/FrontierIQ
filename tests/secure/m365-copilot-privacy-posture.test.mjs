import test from "node:test";
import assert from "node:assert/strict";

import {
  buildConsentUxModel,
  buildDataResidencyMap,
  buildPrivacyControlProfile,
  buildRegionalStoragePlan,
  buildRetentionDeletionWorkflow,
  detectPiiFindings,
  evaluatePurviewLabelCoverage,
  redactSensitiveText,
  summarizePrivacyPosture,
} from "../../src/secure/privacy/m365-copilot-privacy-posture.mjs";

test("builds lesson 3 privacy profile with evidence-backed controls", () => {
  const profile = buildPrivacyControlProfile();
  assert.equal(profile.solutionId, "m365-copilot");
  assert.ok(profile.lesson3Controls.length >= 7);
});

test("detects pii, measures label coverage, and redacts sensitive text", () => {
  const findings = detectPiiFindings([
    { itemId: "item-1", text: "Contact jane@contoso.com or +45 1234 5678" },
  ]);
  const labelCoverage = evaluatePurviewLabelCoverage([
    { itemId: "item-1", dataClass: "confidential", requiredLabel: "Confidential", appliedLabel: "Confidential" },
    { itemId: "item-2", dataClass: "personal", requiredLabel: "Personal", appliedLabel: "General" },
  ]);
  const redacted = redactSensitiveText("jane@contoso.com +45 1234 5678");

  assert.equal(findings.length, 2);
  assert.equal(labelCoverage.coveragePercent, 50);
  assert.match(redacted, /REDACTED_EMAIL/);
});

test("summarizes privacy posture across residency, purview, pii, consent, and retention", () => {
  const residencyMap = buildDataResidencyMap({
    tenantId: "tenant-a",
    defaultRegion: "EU",
    workloads: [
      { workload: "M365 Copilot", region: "EU", dataBoundary: "EU Data Boundary" },
      { workload: "Purview", region: "EU", dataBoundary: "EU Data Boundary" },
    ],
  });
  const storagePlan = buildRegionalStoragePlan({
    tenantId: "tenant-a",
    defaultRegion: "EU",
    datasets: [
      { datasetId: "d1", dataClass: "usage", targetRegion: "EU", storageType: "log-analytics" },
    ],
  });
  const consent = buildConsentUxModel({
    adminExperience: "Admin center onboarding",
    userExperience: "Copilot welcome panel",
    contactChannel: "privacy@contoso.com",
  });
  const labelCoverage = evaluatePurviewLabelCoverage([
    { itemId: "item-1", dataClass: "confidential", requiredLabel: "Confidential", appliedLabel: "Confidential" },
  ]);
  const retentionWorkflow = buildRetentionDeletionWorkflow([
    { recordType: "audit-log", retentionDays: 180 },
    { recordType: "investigation-case", retentionDays: 365, legalHold: true },
  ]);
  const summary = summarizePrivacyPosture({
    residencyMap,
    labelCoverage,
    piiFindings: [],
    retentionWorkflow,
  });

  assert.equal(storagePlan.placements[0].alignedToDefaultRegion, true);
  assert.match(consent.userNotice, /prompt logging/i);
  assert.equal(summary.residencyAligned, true);
  assert.equal(summary.failedChecks.length, 0);
});

