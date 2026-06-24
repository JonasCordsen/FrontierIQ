import { SOLUTION_IDS } from "../../observe/foundation/solution-taxonomy.mjs";
import { CONTROL_IDS } from "../policy/control-catalog.mjs";
import { getEvidenceArtifactsForControl } from "../policy/evidence-mapping.mjs";
import { getPolicyProfile } from "../policy/baseline-library.mjs";

export const CERTIFICATION_IDS = Object.freeze({
  SOC_1: "soc-1",
  SOC_2: "soc-2",
  SOC_3: "soc-3",
  ISO_27001: "iso-27001",
  ISO_27017: "iso-27017",
  ISO_27018: "iso-27018",
  ISO_27701: "iso-27701",
  ISO_42001: "iso-42001",
  GDPR: "gdpr",
  EU_DATA_BOUNDARY: "eu-data-boundary",
});

const COMPLIANCE_CATALOG = Object.freeze([
  {
    id: CERTIFICATION_IDS.SOC_1,
    name: "SOC 1",
    category: "attestation",
    scopeType: "platform-inherited",
    proofSource: "Microsoft Service Trust Portal",
    sourceUrl: "https://servicetrust.microsoft.com/",
    notes: "Microsoft 365 Copilot is assessed within Microsoft 365 commercial compliance commitments.",
    controlIds: [CONTROL_IDS.AUDIT_TRACEABILITY, CONTROL_IDS.ACCESS_OWNER_ACCOUNTABILITY],
  },
  {
    id: CERTIFICATION_IDS.SOC_2,
    name: "SOC 2",
    category: "attestation",
    scopeType: "platform-inherited",
    proofSource: "Microsoft Service Trust Portal",
    sourceUrl: "https://servicetrust.microsoft.com/",
    notes: "Use for security, availability, confidentiality, and privacy control evidence.",
    controlIds: [
      CONTROL_IDS.ACCESS_LEAST_PRIVILEGE,
      CONTROL_IDS.AUDIT_TRACEABILITY,
      CONTROL_IDS.DATA_RETENTION_POLICY,
    ],
  },
  {
    id: CERTIFICATION_IDS.SOC_3,
    name: "SOC 3",
    category: "attestation",
    scopeType: "platform-inherited",
    proofSource: "Microsoft Service Trust Portal",
    sourceUrl: "https://servicetrust.microsoft.com/",
    notes: "Public attestation summary aligned with SOC control posture.",
    controlIds: [CONTROL_IDS.AUDIT_TRACEABILITY],
  },
  {
    id: CERTIFICATION_IDS.ISO_27001,
    name: "ISO 27001",
    category: "iso",
    scopeType: "platform-inherited",
    proofSource: "Microsoft Service Trust Portal",
    sourceUrl: "https://servicetrust.microsoft.com/",
    notes: "Information security management baseline for Microsoft 365 Copilot operations.",
    controlIds: [
      CONTROL_IDS.ACCESS_LEAST_PRIVILEGE,
      CONTROL_IDS.ACCESS_OWNER_ACCOUNTABILITY,
      CONTROL_IDS.AUDIT_TRACEABILITY,
    ],
  },
  {
    id: CERTIFICATION_IDS.ISO_27017,
    name: "ISO 27017",
    category: "iso",
    scopeType: "platform-inherited",
    proofSource: "Microsoft Service Trust Portal",
    sourceUrl: "https://servicetrust.microsoft.com/",
    notes: "Cloud security control guidance for tenant service operation.",
    controlIds: [
      CONTROL_IDS.ACCESS_LEAST_PRIVILEGE,
      CONTROL_IDS.APPROVAL_GATES,
      CONTROL_IDS.AUDIT_TRACEABILITY,
    ],
  },
  {
    id: CERTIFICATION_IDS.ISO_27018,
    name: "ISO 27018",
    category: "iso",
    scopeType: "platform-inherited",
    proofSource: "Microsoft Service Trust Portal",
    sourceUrl: "https://servicetrust.microsoft.com/",
    notes: "Protection of PII in public cloud environments.",
    controlIds: [
      CONTROL_IDS.DATA_RESIDENCY_ENFORCEMENT,
      CONTROL_IDS.DATA_RETENTION_POLICY,
      CONTROL_IDS.AUDIT_TRACEABILITY,
    ],
  },
  {
    id: CERTIFICATION_IDS.ISO_27701,
    name: "ISO 27701",
    category: "iso",
    scopeType: "platform-inherited",
    proofSource: "Microsoft Service Trust Portal",
    sourceUrl: "https://servicetrust.microsoft.com/",
    notes: "Privacy information management alignment for processing activities.",
    controlIds: [
      CONTROL_IDS.DATA_RESIDENCY_ENFORCEMENT,
      CONTROL_IDS.DATA_RETENTION_POLICY,
      CONTROL_IDS.ACCESS_OWNER_ACCOUNTABILITY,
    ],
  },
  {
    id: CERTIFICATION_IDS.ISO_42001,
    name: "ISO 42001",
    category: "iso",
    scopeType: "copilot-explicit",
    proofSource: "Microsoft Service Trust Portal",
    sourceUrl: "https://servicetrust.microsoft.com/",
    notes: "AI management system certification relevant to Copilot governance oversight.",
    controlIds: [CONTROL_IDS.RESPONSIBLE_AI_REVIEW, CONTROL_IDS.APPROVAL_GATES],
  },
  {
    id: CERTIFICATION_IDS.GDPR,
    name: "GDPR",
    category: "regulation",
    scopeType: "copilot-explicit",
    proofSource: "Microsoft Learn",
    sourceUrl: "https://learn.microsoft.com/en-us/microsoft-365/copilot/microsoft-365-copilot-privacy",
    notes: "Microsoft documents GDPR compliance and contractual commitments for Microsoft 365 Copilot.",
    controlIds: [
      CONTROL_IDS.DATA_RESIDENCY_ENFORCEMENT,
      CONTROL_IDS.DATA_RETENTION_POLICY,
      CONTROL_IDS.ACCESS_OWNER_ACCOUNTABILITY,
    ],
  },
  {
    id: CERTIFICATION_IDS.EU_DATA_BOUNDARY,
    name: "EU Data Boundary",
    category: "residency",
    scopeType: "customer-configurable",
    proofSource: "Microsoft Learn",
    sourceUrl: "https://learn.microsoft.com/en-us/microsoft-365/copilot/microsoft-365-copilot-privacy",
    notes: "Customer deployment and configuration choice for EU-boundary commitments.",
    controlIds: [CONTROL_IDS.DATA_RESIDENCY_ENFORCEMENT, CONTROL_IDS.AUDIT_TRACEABILITY],
  },
]);

