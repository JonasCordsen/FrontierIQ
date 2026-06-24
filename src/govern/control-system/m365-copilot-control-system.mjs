import { SOLUTION_IDS } from "../../observe/foundation/solution-taxonomy.mjs";
import { isHighRiskPermission } from "../../secure/permissions/high-risk-rules.mjs";
import { validateSkillManifest } from "../validators/skill-manifest-validator.mjs";
import { CONTROL_IDS } from "../policy/control-catalog.mjs";
import { getEvidenceArtifactsForControl } from "../policy/evidence-mapping.mjs";
import { getPolicyProfile } from "../policy/baseline-library.mjs";
import { buildPolicyCatalog } from "../policy/policy-catalog.mjs";

const LESSON2_CONTROL_IDS = Object.freeze([
  CONTROL_IDS.RBAC_ROLE_SEGREGATION,
  CONTROL_IDS.BYO_ENTRA_ONBOARDING,
  CONTROL_IDS.SECRET_ROTATION,
  CONTROL_IDS.POLICY_AS_CODE_ENFORCEMENT,
  CONTROL_IDS.CI_CD_VALIDATION_GATES,
  CONTROL_IDS.ACCESS_LEAST_PRIVILEGE,
  CONTROL_IDS.APPROVAL_GATES,
]);

const ROLE_CATALOG = Object.freeze([
  { role: "foundryAdmin", allowedHighRiskRoles: ["Owner"], approvalRequired: true },
  { role: "indexer", allowedHighRiskRoles: [], approvalRequired: false },
  { role: "reviewer", allowedHighRiskRoles: [], approvalRequired: false },
  { role: "approver", allowedHighRiskRoles: [], approvalRequired: true },
  { role: "securityOperator", allowedHighRiskRoles: ["Privileged Role Administrator"], approvalRequired: true },
]);

export function buildCopilotControlSystemProfile() {
  const baseline = getPolicyProfile(SOLUTION_IDS.M365_COPILOT);
  return {
    solutionId: SOLUTION_IDS.M365_COPILOT,
    profileVersion: "2026.06.1",
    baselineControls: baseline?.controls ?? [],
    lesson2Controls: LESSON2_CONTROL_IDS.map((controlId) => ({
      controlId,
      enforcementLevel: "required",
      rationale: `Lesson 2 control for ${controlId}`,
      evidenceArtifacts: getEvidenceArtifactsForControl(controlId),
    })),
  };
}

export function buildRoleCatalog() {
  return [...ROLE_CATALOG];
}

/**
 * @param {Array<{ principalId: string; role: string; assignedRole: string }>} assignments
 */
export function validateRoleAssignments(assignments) {
  /** @type {string[]} */
  const errors = [];
  for (const assignment of assignments) {
    const catalogRole = ROLE_CATALOG.find((entry) => entry.role === assignment.role);
    if (!catalogRole) {
      errors.push(`Unknown control-system role: ${assignment.role}`);
      continue;
    }
    const highRisk = isHighRiskPermission(assignment.assignedRole, "rbacRole");
    if (highRisk && !catalogRole.allowedHighRiskRoles.includes(assignment.assignedRole)) {
      errors.push(`${assignment.role} cannot hold high-risk role ${assignment.assignedRole}`);
    }
  }
  return errors.length > 0 ? { ok: false, errors } : { ok: true };
}

/**
 * @param {{
 *   tenantId: string;
 *   clientId: string;
 *   redirectUri: string;
 *   scopes: string[];
 * }} input
 */
export function buildByoEntraOnboardingPackage(input) {
  const scopeParam = encodeURIComponent(input.scopes.join(" "));
  return {
    tenantId: input.tenantId,
    clientId: input.clientId,
    redirectUri: input.redirectUri,
    adminConsentUrl: `https://login.microsoftonline.com/${input.tenantId}/adminconsent?client_id=${input.clientId}&redirect_uri=${encodeURIComponent(input.redirectUri)}&scope=${scopeParam}`,
    steps: [
      "Register or verify the dedicated Entra application.",
      "Grant admin consent for required application permissions.",
      "Store secrets or certificates in Key Vault only.",
      "Record onboarding evidence and owner assignment.",
    ],
  };
}

export function buildKeyVaultRotationPlan(input = {}) {
  const rotationDays = input.rotationDays ?? 30;
  return {
    vaultName: input.vaultName ?? "frontieriq-kv",
    rotationDays,
    owners: input.owners ?? ["securityRepresentative", "coeLead"],
    secretTypes: input.secretTypes ?? ["clientSecret", "signingKey", "apiKey"],
  };
}

export function buildPolicyAsCodeCatalog() {
  return buildPolicyCatalog(SOLUTION_IDS.M365_COPILOT);
}

/**
 * @param {{
 *   manifests: Array<Parameters<typeof validateSkillManifest>[0]>;
 *   assignments: Array<{ principalId: string; role: string; assignedRole: string }>;
 * }} input
 */
export function buildCiCdComplianceBundle(input) {
  const manifestResults = input.manifests.map((manifest) => ({
    skillId: manifest.skillId,
    validation: validateSkillManifest(manifest),
  }));
  const roleValidation = validateRoleAssignments(input.assignments);
  const passed =
    manifestResults.every((result) => result.validation.ok) &&
    roleValidation.ok === true;

  return {
    passed,
    manifestResults,
    roleValidation,
    policyCatalog: buildPolicyAsCodeCatalog(),
  };
}

/**
 * @param {{
 *   manifests: Array<Parameters<typeof validateSkillManifest>[0]>;
 *   assignments: Array<{ principalId: string; role: string; assignedRole: string }>;
 *   onboardingPackage?: ReturnType<typeof buildByoEntraOnboardingPackage>;
 *   keyVaultPlan?: ReturnType<typeof buildKeyVaultRotationPlan>;
 * }} input
 */
export function summarizeControlSystemPosture(input) {
  const ciCdBundle = buildCiCdComplianceBundle({
    manifests: input.manifests,
    assignments: input.assignments,
  });
  return {
    solutionId: SOLUTION_IDS.M365_COPILOT,
    totalLesson2Controls: LESSON2_CONTROL_IDS.length,
    validManifests: ciCdBundle.manifestResults.filter((result) => result.validation.ok).length,
    totalManifests: ciCdBundle.manifestResults.length,
    roleAssignmentsValid: ciCdBundle.roleValidation.ok === true,
    onboardingReady: Boolean(input.onboardingPackage?.adminConsentUrl),
    keyVaultRotationReady: Boolean(input.keyVaultPlan?.rotationDays),
    failedChecks: collectFailedChecks(ciCdBundle),
  };
}

function collectFailedChecks(bundle) {
  const failed = [];
  for (const result of bundle.manifestResults) {
    if (!result.validation.ok) {
      failed.push(`manifest:${result.skillId}`);
    }
  }
  if (!bundle.roleValidation.ok) {
    failed.push("role-assignments");
  }
  return failed;
}
