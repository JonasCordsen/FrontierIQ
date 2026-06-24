import { SOLUTION_IDS, isKnownSolution } from "../../observe/foundation/solution-taxonomy.mjs";
import { isHighRiskPermission } from "../../secure/permissions/high-risk-rules.mjs";
import { CONTROL_IDS } from "./control-catalog.mjs";

const POLICY_VERSION = "2026.06.1";
const POLICY_TARGETS = new Set(["skillManifest", "tenantOnboarding", "ingestion"]);
const POLICY_FAMILIES = new Set([
  "approval",
  "source-allowlist",
  "model-allowlist",
  "resource-allowlist",
  "retention",
  "cicd-gate",
]);

const ALLOWED_SKILL_DATA_SOURCES = Object.freeze([
  "azure-ai-foundry",
  "azure-ai-search",
  "exchange-online",
  "fabric-onelake",
  "microsoft-graph",
  "microsoft-purview",
  "sharepoint-online",
  "teams",
]);

const ALLOWED_MODEL_PROVIDERS = Object.freeze([
  "azure-ai-foundry",
  "azure-openai",
  "microsoft",
]);

const ALLOWED_ONBOARDING_RESOURCE_TYPES = Object.freeze([
  "Microsoft.CognitiveServices/accounts",
  "Microsoft.KeyVault/vaults",
  "Microsoft.ManagedIdentity/userAssignedIdentities",
  "Microsoft.Search/searchServices",
  "Microsoft.Storage/storageAccounts",
]);

const ALLOWED_INGESTION_SOURCES = Object.freeze([
  "azure-ai-foundry",
  "microsoft-graph",
  "microsoft-scenario-library",
]);

/**
 * @param {string} [solutionId]
 */
export function buildPolicyCatalog(solutionId = SOLUTION_IDS.M365_COPILOT) {
  if (!isKnownSolution(solutionId)) {
    throw new Error(`unknown solutionId: ${solutionId}`);
  }

  return {
    solutionId,
    policyVersion: POLICY_VERSION,
    policies: [
      {
        policyId: "skill.high-risk-approval",
        family: "approval",
        target: "skillManifest",
        severity: "high",
        description: "High-risk skills and high-risk permissions require approval ticketing.",
        controlIds: [CONTROL_IDS.APPROVAL_GATES, CONTROL_IDS.ACCESS_LEAST_PRIVILEGE],
        riskBands: ["high"],
        permissionKinds: ["appRole"],
      },
      {
        policyId: "skill.approved-data-sources",
        family: "source-allowlist",
        target: "skillManifest",
        severity: "high",
        description: "Skills must declare approved enterprise data sources.",
        controlIds: [CONTROL_IDS.POLICY_AS_CODE_ENFORCEMENT],
        field: "dataSources",
        allowedValues: [...ALLOWED_SKILL_DATA_SOURCES],
      },
      {
        policyId: "skill.approved-model-providers",
        family: "model-allowlist",
        target: "skillManifest",
        severity: "high",
        description: "Skills must declare approved model or provider dependencies.",
        controlIds: [CONTROL_IDS.POLICY_AS_CODE_ENFORCEMENT],
        field: "modelProviders",
        allowedValues: [...ALLOWED_MODEL_PROVIDERS],
      },
      {
        policyId: "skill.cicd-release-gates",
        family: "cicd-gate",
        target: "skillManifest",
        severity: "high",
        description: "Skills must pass CI/CD release gates before approval.",
        controlIds: [CONTROL_IDS.CI_CD_VALIDATION_GATES, CONTROL_IDS.RESPONSIBLE_AI_REVIEW],
        requiredFields: ["skillId", "name", "owner", "solutionId"],
        requiredFlags: ["testsPassed"],
        requireResponsibleAiReviewForRiskBands: ["high"],
      },
      {
        policyId: "tenant.high-risk-approval",
        family: "approval",
        target: "tenantOnboarding",
        severity: "high",
        description: "Tenant onboarding with high-risk permissions requires approval ticketing.",
        controlIds: [CONTROL_IDS.APPROVAL_GATES, CONTROL_IDS.BYO_ENTRA_ONBOARDING],
        riskBands: ["high"],
        permissionKinds: ["appRole", "delegatedScope"],
      },
      {
        policyId: "tenant.approved-resource-types",
        family: "resource-allowlist",
        target: "tenantOnboarding",
        severity: "high",
        description: "Tenant onboarding resources must stay inside the approved Azure resource set.",
        controlIds: [CONTROL_IDS.POLICY_AS_CODE_ENFORCEMENT, CONTROL_IDS.DATA_RESIDENCY_ENFORCEMENT],
        field: "resources",
        allowedValues: [...ALLOWED_ONBOARDING_RESOURCE_TYPES],
      },
      {
        policyId: "ingestion.approved-sources",
        family: "source-allowlist",
        target: "ingestion",
        severity: "high",
        description: "Ingestion pipelines may only collect from approved sources.",
        controlIds: [CONTROL_IDS.POLICY_AS_CODE_ENFORCEMENT],
        field: "sourceSystem",
        allowedValues: [...ALLOWED_INGESTION_SOURCES],
      },
      {
        policyId: "ingestion.retention-and-storage",
        family: "retention",
        target: "ingestion",
        severity: "medium",
        description: "Ingestion storage providers, retention classes, and durations must remain within policy.",
        controlIds: [CONTROL_IDS.DATA_RETENTION_POLICY, CONTROL_IDS.AUDIT_TRACEABILITY],
        allowedProviders: ["blob", "onelake"],
        allowedRetentionClasses: ["ephemeral", "short-term", "compliance"],
        minRetentionDaysByClass: {
          ephemeral: 1,
          "short-term": 7,
          compliance: 30,
        },
        maxRetentionDaysByClass: {
          ephemeral: 7,
          "short-term": 30,
          compliance: 3650,
        },
      },
    ],
  };
}

