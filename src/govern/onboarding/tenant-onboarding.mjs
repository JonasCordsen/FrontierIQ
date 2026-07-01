import { SOLUTION_IDS } from "../../observe/foundation/solution-taxonomy.mjs";
import { isHighRiskPermission } from "../../secure/permissions/high-risk-rules.mjs";
import { buildByoEntraOnboardingPackage, buildKeyVaultRotationPlan } from "../control-system/m365-copilot-control-system.mjs";
import { CONTROL_IDS } from "../policy/control-catalog.mjs";
import { EVIDENCE_ARTIFACTS, getEvidenceArtifactsForControl } from "../policy/evidence-mapping.mjs";
import {
  buildPolicyCatalog,
  evaluateTenantOnboardingPolicies,
  getPolicyIdsForControl,
} from "../policy/policy-catalog.mjs";

const CONTROL_SEQUENCE = Object.freeze([
  CONTROL_IDS.BYO_ENTRA_ONBOARDING,
  CONTROL_IDS.SECRET_ROTATION,
  CONTROL_IDS.APPROVAL_GATES,
  CONTROL_IDS.AUDIT_TRACEABILITY,
  CONTROL_IDS.DATA_RESIDENCY_ENFORCEMENT,
  CONTROL_IDS.REGIONAL_STORAGE_ALIGNMENT,
]);

const PROVISIONING_MODES = new Set(["create", "reference"]);
const CREDENTIAL_STRATEGIES = new Set(["clientSecret", "certificate"]);

/**
 * @param {{
 *   tenantId: string;
 *   solutionId?: string;
 *   redirectUri: string;
 *   appDisplayName: string;
 *   environment: "prod"|"nonprod";
 *   location: string;
 *   dataBoundary: string;
 *   approvalTicket?: string;
 *   owners: string[];
 *   credentialStrategy: (
 *     | { type: "clientSecret"; secretName: string; rotationDays?: number; expiryDays?: number }
 *     | { type: "certificate"; certificateName: string; validityDays?: number; rolloverDays?: number; subjectName: string; keySize?: number; algorithm?: string }
 *   );
 *   permissions: Array<{
 *     resourceAppId: string;
 *     resourceName: string;
 *     appRoles?: string[];
 *     delegatedScopes?: string[];
 *   }>;
 *   resources: Array<{
 *     type: string;
 *     name: string;
 *     provisioningMode: "create"|"reference";
 *     apiProfile: string;
 *     location?: string;
 *     sku?: string;
 *     dependsOn?: string[];
 *     identity?: { type: string; userAssignedIdentities?: string[] };
 *     tags?: Record<string, string>;
 *   }>;
 *   keyVault?: {
 *     vaultName: string;
 *     provisioningMode: "create"|"reference";
 *     secretTypes?: string[];
 *   };
 * }} input
 */
export function validateTenantOnboardingRequest(input) {
  /** @type {string[]} */
  const errors = [];

  if (!input.tenantId) errors.push("tenantId is required");
  if (!input.appDisplayName) errors.push("appDisplayName is required");
  if (input.environment !== "prod" && input.environment !== "nonprod") {
    errors.push("environment must be prod or nonprod");
  }
  if (!isHttpsUrl(input.redirectUri)) {
    errors.push("redirectUri must be an https URL");
  }
  if (!input.location) errors.push("location is required");
  if (!input.dataBoundary) errors.push("dataBoundary is required");
  if (!Array.isArray(input.owners) || input.owners.length === 0) {
    errors.push("owners must be a non-empty array");
  }
  if (!CREDENTIAL_STRATEGIES.has(input.credentialStrategy?.type)) {
    errors.push("credentialStrategy.type must be clientSecret or certificate");
  } else {
    validateCredentialStrategy(input.credentialStrategy, errors);
  }
  if (!Array.isArray(input.permissions) || input.permissions.length === 0) {
    errors.push("permissions must be a non-empty array");
  }
  if (!Array.isArray(input.resources) || input.resources.length === 0) {
    errors.push("resources must be a non-empty array");
  } else {
    validateResources(input.resources, errors);
  }
  if (!input.keyVault?.vaultName) {
    errors.push("keyVault.vaultName is required");
  }
  if (input.keyVault && !PROVISIONING_MODES.has(input.keyVault.provisioningMode)) {
    errors.push("keyVault.provisioningMode must be create or reference");
  }

  const normalizedPermissions = normalizePermissions(input.permissions ?? []);

  if (errors.length > 0) return { ok: false, errors };

  const solutionId = input.solutionId ?? SOLUTION_IDS.M365_COPILOT;
  const normalizedResources = normalizeResources(input.resources);
  const policyCatalog = buildPolicyCatalog(solutionId);
  const policyEvaluation = evaluateTenantOnboardingPolicies({
    solutionId,
    approvalTicket: input.approvalTicket ?? null,
    permissions: normalizedPermissions,
    resources: normalizedResources,
  }, policyCatalog);
  if (!policyEvaluation.ok) {
    return { ok: false, errors: policyEvaluation.errors };
  }

  return {
    ok: true,
    value: {
      tenantId: input.tenantId,
      solutionId,
      redirectUri: normalizeRedirectUri(input.redirectUri),
      appDisplayName: input.appDisplayName,
      environment: input.environment,
      location: input.location,
      dataBoundary: input.dataBoundary,
      approvalTicket: input.approvalTicket ?? null,
      owners: [...new Set(input.owners)].sort((a, b) => a.localeCompare(b)),
      credentialStrategy: normalizeCredentialStrategy(input.credentialStrategy),
      permissions: normalizedPermissions,
      resources: normalizedResources,
      keyVault: normalizeKeyVault(input.keyVault),
      hasHighRiskPermission: policyEvaluation.hasHighRiskPermission,
      policyVersion: policyEvaluation.policyVersion,
      matchedPolicyIds: policyEvaluation.matchedPolicyIds,
    },
  };
}

