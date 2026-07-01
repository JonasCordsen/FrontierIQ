import test from "node:test";
import assert from "node:assert/strict";

import {
  buildM365CopilotComplianceMatrix,
  buildM365CopilotComplianceReport,
  CERTIFICATION_IDS,
  findComplianceEvidenceGaps,
  listM365CopilotCertifications,
  summarizeM365CopilotCompliance,
} from "../../src/govern/compliance/m365-copilot-compliance.mjs";

test("compliance catalog includes core M365 Copilot certifications and commitments", () => {
  const certifications = listM365CopilotCertifications();
  assert.ok(certifications.some((entry) => entry.id === CERTIFICATION_IDS.SOC_2));
  assert.ok(certifications.some((entry) => entry.id === CERTIFICATION_IDS.ISO_42001));
  assert.ok(certifications.some((entry) => entry.id === CERTIFICATION_IDS.GDPR));
  assert.ok(certifications.some((entry) => entry.id === CERTIFICATION_IDS.EU_DATA_BOUNDARY));
});

test("compliance matrix maps certifications to controls and evidence", () => {
  const matrix = buildM365CopilotComplianceMatrix();
  assert.ok(matrix.length >= 10);
  assert.ok(matrix.every((entry) => entry.controlIds.length >= 1));
  assert.ok(matrix.every((entry) => entry.evidenceArtifacts.length >= 1));
});

test("compliance summary covers all current required controls", () => {
  const summary = summarizeM365CopilotCompliance(buildM365CopilotComplianceMatrix());
  assert.equal(summary.controlCoveragePercent, 100);
  assert.equal(summary.missingControls.length, 0);
});

test("compliance evidence gaps identify missing artifacts", () => {
  const gaps = findComplianceEvidenceGaps(buildM365CopilotComplianceMatrix(), [
    "evidence/access-review-export.json",
  ]);
  assert.ok(gaps.length >= 1);
});

test("compliance report returns summary and evidence gaps", () => {
  const report = buildM365CopilotComplianceReport({
    availableArtifacts: ["evidence/access-review-export.json"],
    generatedAt: "2026-06-24T00:00:00Z",
  });
  assert.equal(report.solutionId, "m365-copilot");
  assert.equal(report.generatedAt, "2026-06-24T00:00:00Z");
  assert.ok(report.summary.totalCertifications >= 10);
});