/**
 * @param {ReturnType<typeof buildPolicyCatalog>} catalog
 */
export function validatePolicyCatalog(catalog) {
  /** @type {string[]} */
  const errors = [];
  if (!catalog || typeof catalog !== "object") {
    return { ok: false, errors: ["catalog must be an object"] };
  }
  if (!isKnownSolution(catalog.solutionId)) {
    errors.push("catalog.solutionId is invalid or unknown");
  }
  if (catalog.policyVersion !== POLICY_VERSION) {
    errors.push(`catalog.policyVersion must be ${POLICY_VERSION}`);
  }
  if (!Array.isArray(catalog.policies) || catalog.policies.length === 0) {
    errors.push("catalog.policies must be a non-empty array");
  }

  for (const policy of catalog.policies ?? []) {
    if (!policy.policyId) errors.push("policyId is required");
    if (!POLICY_FAMILIES.has(policy.family)) errors.push(`invalid family for ${policy.policyId}`);
    if (!POLICY_TARGETS.has(policy.target)) errors.push(`invalid target for ${policy.policyId}`);
    if (!Array.isArray(policy.controlIds) || policy.controlIds.length === 0) {
      errors.push(`controlIds are required for ${policy.policyId}`);
    }
    if (!["low", "medium", "high"].includes(policy.severity)) {
      errors.push(`invalid severity for ${policy.policyId}`);
    }

    if (
      (policy.family === "source-allowlist" ||
        policy.family === "model-allowlist" ||
        policy.family === "resource-allowlist") &&
      (!Array.isArray(policy.allowedValues) || policy.allowedValues.length === 0)
    ) {
      errors.push(`allowedValues are required for ${policy.policyId}`);
    }
    if (policy.family === "retention") {
      if (!Array.isArray(policy.allowedProviders) || policy.allowedProviders.length === 0) {
        errors.push(`allowedProviders are required for ${policy.policyId}`);
      }
      if (!Array.isArray(policy.allowedRetentionClasses) || policy.allowedRetentionClasses.length === 0) {
        errors.push(`allowedRetentionClasses are required for ${policy.policyId}`);
      }
    }
    if (policy.family === "cicd-gate") {
      if (!Array.isArray(policy.requiredFields) || policy.requiredFields.length === 0) {
        errors.push(`requiredFields are required for ${policy.policyId}`);
      }
      if (!Array.isArray(policy.requiredFlags) || policy.requiredFlags.length === 0) {
        errors.push(`requiredFlags are required for ${policy.policyId}`);
      }
    }
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true };
}

/**
 * @param {ReturnType<typeof buildPolicyCatalog>} catalog
 * @param {"skillManifest"|"tenantOnboarding"|"ingestion"} target
 */