/**
 * @param {ReturnType<typeof validateTenantOnboardingRequest> extends { ok: true; value: infer T } ? T : never} request
 */
export function buildTenantOnboardingBundle(request) {
  const validated = requireValidatedRequest(request);
  const clientId = deterministicClientId(validated.tenantId, validated.appDisplayName);
  const onboardingPackage = buildByoEntraOnboardingPackage({
    tenantId: validated.tenantId,
    clientId,
    redirectUri: validated.redirectUri,
    scopes: flattenPermissionNames(validated.permissions),
  });
  const keyVaultManifest = buildTenantKeyVaultProvisioningManifest(validated);
  const templateContract = buildTenantResourceTemplateContract(validated);
  const scriptPack = buildTenantOnboardingScriptPack(validated, {
    clientId,
    keyVaultManifest,
  });
  const controlArtifacts = Object.fromEntries(
    CONTROL_SEQUENCE.map((controlId) => [controlId, getEvidenceArtifactsForControl(controlId)])
  );
  const readiness = summarizeTenantOnboardingReadiness({
    request: validated,
    onboardingPackage,
    keyVaultManifest,
    templateContract,
    scriptPack,
  });

  return {
    schemaVersion: "2026.06.1",
    tenantId: validated.tenantId,
    solutionId: validated.solutionId,
    environment: validated.environment,
    approvalTicket: validated.approvalTicket,
    owners: validated.owners,
    policyVersion: validated.policyVersion,
    policyIds: validated.matchedPolicyIds,
    controlIds: [...CONTROL_SEQUENCE],
    evidenceArtifacts: [...new Set(Object.values(controlArtifacts).flat())].sort((a, b) => a.localeCompare(b)),
    onboardingPackage,
    appRegistration: {
      appDisplayName: validated.appDisplayName,
      clientId,
      redirectUri: validated.redirectUri,
      credentialStrategy: validated.credentialStrategy,
      requiredResourceAccess: validated.permissions,
    },
    keyVaultManifest,
    templateContract,
    scriptPack,
    readiness,
  };
}

/**
 * @param {ReturnType<typeof validateTenantOnboardingRequest> extends { ok: true; value: infer T } ? T : never} request
 */
export function buildTenantKeyVaultProvisioningManifest(request) {
  const validated = requireValidatedRequest(request);
  const rotationPlan = buildKeyVaultRotationPlan({
    vaultName: validated.keyVault.vaultName,
    rotationDays: validated.credentialStrategy.type === "clientSecret"
      ? (validated.credentialStrategy.rotationDays ?? 30)
      : (validated.credentialStrategy.rolloverDays ?? 30),
    owners: validated.owners,
    secretTypes: validated.keyVault.secretTypes,
  });

  const secrets = validated.credentialStrategy.type === "clientSecret"
    ? [
        {
          name: validated.credentialStrategy.secretName,
          kind: "clientSecret",
          expiryDays: validated.credentialStrategy.expiryDays,
          rotationDays: validated.credentialStrategy.rotationDays,
        },
      ]
    : [
        {
          name: validated.credentialStrategy.certificateName,
          kind: "certificate",
          validityDays: validated.credentialStrategy.validityDays,
          rolloverDays: validated.credentialStrategy.rolloverDays,
          subjectName: validated.credentialStrategy.subjectName,
          keySize: validated.credentialStrategy.keySize,
          algorithm: validated.credentialStrategy.algorithm,
        },
      ];

  return {
    schemaVersion: "2026.06.1",
    vaultName: rotationPlan.vaultName,
    provisioningMode: validated.keyVault.provisioningMode,
    owners: rotationPlan.owners,
    rotationDays: rotationPlan.rotationDays,
    secrets,
    evidenceArtifact: EVIDENCE_ARTIFACTS.KEYVAULT_ROTATION_PLAN,
  };
}

