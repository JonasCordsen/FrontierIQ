import test from "node:test";
import assert from "node:assert/strict";

import {
  buildComplianceEvidenceExport,
  summarizeComplianceEvidenceExport,
  validateComplianceEvidenceExport,
} from "../../src/govern/compliance/compliance-evidence-export-contract.mjs";

test("builds deterministic compliance evidence export bundle", () => {
  const bundle = buildComplianceEvidenceExport({
    organization: "Contoso",
    availableArtifacts: ["evidence/audit-log.ndjson", "evidence/policy-catalog.json"],
    generatedAt: "2026-01-01T00:00:00.000Z",
  });

  assert.equal(bundle.generatedAt, "2026-01-01T00:00:00.000Z");
  assert.equal(bundle.artifactType, "compliance-evidence-export");
  assert.equal(bundle.organization, "Contoso");
});

test("summarizes export readiness status", () => {
  const bundle = buildComplianceEvidenceExport({
    availableArtifacts: [],
    generatedAt: "2026-01-01T00:00:00.000Z",
  });
  const summary = summarizeComplianceEvidenceExport(bundle);
  assert.equal(summary.status, "blocked");
  assert.equal(summary.missingEvidenceCount > 0, true);
});

test("validates export bundle structure", () => {
  const bundle = buildComplianceEvidenceExport({
    generatedAt: "2026-01-01T00:00:00.000Z",
  });
  const validation = validateComplianceEvidenceExport(bundle);
  assert.equal(validation.ok, true);
});

test("rejects invalid export bundle", () => {
  const validation = validateComplianceEvidenceExport({
    generatedAt: "not-a-date",
    complianceReport: {},
    auditReadinessPack: {},
  });
  assert.equal(validation.ok, false);
  if (validation.ok) return;
  assert.equal(validation.errors.length > 0, true);
});