export function getPoliciesForTarget(catalog, target) {
  return catalog.policies.filter((policy) => policy.target === target);
}

/**
 * @param {ReturnType<typeof buildPolicyCatalog>} catalog
 * @param {string} controlId
 * @param {"skillManifest"|"tenantOnboarding"|"ingestion"} [target]
 */
export function getPolicyIdsForControl(catalog, controlId, target) {
  return catalog.policies
    .filter((policy) => policy.controlIds.includes(controlId) && (!target || policy.target === target))
    .map((policy) => policy.policyId);
}

/**
 * @param {{
 *   skillId: string;
 *   name: string;
 *   owner: string;
 *   solutionId: string;
 *   permissionScopes: string[];
 *   approvalTicket?: string;
 *   riskBand: "high"|"medium"|"low";
 *   testsPassed: boolean;
 *   dataSources?: string[];
 *   modelProviders?: string[];
 *   responsibleAiReviewed?: boolean;
 * }} manifest
 * @param {ReturnType<typeof buildPolicyCatalog>} [catalog]
 */
export function evaluateSkillManifestPolicies(manifest, catalog = buildPolicyCatalog(manifest.solutionId)) {
  const policyCatalog = catalog;
  const matchedPolicyIds = [];
  const violatedPolicyIds = [];
  /** @type {string[]} */
  const errors = [];
  const policies = getPoliciesForTarget(policyCatalog, "skillManifest");
  const highRiskScopes = (manifest.permissionScopes ?? []).filter((scope) =>
    isHighRiskPermission(scope, "appRole")
  );

  for (const policy of policies) {
    matchedPolicyIds.push(policy.policyId);
    switch (policy.family) {
      case "approval":
        if (
          policy.riskBands.includes(manifest.riskBand) ||
          highRiskScopes.some((scope) => isHighRiskPermission(scope, "appRole"))
        ) {
          if (!manifest.approvalTicket) {
            violatedPolicyIds.push(policy.policyId);
            errors.push(`${policy.policyId}: approvalTicket is required`);
          }
        }
        break;
      case "source-allowlist": {
        const values = normalizeStringList(manifest.dataSources);
        if (values.length === 0) {
          violatedPolicyIds.push(policy.policyId);
          errors.push(`${policy.policyId}: dataSources must declare at least one approved source`);
          break;
        }
        const disallowed = values.filter((value) => !policy.allowedValues.includes(value));
        if (disallowed.length > 0) {
          violatedPolicyIds.push(policy.policyId);
          errors.push(`${policy.policyId}: disallowed dataSources ${disallowed.join(", ")}`);
        }
        break;
      }
      case "model-allowlist": {
        const values = normalizeStringList(manifest.modelProviders);
        if (values.length === 0) {
          violatedPolicyIds.push(policy.policyId);
          errors.push(`${policy.policyId}: modelProviders must declare at least one approved provider`);
          break;
        }
        const disallowed = values.filter((value) => !policy.allowedValues.includes(value));
        if (disallowed.length > 0) {
          violatedPolicyIds.push(policy.policyId);
          errors.push(`${policy.policyId}: disallowed modelProviders ${disallowed.join(", ")}`);
        }
        break;
      }
      case "cicd-gate":
        for (const field of policy.requiredFields) {
          if (!manifest[field]) {
            violatedPolicyIds.push(policy.policyId);
            errors.push(`${policy.policyId}: ${field} is required`);
          }
        }
        for (const flag of policy.requiredFlags) {
          if (manifest[flag] !== true) {
            violatedPolicyIds.push(policy.policyId);
            errors.push(`${policy.policyId}: ${flag} must be true`);
          }
        }
        if (
          policy.requireResponsibleAiReviewForRiskBands.includes(manifest.riskBand) &&
          manifest.responsibleAiReviewed !== true
        ) {
          violatedPolicyIds.push(policy.policyId);
          errors.push(`${policy.policyId}: responsibleAiReviewed must be true for ${manifest.riskBand} risk`);
        }
        break;
      default:
        break;
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    matchedPolicyIds,
    violatedPolicyIds: [...new Set(violatedPolicyIds)],
    policyVersion: policyCatalog.policyVersion,
  };
}

/**
 * @param {{
 *   solutionId?: string;
 *   approvalTicket?: string | null;
 *   permissions?: Array<{ appRoles?: string[]; delegatedScopes?: string[] }>;
 *   resources?: Array<{ type: string }>;
 * }} request
 * @param {ReturnType<typeof buildPolicyCatalog>} [catalog]
 */
export function evaluateTenantOnboardingPolicies(
  request,
  catalog = buildPolicyCatalog(request.solutionId ?? SOLUTION_IDS.M365_COPILOT)
) {
  const policyCatalog = catalog;
  const matchedPolicyIds = [];
  const violatedPolicyIds = [];
  /** @type {string[]} */
  const errors = [];
  const policies = getPoliciesForTarget(policyCatalog, "tenantOnboarding");
  const permissionNames = (request.permissions ?? []).flatMap((permission) => [
    ...(permission.appRoles ?? []).map((value) => ({ kind: "appRole", value })),
    ...(permission.delegatedScopes ?? []).map((value) => ({ kind: "delegatedScope", value })),
  ]);
  const hasHighRiskPermission = permissionNames.some((permission) =>
    isHighRiskPermission(permission.value, permission.kind)
  );

  for (const policy of policies) {
    matchedPolicyIds.push(policy.policyId);
    switch (policy.family) {
      case "approval":
        if (hasHighRiskPermission && !request.approvalTicket) {
          violatedPolicyIds.push(policy.policyId);
          errors.push(`${policy.policyId}: approvalTicket is required`);
        }
        break;
      case "resource-allowlist": {
        const resourceTypes = normalizeStringList((request.resources ?? []).map((resource) => resource.type));
        const disallowed = resourceTypes.filter((value) => !policy.allowedValues.includes(value));
        if (disallowed.length > 0) {
          violatedPolicyIds.push(policy.policyId);
          errors.push(`${policy.policyId}: disallowed resource types ${disallowed.join(", ")}`);
        }
        break;
      }
      default:
        break;
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    matchedPolicyIds,
    violatedPolicyIds: [...new Set(violatedPolicyIds)],
    policyVersion: policyCatalog.policyVersion,
    hasHighRiskPermission,
  };
}

/**
 * @param {{
 *   solutionId?: string;
 *   sourceSystem: string;
 *   storageProvider: "blob"|"onelake";
 *   retentionClass: "ephemeral"|"short-term"|"compliance";
 *   retentionDays: number;
 * }} input
 * @param {ReturnType<typeof buildPolicyCatalog>} [catalog]
 */
export function evaluateIngestionPolicies(
  input,
  catalog = buildPolicyCatalog(input.solutionId ?? SOLUTION_IDS.M365_COPILOT)
) {
  const policyCatalog = catalog;
  const matchedPolicyIds = [];
  const violatedPolicyIds = [];
  /** @type {string[]} */
  const errors = [];
  const policies = getPoliciesForTarget(policyCatalog, "ingestion");

  for (const policy of policies) {
    matchedPolicyIds.push(policy.policyId);
    switch (policy.family) {
      case "source-allowlist":
        if (!policy.allowedValues.includes(input.sourceSystem)) {
          violatedPolicyIds.push(policy.policyId);
          errors.push(`${policy.policyId}: sourceSystem ${input.sourceSystem} is not approved`);
        }
        break;
      case "retention":
        if (!policy.allowedProviders.includes(input.storageProvider)) {
          violatedPolicyIds.push(policy.policyId);
          errors.push(`${policy.policyId}: storageProvider ${input.storageProvider} is not approved`);
        }
        if (!policy.allowedRetentionClasses.includes(input.retentionClass)) {
          violatedPolicyIds.push(policy.policyId);
          errors.push(`${policy.policyId}: retentionClass ${input.retentionClass} is not approved`);
        }
        if (
          input.retentionDays < policy.minRetentionDaysByClass[input.retentionClass] ||
          input.retentionDays > policy.maxRetentionDaysByClass[input.retentionClass]
        ) {
          violatedPolicyIds.push(policy.policyId);
          errors.push(
            `${policy.policyId}: retentionDays ${input.retentionDays} is outside ${input.retentionClass} policy range`
          );
        }
        break;
      default:
        break;
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    matchedPolicyIds,
    violatedPolicyIds: [...new Set(violatedPolicyIds)],
    policyVersion: policyCatalog.policyVersion,
  };
}

function normalizeStringList(values) {
  return [...new Set((values ?? []).map((value) => String(value)))].sort((left, right) =>
    left.localeCompare(right)
  );
}