/**
 * @param {ReturnType<typeof validateTenantOnboardingRequest> extends { ok: true; value: infer T } ? T : never} request
 */
export function buildTenantResourceTemplateContract(request) {
  const validated = requireValidatedRequest(request);
  return {
    schemaVersion: "2026.06.1",
    templateFormat: "bicep-ready",
    solutionId: validated.solutionId,
    tenantId: validated.tenantId,
    environment: validated.environment,
    location: validated.location,
    dataBoundary: validated.dataBoundary,
    controlIds: [
      CONTROL_IDS.BYO_ENTRA_ONBOARDING,
      CONTROL_IDS.SECRET_ROTATION,
      CONTROL_IDS.DATA_RESIDENCY_ENFORCEMENT,
      CONTROL_IDS.REGIONAL_STORAGE_ALIGNMENT,
    ],
    resources: validated.resources,
    secretRefs: buildSecretRefs(validated),
    roleAssignments: [
      {
        ownerIds: validated.owners,
        scope: validated.keyVault.vaultName,
        role: "Key Vault Secrets Officer",
      },
    ],
    outputs: {
      tenantId: validated.tenantId,
      location: validated.location,
      keyVaultName: validated.keyVault.vaultName,
    },
    evidenceArtifact: EVIDENCE_ARTIFACTS.TENANT_RESOURCE_TEMPLATE,
  };
}

/**
 * @param {ReturnType<typeof validateTenantOnboardingRequest> extends { ok: true; value: infer T } ? T : never} request
 * @param {{ clientId: string; keyVaultManifest: ReturnType<typeof buildTenantKeyVaultProvisioningManifest> }} context
 */
export function buildTenantOnboardingScriptPack(request, context) {
  const validated = requireValidatedRequest(request);
  const permissionLabels = flattenPermissionNames(validated.permissions);
  return {
    schemaVersion: "2026.06.1",
    clientId: context.clientId,
    steps: [
      {
        name: "register-entra-app",
        command: "az ad app create",
        args: [
          `--display-name ${shellQuote(validated.appDisplayName)}`,
          `--sign-in-audience AzureADMyOrg`,
          `--web-redirect-uris ${shellQuote(validated.redirectUri)}`,
        ],
      },
      {
        name: "grant-admin-consent",
        command: "browser-open",
        args: [shellQuote(`https://login.microsoftonline.com/${validated.tenantId}/adminconsent?client_id=${context.clientId}&redirect_uri=${encodeURIComponent(validated.redirectUri)}`)],
      },
      {
        name: "provision-keyvault-secrets",
        command: "az keyvault secret set",
        args: context.keyVaultManifest.secrets.map((secret) =>
          `--vault-name ${shellQuote(context.keyVaultManifest.vaultName)} --name ${shellQuote(secret.name)} --value <generated-at-runtime>`
        ),
      },
      {
        name: "deploy-tenant-template",
        command: "az deployment group create",
        args: [
          `--template-file tenant-onboarding.bicep`,
          `--parameters tenantId=${shellQuote(validated.tenantId)} location=${shellQuote(validated.location)} keyVaultName=${shellQuote(validated.keyVault.vaultName)}`,
        ],
      },
    ],
    permissionSummary: permissionLabels,
    evidenceArtifact: EVIDENCE_ARTIFACTS.TENANT_ONBOARDING_SCRIPT_PACK,
  };
}

/**
 * @param {{
 *   request: ReturnType<typeof validateTenantOnboardingRequest> extends { ok: true; value: infer T } ? T : never;
 *   onboardingPackage: ReturnType<typeof buildByoEntraOnboardingPackage>;
 *   keyVaultManifest: ReturnType<typeof buildTenantKeyVaultProvisioningManifest>;
 *   templateContract: ReturnType<typeof buildTenantResourceTemplateContract>;
 *   scriptPack: ReturnType<typeof buildTenantOnboardingScriptPack>;
 * }} input
 */
