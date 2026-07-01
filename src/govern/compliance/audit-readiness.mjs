import { buildOperatingModelKit, createOperatingModelChecklist } from "../operating-model/kit.mjs";
import { buildM365CopilotComplianceMatrix, buildM365CopilotComplianceReport } from "./m365-copilot-compliance.mjs";

const ARTIFACT_AUTOMATION_DEFAULTS = Object.freeze({
  "evidence/access-review-export.json": {
    sourceSystem: "Microsoft Entra access reviews",
    cadence: "weekly",
    automationType: "export-job",
  },
  "evidence/owner-registry.csv": {
    sourceSystem: "FrontierIQ agent/owner registry",
    cadence: "weekly",
    automationType: "registry-export",
  },
  "evidence/residency-config.json": {
    sourceSystem: "Microsoft 365 / tenant configuration baseline",
    cadence: "monthly",
    automationType: "configuration-snapshot",
  },
  "evidence/retention-policy.yaml": {
    sourceSystem: "Microsoft Purview retention policies",
    cadence: "monthly",
    automationType: "policy-export",
  },
  "evidence/audit-log.ndjson": {
    sourceSystem: "Microsoft Purview / Microsoft 365 audit logs",
    cadence: "daily",
    automationType: "log-export",
  },
  "evidence/approval-decisions.ndjson": {
    sourceSystem: "FrontierIQ approval board workflow",
    cadence: "daily",
    automationType: "workflow-export",
  },
  "evidence/rai-assessment.md": {
    sourceSystem: "Responsible AI assessment workflow",
    cadence: "per-release",
    automationType: "review-package",
  },
  "evidence/rbac-assignment-review.csv": {
    sourceSystem: "Entra role assignment export",
    cadence: "weekly",
    automationType: "access-review-export",
  },
  "evidence/byo-entra-onboarding.md": {
    sourceSystem: "FrontierIQ onboarding workflow",
    cadence: "per-tenant",
    automationType: "workflow-package",
  },
  "evidence/keyvault-rotation-plan.json": {
    sourceSystem: "Azure Key Vault",
    cadence: "monthly",
    automationType: "configuration-snapshot",
  },
  "evidence/tenant-onboarding-bundle.json": {
    sourceSystem: "FrontierIQ tenant onboarding workflow",
    cadence: "per-tenant",
    automationType: "workflow-package",
  },
  "evidence/tenant-resource-template.json": {
    sourceSystem: "Tenant infrastructure template catalog",
    cadence: "per-tenant",
    automationType: "template-export",
  },
  "evidence/tenant-onboarding-scripts.json": {
    sourceSystem: "Tenant onboarding automation scripts",
    cadence: "per-tenant",
    automationType: "script-catalog",
  },
  "evidence/policy-catalog.json": {
    sourceSystem: "FrontierIQ policy catalog",
    cadence: "per-release",
    automationType: "catalog-export",
  },
  "evidence/cicd-validation-report.json": {
    sourceSystem: "CI/CD validation pipeline",
    cadence: "per-release",
    automationType: "pipeline-report",
  },
  "evidence/purview-label-export.csv": {
    sourceSystem: "Microsoft Purview labels",
    cadence: "weekly",
    automationType: "policy-export",
  },
  "evidence/pii-detection-findings.ndjson": {
    sourceSystem: "FrontierIQ privacy scanner",
    cadence: "daily",
    automationType: "scanner-export",
  },
  "evidence/overshare-incidents.ndjson": {
    sourceSystem: "FrontierIQ overshare detection pipeline",
    cadence: "daily",
    automationType: "incident-log-export",
  },
  "evidence/overshare-enforcement-decisions.ndjson": {
    sourceSystem: "FrontierIQ overshare enforcement workflow",
    cadence: "daily",
    automationType: "decision-log-export",
  },
  "evidence/siem-connector-config.json": {
    sourceSystem: "FrontierIQ SIEM connector registry",
    cadence: "per-tenant",
    automationType: "configuration-snapshot",
  },
  "evidence/siem-alert-routing.json": {
    sourceSystem: "FrontierIQ SIEM alert router",
    cadence: "per-release",
    automationType: "route-export",
  },
  "evidence/incident-playbooks.json": {
    sourceSystem: "FrontierIQ incident response catalog",
    cadence: "per-release",
    automationType: "runbook-export",
  },
  "evidence/consent-dashboard.json": {
    sourceSystem: "FrontierIQ privacy notice dashboard",
    cadence: "per-release",
    automationType: "dashboard-export",
  },
  "evidence/regional-storage-plan.json": {
    sourceSystem: "Regional storage placement planner",
    cadence: "monthly",
    automationType: "plan-export",
  },
  "evidence/deletion-workflow.yaml": {
    sourceSystem: "Purview retention and deletion workflow",
    cadence: "monthly",
    automationType: "workflow-export",
  },
});

/**
 * @param {{ availableArtifacts?: string[] }} input
 */
