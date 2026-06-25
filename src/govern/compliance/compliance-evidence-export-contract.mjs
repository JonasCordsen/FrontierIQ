/**
 * Compliance evidence export contract.
 * Pillar: GOVERN
 *
 * Deterministic export bundle for compliance signals and audit-readiness
 * artifacts used in attestation workflows.
 */

import { buildAuditReadinessPack } from "./audit-readiness.mjs";
import { buildM365CopilotComplianceReport } from "./m365-copilot-compliance.mjs";

const DETERMINISTIC_GENERATED_AT = "1970-01-01T00:00:00.000Z";

/**
 * Build compliance evidence export bundle.
 * @param {{
 *   organization?: string;
 *   availableArtifacts?: string[];
 *   additionalArtifacts?: string[];
 *   generatedAt?: string;
 * }} input
 * @returns {object}
 */
export function buildComplianceEvidenceExport(input = {}) {
  const generatedAt = input.generatedAt ?? DETERMINISTIC_GENERATED_AT;
  const availableArtifacts = Array.isArray(input.availableArtifacts) ? input.availableArtifacts : [];
  const additionalArtifacts = Array.isArray(input.additionalArtifacts) ? input.additionalArtifacts : [];

  const complianceReport = buildM365CopilotComplianceReport({
    availableArtifacts,
    generatedAt,
  });
  const auditReadinessPack = buildAuditReadinessPack({
    organization: input.organization,
    availableArtifacts,
    additionalArtifacts,
    generatedAt,
  });

  return {
    exportVersion: "2026.06.1",
    artifactType: "compliance-evidence-export",
    generatedAt,
    organization: input.organization ?? "FrontierIQ",
    complianceReport,
    auditReadinessPack,
    evidenceArtifacts: [
      ...new Set(
        auditReadinessPack.evidenceCollectionPlan
          .filter((item) => item.present)
          .map((item) => item.artifact)
      ),
    ].sort((left, right) => left.localeCompare(right)),
    missingEvidenceArtifacts: [
      ...new Set(
        auditReadinessPack.evidenceCollectionPlan
          .filter((item) => !item.present)
          .map((item) => item.artifact)
      ),
    ].sort((left, right) => left.localeCompare(right)),
  };
}

/**
 * Summarize export readiness.
 * @param {ReturnType<typeof buildComplianceEvidenceExport>} exportBundle
 * @returns {object}
 */
export function summarizeComplianceEvidenceExport(exportBundle) {
  const evidenceCount = Array.isArray(exportBundle?.evidenceArtifacts) ? exportBundle.evidenceArtifacts.length : 0;
  const missingCount = Array.isArray(exportBundle?.missingEvidenceArtifacts)
    ? exportBundle.missingEvidenceArtifacts.length
    : 0;

  return {
    exportVersion: exportBundle?.exportVersion ?? "unknown",
    generatedAt: exportBundle?.generatedAt ?? null,
    certifications: exportBundle?.complianceReport?.summary?.totalCertifications ?? 0,
    readinessScore: exportBundle?.auditReadinessPack?.readinessScore ?? 0,
    evidenceCount,
    missingEvidenceCount: missingCount,
    status: missingCount === 0 ? "ready" : "blocked",
  };
}

/**
 * Validate export bundle integrity.
 * @param {ReturnType<typeof buildComplianceEvidenceExport>} exportBundle
 * @returns {{ ok: true } | { ok: false, errors: string[] }}
 */
export function validateComplianceEvidenceExport(exportBundle) {
  const errors = [];
  if (!exportBundle || typeof exportBundle !== "object") errors.push("export bundle is required");
  if (!exportBundle?.generatedAt || Number.isNaN(Date.parse(exportBundle.generatedAt))) {
    errors.push("generatedAt must be a valid ISO timestamp");
  }
  if (!exportBundle?.complianceReport?.summary) errors.push("complianceReport.summary is required");
  if (!exportBundle?.auditReadinessPack || typeof exportBundle.auditReadinessPack.readinessScore !== "number") {
    errors.push("auditReadinessPack.readinessScore is required");
  }
  if (!Array.isArray(exportBundle?.evidenceArtifacts)) errors.push("evidenceArtifacts must be an array");
  if (!Array.isArray(exportBundle?.missingEvidenceArtifacts)) {
    errors.push("missingEvidenceArtifacts must be an array");
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true };
}

