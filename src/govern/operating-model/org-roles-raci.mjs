const REQUIRED_ROLE_IDS = Object.freeze([
  "executive-sponsor",
  "coe-lead",
  "security-lead",
  "compliance-lead",
  "data-governance-lead",
  "platform-engineering-lead",
  "service-desk-lead",
  "business-owner",
]);

const REQUIRED_WORKSTREAM_IDS = Object.freeze([
  "agent-onboarding-approval",
  "policy-baseline-management",
  "incident-response",
  "audit-evidence-attestation",
  "training-and-change-management",
  "value-and-adoption-review",
]);

/**
 * @param {{
 *   organization?: string;
 *   roles?: Array<{ roleId: string; title: string; pillar: "observe"|"govern"|"secure"|"optimize"; ownerType: "business"|"it"|"security"|"compliance" }>;
 * }} input
 */
export function buildOrganizationRoleCatalog(input = {}) {
  return {
    version: "2026.06.1",
    organization: input.organization ?? "FrontierIQ Tenant",
    roles: input.roles ?? [
      { roleId: "executive-sponsor", title: "Executive Sponsor", pillar: "optimize", ownerType: "business" },
      { roleId: "coe-lead", title: "Agents CoE Lead", pillar: "govern", ownerType: "it" },
      { roleId: "security-lead", title: "Security Lead", pillar: "secure", ownerType: "security" },
      { roleId: "compliance-lead", title: "Compliance Lead", pillar: "govern", ownerType: "compliance" },
      { roleId: "data-governance-lead", title: "Data Governance Lead", pillar: "secure", ownerType: "compliance" },
      { roleId: "platform-engineering-lead", title: "Platform Engineering Lead", pillar: "observe", ownerType: "it" },
      { roleId: "service-desk-lead", title: "Service Desk Lead", pillar: "govern", ownerType: "it" },
      { roleId: "business-owner", title: "Business Owner", pillar: "optimize", ownerType: "business" },
    ],
  };
}

/**
 * @param {{
 *   assignments?: Array<{
 *     workstreamId: string;
 *     accountableRoleId: string;
 *     responsibleRoleIds: string[];
 *     consultedRoleIds: string[];
 *     informedRoleIds: string[];
 *   }>;
 * }} input
 */
export function buildRaciMatrix(input = {}) {
  return {
    version: "2026.06.1",
    assignments: input.assignments ?? [
      {
        workstreamId: "agent-onboarding-approval",
        accountableRoleId: "coe-lead",
        responsibleRoleIds: ["platform-engineering-lead", "security-lead"],
        consultedRoleIds: ["compliance-lead", "data-governance-lead"],
        informedRoleIds: ["executive-sponsor", "business-owner", "service-desk-lead"],
      },
      {
        workstreamId: "policy-baseline-management",
        accountableRoleId: "compliance-lead",
        responsibleRoleIds: ["security-lead", "platform-engineering-lead"],
        consultedRoleIds: ["data-governance-lead", "coe-lead"],
        informedRoleIds: ["business-owner", "service-desk-lead"],
      },
      {
        workstreamId: "incident-response",
        accountableRoleId: "security-lead",
        responsibleRoleIds: ["service-desk-lead", "platform-engineering-lead"],
        consultedRoleIds: ["compliance-lead", "data-governance-lead"],
        informedRoleIds: ["coe-lead", "executive-sponsor", "business-owner"],
      },
      {
        workstreamId: "audit-evidence-attestation",
        accountableRoleId: "compliance-lead",
        responsibleRoleIds: ["coe-lead", "platform-engineering-lead"],
        consultedRoleIds: ["security-lead", "data-governance-lead"],
        informedRoleIds: ["executive-sponsor", "business-owner", "service-desk-lead"],
      },
      {
        workstreamId: "training-and-change-management",
        accountableRoleId: "coe-lead",
        responsibleRoleIds: ["service-desk-lead", "business-owner"],
        consultedRoleIds: ["security-lead", "compliance-lead"],
        informedRoleIds: ["executive-sponsor", "platform-engineering-lead", "data-governance-lead"],
      },
      {
        workstreamId: "value-and-adoption-review",
        accountableRoleId: "business-owner",
        responsibleRoleIds: ["coe-lead", "executive-sponsor"],
        consultedRoleIds: ["platform-engineering-lead", "security-lead", "compliance-lead"],
        informedRoleIds: ["service-desk-lead", "data-governance-lead"],
      },
    ],
  };
}

/**
 * @param {{
 *   roleCatalog: ReturnType<typeof buildOrganizationRoleCatalog>;
 *   raciMatrix: ReturnType<typeof buildRaciMatrix>;
 * }} input
 */
export function summarizeRaciReadiness(input) {
  const roleIds = new Set(input.roleCatalog.roles.map((role) => role.roleId));
  const workstreamIds = new Set(input.raciMatrix.assignments.map((assignment) => assignment.workstreamId));

  const checks = {
    roleCoverage: makeCheck(
      REQUIRED_ROLE_IDS.every((roleId) => roleIds.has(roleId)),
      REQUIRED_ROLE_IDS.filter((roleId) => !roleIds.has(roleId)).map((roleId) => `missing-role:${roleId}`)
    ),
    workstreamCoverage: makeCheck(
      REQUIRED_WORKSTREAM_IDS.every((workstreamId) => workstreamIds.has(workstreamId)),
      REQUIRED_WORKSTREAM_IDS.filter((workstreamId) => !workstreamIds.has(workstreamId)).map(
        (workstreamId) => `missing-workstream:${workstreamId}`
      )
    ),
    assignmentIntegrity: makeCheck(
      input.raciMatrix.assignments.every(
        (assignment) =>
          roleIds.has(assignment.accountableRoleId) &&
          assignment.responsibleRoleIds.length > 0 &&
          assignment.responsibleRoleIds.every((roleId) => roleIds.has(roleId)) &&
          assignment.consultedRoleIds.every((roleId) => roleIds.has(roleId)) &&
          assignment.informedRoleIds.every((roleId) => roleIds.has(roleId))
      ),
      input.raciMatrix.assignments.flatMap((assignment) => {
        const errors = [];
        if (!roleIds.has(assignment.accountableRoleId)) {
          errors.push(`unknown-accountable-role:${assignment.workstreamId}:${assignment.accountableRoleId}`);
        }
        if (assignment.responsibleRoleIds.length === 0) {
          errors.push(`missing-responsible-roles:${assignment.workstreamId}`);
        }
        for (const roleId of assignment.responsibleRoleIds) {
          if (!roleIds.has(roleId)) errors.push(`unknown-responsible-role:${assignment.workstreamId}:${roleId}`);
        }
        for (const roleId of assignment.consultedRoleIds) {
          if (!roleIds.has(roleId)) errors.push(`unknown-consulted-role:${assignment.workstreamId}:${roleId}`);
        }
        for (const roleId of assignment.informedRoleIds) {
          if (!roleIds.has(roleId)) errors.push(`unknown-informed-role:${assignment.workstreamId}:${roleId}`);
        }
        return errors;
      })
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
