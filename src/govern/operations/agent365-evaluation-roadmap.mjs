const REQUIRED_CAPABILITIES = Object.freeze([
  "policy-evaluation-hooks",
  "identity-context-integration",
  "telemetry-export",
  "admin-governance-actions",
]);

const REQUIRED_GATE_PHASES = Object.freeze([
  "discovery",
  "proof-of-value",
  "pilot",
  "production-readiness",
]);

/**
 * @param {{
 *   capabilities?: Array<{
 *     capabilityId: string;
 *     title: string;
 *     area: "governance"|"security"|"operations"|"observability";
 *     status: "available"|"preview"|"gap";
 *     notes: string;
 *   }>;
 * }} input
 */
export function buildAgent365CapabilityCatalog(input = {}) {
  return {
    version: "2026.06.1",
    capabilities: input.capabilities ?? [
      {
        capabilityId: "policy-evaluation-hooks",
        title: "Policy decision hook integration",
        area: "governance",
        status: "preview",
        notes: "Validate that Agent 365 events can trigger deterministic governance evaluation pipelines.",
      },
      {
        capabilityId: "identity-context-integration",
        title: "Identity context integration",
        area: "security",
        status: "preview",
        notes: "Verify principal mapping coverage for Entra identities and workload identities.",
      },
      {
        capabilityId: "telemetry-export",
        title: "Operational telemetry export",
        area: "observability",
        status: "available",
        notes: "Validate export format compatibility for SIEM and dashboard ingestion.",
      },
      {
        capabilityId: "admin-governance-actions",
        title: "Administrative governance actions",
        area: "operations",
        status: "gap",
        notes: "Track required fallback operations when native controls are not available.",
      },
    ],
  };
}

/**
 * @param {{
 *   criteria?: Array<{
 *     criterionId: string;
 *     area: "security"|"governance"|"operations"|"value";
 *     weight: number;
 *     passThreshold: number;
 *   }>;
 * }} input
 */
export function buildAgent365EvaluationCriteria(input = {}) {
  return {
    version: "2026.06.1",
    criteria: input.criteria ?? [
      { criterionId: "security-controls", area: "security", weight: 35, passThreshold: 80 },
      { criterionId: "governance-enforcement", area: "governance", weight: 25, passThreshold: 80 },
      { criterionId: "operations-and-support", area: "operations", weight: 20, passThreshold: 75 },
      { criterionId: "value-and-adoption", area: "value", weight: 20, passThreshold: 70 },
    ],
  };
}

/**
 * @param {{
 *   gates?: Array<{
 *     phaseId: "discovery"|"proof-of-value"|"pilot"|"production-readiness";
 *     requiredEvidence: string[];
 *     approvers: string[];
 *     failClosed: boolean;
 *   }>;
 * }} input
 */
export function buildAgent365DecisionGates(input = {}) {
  return {
    version: "2026.06.1",
    gates: input.gates ?? [
      {
        phaseId: "discovery",
        requiredEvidence: ["capability-catalog-baseline", "known-gaps-register"],
        approvers: ["coeLead", "engineeringLead"],
        failClosed: true,
      },
      {
        phaseId: "proof-of-value",
        requiredEvidence: ["evaluation-scorecard", "security-test-results"],
        approvers: ["securityLead", "complianceLead", "coeLead"],
        failClosed: true,
      },
      {
        phaseId: "pilot",
        requiredEvidence: ["pilot-operating-runbook", "support-sla-confirmation", "siem-routing-validation"],
        approvers: ["platformOperator", "securityLead", "businessOwner"],
        failClosed: true,
      },
      {
        phaseId: "production-readiness",
        requiredEvidence: ["audit-readiness-pack", "executive-go-live-approval", "rollback-and-fallback-plan"],
        approvers: ["executiveSponsor", "complianceLead", "coeLead"],
        failClosed: true,
      },
    ],
  };
}

/**
 * @param {{
 *   targetDecisionDate?: string;
 *   milestones?: Array<{
 *     milestoneId: string;
 *     phaseId: "discovery"|"proof-of-value"|"pilot"|"production-readiness";
 *     dueDate: string;
 *     ownerRole: string;
 *     outcome: string;
 *   }>;
 * }} input
 */