export function summarizeTenantOnboardingReadiness(input) {
  const request = requireValidatedRequest(input.request);
  const policyCatalog = buildPolicyCatalog(request.solutionId);
  const checks = {
    [CONTROL_IDS.BYO_ENTRA_ONBOARDING]: {
      status: input.onboardingPackage.adminConsentUrl ? "ready" : "blocked",
      evidenceArtifacts: getEvidenceArtifactsForControl(CONTROL_IDS.BYO_ENTRA_ONBOARDING),
      policyIds: getPolicyIdsForControl(policyCatalog, CONTROL_IDS.BYO_ENTRA_ONBOARDING, "tenantOnboarding"),
      failedChecks: input.onboardingPackage.adminConsentUrl ? [] : ["missing-admin-consent-url"],
    },
    [CONTROL_IDS.SECRET_ROTATION]: {
      status: input.keyVaultManifest.secrets.length > 0 ? "ready" : "blocked",
      evidenceArtifacts: getEvidenceArtifactsForControl(CONTROL_IDS.SECRET_ROTATION),
      policyIds: getPolicyIdsForControl(policyCatalog, CONTROL_IDS.SECRET_ROTATION, "tenantOnboarding"),
      failedChecks: input.keyVaultManifest.secrets.length > 0 ? [] : ["missing-keyvault-secrets"],
    },
    [CONTROL_IDS.APPROVAL_GATES]: {
      status: request.hasHighRiskPermission && !request.approvalTicket ? "blocked" : "ready",
      evidenceArtifacts: getEvidenceArtifactsForControl(CONTROL_IDS.APPROVAL_GATES),
      policyIds: getPolicyIdsForControl(policyCatalog, CONTROL_IDS.APPROVAL_GATES, "tenantOnboarding"),
      failedChecks: request.hasHighRiskPermission && !request.approvalTicket ? ["missing-approval-ticket"] : [],
    },
    [CONTROL_IDS.AUDIT_TRACEABILITY]: {
      status: request.owners.length > 0 ? "ready" : "blocked",
      evidenceArtifacts: getEvidenceArtifactsForControl(CONTROL_IDS.AUDIT_TRACEABILITY),
      policyIds: getPolicyIdsForControl(policyCatalog, CONTROL_IDS.AUDIT_TRACEABILITY, "tenantOnboarding"),
      failedChecks: request.owners.length > 0 ? [] : ["missing-owners"],
    },
    [CONTROL_IDS.DATA_RESIDENCY_ENFORCEMENT]: {
      status: input.templateContract.location ? "ready" : "blocked",
      evidenceArtifacts: getEvidenceArtifactsForControl(CONTROL_IDS.DATA_RESIDENCY_ENFORCEMENT),
      policyIds: getPolicyIdsForControl(policyCatalog, CONTROL_IDS.DATA_RESIDENCY_ENFORCEMENT, "tenantOnboarding"),
      failedChecks: input.templateContract.location ? [] : ["missing-location"],
    },
    [CONTROL_IDS.REGIONAL_STORAGE_ALIGNMENT]: {
      status: input.templateContract.resources.some((resource) =>
        resource.type === "Microsoft.Storage/storageAccounts" || resource.type === "Microsoft.KeyVault/vaults"
      )
        ? "ready"
        : "blocked",
      evidenceArtifacts: getEvidenceArtifactsForControl(CONTROL_IDS.REGIONAL_STORAGE_ALIGNMENT),
      policyIds: getPolicyIdsForControl(policyCatalog, CONTROL_IDS.REGIONAL_STORAGE_ALIGNMENT, "tenantOnboarding"),
      failedChecks: input.templateContract.resources.some((resource) =>
        resource.type === "Microsoft.Storage/storageAccounts" || resource.type === "Microsoft.KeyVault/vaults"
      )
        ? []
        : ["missing-regional-resource"],
    },
  };

  return {
    solutionId: request.solutionId,
    tenantId: request.tenantId,
    policyVersion: request.policyVersion,
    policyIds: request.matchedPolicyIds,
    overallStatus: Object.values(checks).every((check) => check.status === "ready") ? "ready" : "blocked",
    checks,
    failedChecks: Object.values(checks).flatMap((check) => check.failedChecks),
  };
}

