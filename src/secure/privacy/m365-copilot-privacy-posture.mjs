import { SOLUTION_IDS } from "../../observe/foundation/solution-taxonomy.mjs";
import { CONTROL_IDS } from "../../govern/policy/control-catalog.mjs";
import { getEvidenceArtifactsForControl } from "../../govern/policy/evidence-mapping.mjs";

const LESSON3_CONTROL_IDS = Object.freeze([
  CONTROL_IDS.DATA_RESIDENCY_ENFORCEMENT,
  CONTROL_IDS.REGIONAL_STORAGE_ALIGNMENT,
  CONTROL_IDS.PURVIEW_LABEL_ENFORCEMENT,
  CONTROL_IDS.PII_DETECTION_REDACTION,
  CONTROL_IDS.CONSENT_PRIVACY_NOTICE,
  CONTROL_IDS.DATA_RETENTION_POLICY,
  CONTROL_IDS.DATA_DELETION_WORKFLOW,
]);

const PII_PATTERNS = Object.freeze([
  { type: "email", regex: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi },
  { type: "phone", regex: /\b(?:\+?\d[\d\s-]{7,}\d)\b/g },
  { type: "creditCard", regex: /\b(?:\d[ -]*?){13,16}\b/g },
]);

export function buildPrivacyControlProfile() {
  return {
    solutionId: SOLUTION_IDS.M365_COPILOT,
    profileVersion: "2026.06.1",
    lesson3Controls: LESSON3_CONTROL_IDS.map((controlId) => ({
      controlId,
      enforcementLevel: "required",
      evidenceArtifacts: getEvidenceArtifactsForControl(controlId),
    })),
  };
}

/**
 * @param {{
 *   tenantId: string;
 *   defaultRegion: string;
 *   workloads: Array<{ workload: string; region: string; dataBoundary: string }>;
 * }} input
 */
export function buildDataResidencyMap(input) {
  const alignedWorkloads = input.workloads.filter(
    (workload) => workload.region === input.defaultRegion
  ).length;
  return {
    tenantId: input.tenantId,
    defaultRegion: input.defaultRegion,
    workloads: [...input.workloads],
    alignedWorkloads,
    alignmentPercent: input.workloads.length
      ? Number(((alignedWorkloads / input.workloads.length) * 100).toFixed(2))
      : 0,
  };
}

/**
 * @param {{
 *   tenantId: string;
 *   defaultRegion: string;
 *   datasets: Array<{ datasetId: string; dataClass: string; targetRegion: string; storageType: string }>;
 * }} input
 */
export function buildRegionalStoragePlan(input) {
  return {
    tenantId: input.tenantId,
    defaultRegion: input.defaultRegion,
    placements: input.datasets.map((dataset) => ({
      ...dataset,
      alignedToDefaultRegion: dataset.targetRegion === input.defaultRegion,
    })),
  };
}

/**
 * @param {Array<{ itemId: string; dataClass: string; requiredLabel: string; appliedLabel?: string }>} items
 */
export function evaluatePurviewLabelCoverage(items) {
  const gaps = items.filter((item) => item.requiredLabel !== item.appliedLabel);
  return {
    totalItems: items.length,
    labeledItems: items.length - gaps.length,
    gaps,
    coveragePercent: items.length
      ? Number((((items.length - gaps.length) / items.length) * 100).toFixed(2))
      : 0,
  };
}

/**
 * @param {Array<{ itemId: string; text: string }>} items
 */
export function detectPiiFindings(items) {
  const findings = [];
  for (const item of items) {
    for (const pattern of PII_PATTERNS) {
      const matches = item.text.match(pattern.regex) ?? [];
      for (const match of matches) {
        findings.push({
          itemId: item.itemId,
          type: pattern.type,
          value: match,
        });
      }
    }
  }
  return findings;
}

export function redactSensitiveText(text) {
  let redacted = text;
  for (const pattern of PII_PATTERNS) {
    redacted = redacted.replace(pattern.regex, `[REDACTED_${pattern.type.toUpperCase()}]`);
  }
  return redacted;
}

/**
 * @param {{
 *   adminExperience: string;
 *   userExperience: string;
 *   contactChannel: string;
 * }} input
 */
export function buildConsentUxModel(input) {
  return {
    adminNotice: `${input.adminExperience}: explain processing boundaries, residency, and retention owners.`,
    userNotice: `${input.userExperience}: explain prompt logging, sensitive data handling, and escalation path.`,
    contactChannel: input.contactChannel,
  };
}

/**
 * @param {Array<{ recordType: string; retentionDays: number; legalHold?: boolean }>} records
 */
export function buildRetentionDeletionWorkflow(records) {
  return {
    records: records.map((record) => ({
      ...record,
      nextAction: record.legalHold ? "retain" : "delete-on-expiry",
    })),
    deletableRecords: records.filter((record) => !record.legalHold).length,
  };
}

/**
 * @param {{
 *   residencyMap: ReturnType<typeof buildDataResidencyMap>;
 *   labelCoverage: ReturnType<typeof evaluatePurviewLabelCoverage>;
 *   piiFindings: ReturnType<typeof detectPiiFindings>;
 *   retentionWorkflow: ReturnType<typeof buildRetentionDeletionWorkflow>;
 * }} input
 */
export function summarizePrivacyPosture(input) {
  const residencyAligned = input.residencyMap.alignmentPercent === 100;
  const purviewCovered = input.labelCoverage.coveragePercent === 100;
  const retentionCovered =
    input.retentionWorkflow.records.length > 0 &&
    input.retentionWorkflow.records.every((record) => record.nextAction);
  return {
    solutionId: SOLUTION_IDS.M365_COPILOT,
    totalLesson3Controls: LESSON3_CONTROL_IDS.length,
    residencyAligned,
    labelCoveragePercent: input.labelCoverage.coveragePercent,
    piiFindingCount: input.piiFindings.length,
    retentionWorkflowCovered: retentionCovered,
    failedChecks: [
      ...(residencyAligned ? [] : ["data-residency"]),
      ...(purviewCovered ? [] : ["purview-labels"]),
      ...(input.piiFindings.length === 0 ? [] : ["pii-findings"]),
      ...(retentionCovered ? [] : ["retention-workflow"]),
    ],
  };
}