export function listM365CopilotCertifications() {
  return [...COMPLIANCE_CATALOG];
}

export function buildM365CopilotComplianceMatrix() {
  return COMPLIANCE_CATALOG.map((entry) => ({
    ...entry,
    solutionId: SOLUTION_IDS.M365_COPILOT,
    evidenceArtifacts: unique(entry.controlIds.flatMap((controlId) => getEvidenceArtifactsForControl(controlId))),
  }));
}

/**
 * @param {ReturnType<typeof buildM365CopilotComplianceMatrix>} matrix
 */
export function summarizeM365CopilotCompliance(matrix) {
  const policyProfile = getPolicyProfile(SOLUTION_IDS.M365_COPILOT);
  const requiredControls = new Set((policyProfile?.controls ?? []).map((control) => control.controlId));
  const mappedControls = new Set(matrix.flatMap((entry) => entry.controlIds));
  const missingControls = [...requiredControls].filter((controlId) => !mappedControls.has(controlId));
  const coveragePercent = requiredControls.size
    ? Number((((requiredControls.size - missingControls.length) / requiredControls.size) * 100).toFixed(2))
    : 0;

  return {
    solutionId: SOLUTION_IDS.M365_COPILOT,
    totalCertifications: matrix.length,
    mappedCertifications: matrix.filter((entry) => entry.controlIds.length > 0).length,
    controlCoveragePercent: coveragePercent,
    requiredControls: requiredControls.size,
    missingControls,
    keyGaps: missingControls.map((controlId) => `Missing compliance mapping for ${controlId}`),
  };
}

/**
 * @param {ReturnType<typeof buildM365CopilotComplianceMatrix>} matrix
 * @param {string[]} availableArtifacts
 */
export function findComplianceEvidenceGaps(matrix, availableArtifacts) {
  const available = new Set(availableArtifacts);
  return matrix.flatMap((entry) =>
    entry.evidenceArtifacts
      .filter((artifact) => !available.has(artifact))
      .map((artifact) => ({
        certificationId: entry.id,
        certificationName: entry.name,
        missingArtifact: artifact,
      }))
  );
}

/**
 * @param {{ availableArtifacts?: string[]; generatedAt?: string }} options
 */
export function buildM365CopilotComplianceReport(options = {}) {
  const matrix = buildM365CopilotComplianceMatrix();
  const summary = summarizeM365CopilotCompliance(matrix);
  const evidenceGaps = findComplianceEvidenceGaps(matrix, options.availableArtifacts ?? []);

  return {
    solutionId: SOLUTION_IDS.M365_COPILOT,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    summary,
    certifications: matrix,
    evidenceGaps,
  };
}

function unique(values) {
  return [...new Set(values)];
}