export function buildComplianceGapAnalysis(input = {}) {
  const matrix = buildM365CopilotComplianceMatrix();
  const report = buildM365CopilotComplianceReport({
    availableArtifacts: input.availableArtifacts ?? [],
  });
  const artifactsByControl = buildArtifactsByControl(matrix);

  const controlGaps = Object.entries(artifactsByControl)
    .map(([controlId, artifacts]) => {
      const missingArtifacts = artifacts.filter(
        (artifact) => !(input.availableArtifacts ?? []).includes(artifact)
      );
      return {
        controlId,
        totalArtifacts: artifacts.length,
        missingArtifacts,
        status: missingArtifacts.length === 0 ? "covered" : "gap",
      };
    })
    .sort((a, b) => a.missingArtifacts.length - b.missingArtifacts.length);

  const remediationActions = report.evidenceGaps.map((gap) => ({
    title: `Collect ${gap.missingArtifact} for ${gap.certificationName}`,
    ownerRole: recommendOwnerRole(gap.missingArtifact),
    priority: classifyArtifactPriority(gap.missingArtifact),
    relatedCertificationId: gap.certificationId,
  }));

  return {
    summary: report.summary,
    controlGaps,
    remediationActions,
  };
}

/**
 * @param {{ availableArtifacts?: string[]; additionalArtifacts?: string[] }} input
 */
export function buildEvidenceCollectionPlan(input = {}) {
  const matrix = buildM365CopilotComplianceMatrix();
  const uniqueArtifacts = [
    ...new Set(matrix.flatMap((entry) => entry.evidenceArtifacts)),
    ...new Set(input.additionalArtifacts ?? []),
  ].sort((a, b) => a.localeCompare(b));

  return uniqueArtifacts.map((artifact) => {
    const defaults = ARTIFACT_AUTOMATION_DEFAULTS[artifact] ?? {
      sourceSystem: "Unknown source",
      cadence: "monthly",
      automationType: "manual-export",
    };
    return {
      artifact,
      present: (input.availableArtifacts ?? []).includes(artifact),
      ...defaults,
    };
  });
}

/**
 * @param {{
 *   organization?: string;
 *   availableArtifacts?: string[];
 *   additionalArtifacts?: string[];
 *   operatingModelKit?: Parameters<typeof buildOperatingModelKit>[0];
 *   generatedAt?: string;
 * }} input
 */
export function buildAuditReadinessPack(input = {}) {
  const operatingModelKit = buildOperatingModelKit({
    organization: input.organization,
    ...input.operatingModelKit,
  });
  const complianceReport = buildM365CopilotComplianceReport({
    availableArtifacts: input.availableArtifacts ?? [],
    generatedAt: input.generatedAt,
  });
  const gapAnalysis = buildComplianceGapAnalysis({
    availableArtifacts: input.availableArtifacts ?? [],
  });
  const evidenceCollectionPlan = buildEvidenceCollectionPlan({
    availableArtifacts: input.availableArtifacts ?? [],
    additionalArtifacts: input.additionalArtifacts ?? [],
  });

  const auditChecklist = [
    ...createOperatingModelChecklist(operatingModelKit),
    `Review ${complianceReport.summary.totalCertifications} mapped compliance commitments`,
    `Close ${gapAnalysis.remediationActions.length} remediation actions`,
  ];

  const requiredArtifacts = new Set([
    ...operatingModelKit.auditPackArtifacts.map((item) => normalizePackArtifact(item)),
    ...evidenceCollectionPlan.map((item) => item.artifact),
  ]);
  const presentArtifacts = new Set(input.availableArtifacts ?? []);
  const covered = [...requiredArtifacts].filter((artifact) => presentArtifacts.has(artifact)).length;
  const readinessScore = requiredArtifacts.size
    ? Number(((covered / requiredArtifacts.size) * 100).toFixed(2))
    : 0;

  return {
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    operatingModelKit,
    complianceReport,
    gapAnalysis,
    evidenceCollectionPlan,
    auditChecklist,
    readinessScore,
  };
}

function buildArtifactsByControl(matrix) {
  /** @type {Record<string, string[]>} */
  const artifactsByControl = {};
  for (const entry of matrix) {
    for (const controlId of entry.controlIds) {
      artifactsByControl[controlId] = artifactsByControl[controlId] ?? [];
      for (const artifact of entry.evidenceArtifacts) {
        if (!artifactsByControl[controlId].includes(artifact)) {
          artifactsByControl[controlId].push(artifact);
        }
      }
    }
  }
  return artifactsByControl;
}

function recommendOwnerRole(artifact) {
  if (artifact.includes("approval")) return "coeLead";
  if (artifact.includes("rai")) return "responsibleAiLead";
  if (artifact.includes("audit")) return "securityRepresentative";
  if (artifact.includes("retention") || artifact.includes("residency")) return "complianceRepresentative";
  return "businessOwner";
}

function classifyArtifactPriority(artifact) {
  if (artifact.includes("audit") || artifact.includes("approval")) return "high";
  if (artifact.includes("retention") || artifact.includes("residency")) return "high";
  return "medium";
}

function normalizePackArtifact(value) {
  return value.startsWith("evidence/") ? value : `evidence/${value}`;
}