export function buildAgent365IntegrationRoadmap(input = {}) {
  return {
    version: "2026.06.1",
    targetDecisionDate: input.targetDecisionDate ?? "2026-12-15",
    milestones: input.milestones ?? [
      {
        milestoneId: "a365-m1-capability-baseline",
        phaseId: "discovery",
        dueDate: "2026-08-15",
        ownerRole: "engineeringLead",
        outcome: "capability-and-gap-baseline-published",
      },
      {
        milestoneId: "a365-m2-pov-validation",
        phaseId: "proof-of-value",
        dueDate: "2026-09-30",
        ownerRole: "securityLead",
        outcome: "security-governance-scorecard-complete",
      },
      {
        milestoneId: "a365-m3-pilot-readiness",
        phaseId: "pilot",
        dueDate: "2026-11-01",
        ownerRole: "platformOperator",
        outcome: "pilot-runbook-and-sla-ready",
      },
      {
        milestoneId: "a365-m4-go-live-decision",
        phaseId: "production-readiness",
        dueDate: "2026-12-15",
        ownerRole: "executiveSponsor",
        outcome: "integrate-or-fallback-decision",
      },
    ],
  };
}

/**
 * @param {{
 *   capabilityCatalog: ReturnType<typeof buildAgent365CapabilityCatalog>;
 *   evaluationCriteria: ReturnType<typeof buildAgent365EvaluationCriteria>;
 *   decisionGates: ReturnType<typeof buildAgent365DecisionGates>;
 *   roadmap: ReturnType<typeof buildAgent365IntegrationRoadmap>;
 * }} input
 */
export function summarizeAgent365EvaluationReadiness(input) {
  const capabilityIds = new Set(input.capabilityCatalog.capabilities.map((capability) => capability.capabilityId));
  const gatePhases = new Set(input.decisionGates.gates.map((gate) => gate.phaseId));
  const criterionWeightTotal = input.evaluationCriteria.criteria.reduce((total, criterion) => total + criterion.weight, 0);

  const checks = {
    capabilityCoverage: makeCheck(
      REQUIRED_CAPABILITIES.every((capabilityId) => capabilityIds.has(capabilityId)),
      REQUIRED_CAPABILITIES.filter((capabilityId) => !capabilityIds.has(capabilityId)).map(
        (capabilityId) => `missing-capability:${capabilityId}`
      )
    ),
    criteriaWeights: makeCheck(
      criterionWeightTotal === 100 &&
        input.evaluationCriteria.criteria.every(
          (criterion) => criterion.weight > 0 && criterion.passThreshold >= 50 && criterion.passThreshold <= 100
        ),
      [
        ...(criterionWeightTotal === 100 ? [] : [`invalid-weight-total:${criterionWeightTotal}`]),
        ...input.evaluationCriteria.criteria.flatMap((criterion) => {
          const errors = [];
          if (!(criterion.weight > 0)) errors.push(`invalid-weight:${criterion.criterionId}`);
          if (!(criterion.passThreshold >= 50 && criterion.passThreshold <= 100)) {
            errors.push(`invalid-threshold:${criterion.criterionId}`);
          }
          return errors;
        }),
      ]
    ),
    gateCoverage: makeCheck(
      REQUIRED_GATE_PHASES.every((phaseId) => gatePhases.has(phaseId)) &&
        input.decisionGates.gates.every((gate) => gate.requiredEvidence.length > 0 && gate.approvers.length > 0),
      [
        ...REQUIRED_GATE_PHASES.filter((phaseId) => !gatePhases.has(phaseId)).map((phaseId) => `missing-gate:${phaseId}`),
        ...input.decisionGates.gates.flatMap((gate) => [
          ...(gate.requiredEvidence.length > 0 ? [] : [`missing-gate-evidence:${gate.phaseId}`]),
          ...(gate.approvers.length > 0 ? [] : [`missing-gate-approvers:${gate.phaseId}`]),
        ]),
      ]
    ),
    roadmapCompleteness: makeCheck(
      Boolean(input.roadmap.targetDecisionDate) &&
        input.roadmap.milestones.length >= REQUIRED_GATE_PHASES.length &&
        input.roadmap.milestones.every((milestone) => !Number.isNaN(Date.parse(milestone.dueDate))),
      [
        ...(input.roadmap.targetDecisionDate ? [] : ["missing-target-decision-date"]),
        ...(input.roadmap.milestones.length >= REQUIRED_GATE_PHASES.length
          ? []
          : ["insufficient-roadmap-milestones"]),
        ...input.roadmap.milestones.flatMap((milestone) =>
          Number.isNaN(Date.parse(milestone.dueDate)) ? [`invalid-milestone-date:${milestone.milestoneId}`] : []
        ),
      ]
    ),
  };

  return {
    overallStatus: Object.values(checks).every((check) => check.status === "ready") ? "ready" : "blocked",
    checks,
    failedChecks: Object.values(checks).flatMap((check) => check.reasonCodes),
  };
}

function makeCheck(ok, reasonCodes = []) {
  return {
    status: ok ? "ready" : "blocked",
    reasonCodes,
  };
}