function requireValidatedRequest(request) {
  if (!request || typeof request !== "object" || !request.tenantId) {
    throw new Error("validated tenant onboarding request is required");
  }
  return request;
}

function validateCredentialStrategy(strategy, errors) {
  if (strategy.type === "clientSecret") {
    if (!strategy.secretName) errors.push("credentialStrategy.secretName is required");
    if (typeof strategy.expiryDays !== "number" || strategy.expiryDays <= 0) {
      errors.push("credentialStrategy.expiryDays must be > 0 for clientSecret");
    }
  }
  if (strategy.type === "certificate") {
    if (!strategy.certificateName) errors.push("credentialStrategy.certificateName is required");
    if (!strategy.subjectName) errors.push("credentialStrategy.subjectName is required");
    if (typeof strategy.validityDays !== "number" || strategy.validityDays <= 0) {
      errors.push("credentialStrategy.validityDays must be > 0 for certificate");
    }
  }
}

function validateResources(resources, errors) {
  for (const resource of resources) {
    if (!PROVISIONING_MODES.has(resource.provisioningMode)) {
      errors.push(`invalid provisioningMode for ${resource.name}`);
    }
    if (!resource.name) {
      errors.push("resource.name is required");
    }
    if (!resource.apiProfile) {
      errors.push(`resource.apiProfile is required for ${resource.name}`);
    }
  }
}

function normalizeCredentialStrategy(strategy) {
  if (strategy.type === "clientSecret") {
    return {
      type: "clientSecret",
      secretName: strategy.secretName,
      rotationDays: strategy.rotationDays ?? 30,
      expiryDays: strategy.expiryDays,
    };
  }
  return {
    type: "certificate",
    certificateName: strategy.certificateName,
    validityDays: strategy.validityDays,
    rolloverDays: strategy.rolloverDays ?? 30,
    subjectName: strategy.subjectName,
    keySize: strategy.keySize ?? 2048,
    algorithm: strategy.algorithm ?? "RSA",
  };
}

function normalizePermissions(permissions) {
  return permissions
    .map((permission) => ({
      resourceAppId: permission.resourceAppId,
      resourceName: permission.resourceName,
      appRoles: [...new Set(permission.appRoles ?? [])].sort((a, b) => a.localeCompare(b)),
      delegatedScopes: [...new Set(permission.delegatedScopes ?? [])].sort((a, b) => a.localeCompare(b)),
    }))
    .sort((left, right) =>
      `${left.resourceName}:${left.resourceAppId}`.localeCompare(`${right.resourceName}:${right.resourceAppId}`)
    );
}

function normalizeResources(resources) {
  return resources
    .map((resource) => ({
      type: resource.type,
      name: resource.name,
      provisioningMode: resource.provisioningMode,
      apiProfile: resource.apiProfile,
      location: resource.location ?? null,
      sku: resource.sku ?? null,
      dependsOn: [...new Set(resource.dependsOn ?? [])].sort((a, b) => a.localeCompare(b)),
      identity: resource.identity ?? null,
      tags: sortObject(resource.tags ?? {}),
    }))
    .sort((left, right) => `${left.type}:${left.name}`.localeCompare(`${right.type}:${right.name}`));
}

function normalizeKeyVault(keyVault) {
  return {
    vaultName: keyVault.vaultName,
    provisioningMode: keyVault.provisioningMode,
    secretTypes: [...new Set(keyVault.secretTypes ?? ["clientSecret"])].sort((a, b) => a.localeCompare(b)),
  };
}

function flattenPermissionNames(permissions) {
  return permissions.flatMap((permission) => [
    ...permission.appRoles.map((role) => `${permission.resourceName}/${role}`),
    ...permission.delegatedScopes.map((scope) => `${permission.resourceName}/${scope}`),
  ]);
}

function buildSecretRefs(request) {
  if (request.credentialStrategy.type === "clientSecret") {
    return [`${request.keyVault.vaultName}/${request.credentialStrategy.secretName}`];
  }
  return [`${request.keyVault.vaultName}/${request.credentialStrategy.certificateName}`];
}

function deterministicClientId(tenantId, appDisplayName) {
  const source = `${tenantId}:${appDisplayName}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");
  const hex = Buffer.from(source).toString("hex").padEnd(32, "0").slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function sortObject(value) {
  return Object.fromEntries(
    Object.entries(value).sort(([left], [right]) => left.localeCompare(right))
  );
}

function normalizeRedirectUri(value) {
  return value.replace(/\/+$/, "");
}

function isHttpsUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\"'\"'`)}'`;
}
