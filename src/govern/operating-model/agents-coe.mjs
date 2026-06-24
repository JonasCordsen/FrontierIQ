const REQUIRED_COE_ROLES = Object.freeze([
  "executiveSponsor",
  "coeLead",
  "securityLead",
  "complianceLead",
  "dataLead",
  "engineeringLead",
  "changeManagementLead",
  "businessOwner",
]);

/**
 * @param {{
 *   organization?: string;
 *   mission?: string;
 *   scope?: string[];
 *   successMeasures?: string[];
 *   approvedBy?: string;
 * }} input
 */
export function buildAgentsCoeCharter(input = {}) {
  return {
    version: "2026.06.1",
    organization: input.organization ?? "FrontierIQ Tenant",
    mission:
      input.mission ??
      "Enable secure, governed, and value-driven adoption of Copilot agents across business units.",
    scope: input.scope ?? [
      "agent-onboarding-governance",
      "security-and-compliance-oversight",
      "platform-operations-and-support",
      "adoption-and-change-management",
    ],
    successMeasures: input.successMeasures ?? [
      "policy-compliant-agent-onboarding-rate",
      "mean-time-to-contain-agent-incidents",
      "license-utilization-improvement",
      "kpi-backed-use-case-adoption",
    ],
    approvedBy: input.approvedBy ?? null,
  };
}

/**
 * @param {{
 *   assignments?: Partial<Record<
 *     "executiveSponsor"|"coeLead"|"securityLead"|"complianceLead"|"dataLead"|"engineeringLead"|"changeManagementLead"|"businessOwner",
 *     string
 *   >>;
 *   responsibilities?: Partial<Record<
 *     "executiveSponsor"|"coeLead"|"securityLead"|"complianceLead"|"dataLead"|"engineeringLead"|"changeManagementLead"|"businessOwner",
 *     string[]
 *   >>;
 * }} input
 */
export function buildAgentsCoeRoleModel(input = {}) {
  const defaultAssignments = {
    executiveSponsor: "CIO/CISO",
    coeLead: "AI Agent CoE Lead",
    securityLead: "Security Engineering Lead",
    complianceLead: "Compliance and Risk Lead",
    dataLead: "Data Governance Lead",
    engineeringLead: "Platform Engineering Lead",
    changeManagementLead: "Change Management Lead",
    businessOwner: "Business Unit Owner",
  };

  const defaultResponsibilities = {
    executiveSponsor: ["funding-approval", "strategic-prioritization"],
    coeLead: ["operating-model-ownership", "cross-team-governance"],
    securityLead: ["threat-and-access-controls", "incident-response-coordination"],
    complianceLead: ["control-attestation", "audit-evidence-governance"],
    dataLead: ["data-boundary-and-label-governance", "retention-and-deletion-policy"],
    engineeringLead: ["platform-automation", "runtime-reliability-and-slos"],
    changeManagementLead: ["training-and-communications", "adoption-readiness"],
    businessOwner: ["use-case-prioritization", "value-realization-accountability"],
  };

  return {
    version: "2026.06.1",
    assignments: Object.fromEntries(
      REQUIRED_COE_ROLES.map((role) => [role, input.assignments?.[role] ?? defaultAssignments[role]])
    ),
    responsibilities: Object.fromEntries(
      REQUIRED_COE_ROLES.map((role) => [role, input.responsibilities?.[role] ?? defaultResponsibilities[role]])
    ),
  };
}

/**
 * @param {{
 *   weeklyOpsDay?: string;
 *   monthlyGovernanceDay?: string;
 *   quarterlyReviewMonthCadence?: number;
 * }} input
 */
export function buildAgentsCoeOperatingCadence(input = {}) {
  return {
    version: "2026.06.1",
    ceremonies: [
      {
        name: "weekly-operations-review",
        cadence: "weekly",
        day: input.weeklyOpsDay ?? "monday",
        attendees: ["coeLead", "engineeringLead", "securityLead", "dataLead"],
      },
      {
        name: "monthly-governance-board",
        cadence: "monthly",
        day: input.monthlyGovernanceDay ?? "first-wednesday",
        attendees: ["executiveSponsor", "coeLead", "securityLead", "complianceLead", "businessOwner"],
      },
      {
        name: "quarterly-value-and-risk-review",
        cadence: `every-${input.quarterlyReviewMonthCadence ?? 3}-months`,
        attendees: [
          "executiveSponsor",
          "coeLead",
          "businessOwner",
          "changeManagementLead",
          "complianceLead",
        ],
      },
    ],
  };
}

/**
 * @param {{ requiredArtifacts?: string[]; requiredApprovals?: string[] }} input
 */
export function buildAgentsCoeOnboardingTemplate(input = {}) {
  return {
    version: "2026.06.1",
    sections: [
      "use-case-definition",
      "risk-and-control-assessment",
      "data-and-residency-review",
      "security-and-identity-review",
      "deployment-and-monitoring-plan",
      "adoption-and-communications-plan",
    ],
    requiredArtifacts: input.requiredArtifacts ?? [
      "evidence/tenant-onboarding-bundle.json",
      "evidence/policy-catalog.json",
      "evidence/approval-decisions.ndjson",
      "evidence/siem-alert-routing.json",
    ],
    requiredApprovals: input.requiredApprovals ?? [
      "securityLead",
      "complianceLead",
      "dataLead",
      "businessOwner",
    ],
  };
}

/**
 * @param {{
 *   charter: ReturnType<typeof buildAgentsCoeCharter>;
 *   roles: ReturnType<typeof buildAgentsCoeRoleModel>;
 *   cadence: ReturnType<typeof buildAgentsCoeOperatingCadence>;
 *   onboardingTemplate: ReturnType<typeof buildAgentsCoeOnboardingTemplate>;
 * }} input
 */
export function summarizeAgentsCoeReadiness(input) {
  const checks = {
    charterApproved: makeCheck(Boolean(input.charter.approvedBy), input.charter.approvedBy ? [] : ["charter-not-approved"]),
    roleCoverage: makeCheck(
      REQUIRED_COE_ROLES.every((role) => Boolean(input.roles.assignments[role])),
      REQUIRED_COE_ROLES.filter((role) => !input.roles.assignments[role]).map((role) => `missing-role:${role}`)
    ),
    cadenceCoverage: makeCheck(
      Array.isArray(input.cadence.ceremonies) && input.cadence.ceremonies.length >= 3,
      Array.isArray(input.cadence.ceremonies) && input.cadence.ceremonies.length >= 3
        ? []
        : ["insufficient-operating-cadence"]
    ),
    onboardingTemplateReady: makeCheck(
      input.onboardingTemplate.sections.length >= 5 &&
        input.onboardingTemplate.requiredApprovals.length >= 4,
      input.onboardingTemplate.sections.length >= 5 &&
        input.onboardingTemplate.requiredApprovals.length >= 4
        ? []
        : ["onboarding-template-incomplete"]
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

