import { applyLifecycleTransition } from "./lifecycle-attestation.mjs";

const WORKFLOW_TYPES = Object.freeze([
  "onboarding",
  "incident-response",
  "token-rotation",
  "index-rehydration",
  "tenant-suspend-revoke",
]);

/**
 * @param {{ ownerRole?: string; notifyChannel?: string }} input
 */
export function buildOperatorPlaybookCatalog(input = {}) {
  const ownerRole = input.ownerRole ?? "platformOperator";
  const notifyChannel = input.notifyChannel ?? "ops@frontieriq.local";

  return {
    version: "2026.06.1",
    ownerRole,
    playbooks: [
      {
        playbookId: "tenant-onboarding",
        workflowType: "onboarding",
        title: "Tenant onboarding",
        triggerSignals: ["tenant_onboarding_requested", "tenant_onboarding_readiness_blocked"],
        requiredInputs: ["tenantOnboardingBundle"],
        automationScripts: ["register-entra-app", "grant-admin-consent", "provision-keyvault-secrets", "deploy-tenant-template"],
      },
      {
        playbookId: "incident-response",
        workflowType: "incident-response",
        title: "Incident response",
        triggerSignals: ["governance-decision", "overshare-incident", "overshare-enforcement"],
        requiredInputs: ["siemEvent", "siemRoute"],
        automationScripts: ["preserve-evidence", "open-review-case", "notify-soc"],
      },
      {
        playbookId: "token-rotation",
        workflowType: "token-rotation",
        title: "Token and secret rotation",
        triggerSignals: ["secret_rotation_due", "credential_expiry_imminent"],
        requiredInputs: ["keyVaultManifest", "secretStates"],
        automationScripts: ["az-keyvault-secret-set", "az-keyvault-certificate-import"],
      },
      {
        playbookId: "index-rehydration",
        workflowType: "index-rehydration",
        title: "Index rehydration",
        triggerSignals: ["connector_readiness_blocked", "indexing_failure_spike"],
        requiredInputs: ["connectorReadiness", "indexingJob", "runtimeTelemetry"],
        automationScripts: ["pause-indexing", "rehydrate-index", "validate-acl-purview", "resume-indexing"],
      },
      {
        playbookId: "tenant-suspend-revoke",
        workflowType: "tenant-suspend-revoke",
        title: "Tenant suspend and revoke",
        triggerSignals: ["governance-deny", "overshare-suspend"],
        requiredInputs: ["tenantLifecycle", "trigger"],
        automationScripts: ["disable-principal", "revoke-consent", "archive-tenant-assets"],
      },
    ],
    notifyChannel,
  };
}

/**
 * @param {{
 *   tenantOnboardingBundle: {
 *     tenantId: string;
 *     readiness: { overallStatus: "ready"|"blocked"; failedChecks: string[] };
 *     onboardingPackage: { adminConsentUrl: string };
 *     scriptPack: { steps: Array<{ name: string; command: string; args: string[] | string }> };
 *     evidenceArtifacts: string[];
 *   };
 * }} input
 */
export function buildOnboardingRunbookExecution(input) {
  const bundle = input.tenantOnboardingBundle;
  if (!bundle?.tenantId) throw new Error("tenantOnboardingBundle.tenantId is required");
  if (!bundle.onboardingPackage?.adminConsentUrl) {
    throw new Error("tenantOnboardingBundle.onboardingPackage.adminConsentUrl is required");
  }
  if (!Array.isArray(bundle.scriptPack?.steps) || bundle.scriptPack.steps.length === 0) {
    throw new Error("tenantOnboardingBundle.scriptPack.steps must be a non-empty array");
  }

  return {
    workflowType: "onboarding",
    tenantId: bundle.tenantId,
    status: bundle.readiness.overallStatus,
    failedChecks: [...bundle.readiness.failedChecks],
    automationSteps: bundle.scriptPack.steps.map((step) => ({
      stepId: step.name,
      command: step.command,
      args: Array.isArray(step.args) ? [...step.args] : [String(step.args)],
    })),
    evidenceArtifacts: [...new Set(bundle.evidenceArtifacts)].sort((left, right) => left.localeCompare(right)),
  };
}

/**
 * @param {{
 *   siemEvent: {
 *     tenantId: string;
 *     eventKind: string;
 *     outcome: string;
 *     severity: "low"|"medium"|"high"|"critical";
 *     recommendedPlaybookId?: string | null;
 *   };
 *   siemRoute: { routeId: string; targetQueue: string; destination: string; playbookId?: string | null } | null;
 *   incidentPlaybookCatalog: { playbooks: Array<{ playbookId: string; steps: Array<{ stepId: string; actionType: string; ownerRole: string; notes: string }> }> };
 * }} input
 */
export function buildIncidentResponseRunbookExecution(input) {
  if (!input.siemEvent?.tenantId) throw new Error("siemEvent.tenantId is required");
  if (!input.siemRoute?.routeId) {
    return {
      workflowType: "incident-response",
      tenantId: input.siemEvent.tenantId,
      status: "blocked",
      failedChecks: ["missing-siem-route"],
      escalation: null,
      responseSteps: [],
    };
  }

  const playbookId = input.siemEvent.recommendedPlaybookId ?? input.siemRoute.playbookId ?? null;
  const playbook = playbookId
    ? input.incidentPlaybookCatalog.playbooks.find((item) => item.playbookId === playbookId) ?? null
    : null;
  if (!playbook) {
    return {
      workflowType: "incident-response",
      tenantId: input.siemEvent.tenantId,
      status: "blocked",
      failedChecks: ["missing-incident-playbook"],
      escalation: {
        routeId: input.siemRoute.routeId,
        targetQueue: input.siemRoute.targetQueue,
        destination: input.siemRoute.destination,
      },
      responseSteps: [],
    };
  }

  return {
    workflowType: "incident-response",
    tenantId: input.siemEvent.tenantId,
    status: "ready",
    failedChecks: [],
    escalation: {
      routeId: input.siemRoute.routeId,
      targetQueue: input.siemRoute.targetQueue,
      destination: input.siemRoute.destination,
    },
    responseSteps: playbook.steps.map((step) => ({
      stepId: step.stepId,
      actionType: step.actionType,
      ownerRole: step.ownerRole,
      notes: step.notes,
    })),
  };
}

/**
 * @param {{
 *   keyVaultManifest: {
 *     vaultName: string;
 *     rotationDays: number;
 *     secrets: Array<{ name: string; kind: "clientSecret"|"certificate" }>;
 *   };
 *   secretStates?: Array<{ name: string; lastRotatedAt: string }>;
 *   asOfIso: string;
 * }} input
 */
export function buildTokenRotationRunbookExecution(input) {
  if (!input.keyVaultManifest?.vaultName) throw new Error("keyVaultManifest.vaultName is required");
  if (!Array.isArray(input.keyVaultManifest.secrets) || input.keyVaultManifest.secrets.length === 0) {
    throw new Error("keyVaultManifest.secrets must be a non-empty array");
  }
  if (Number.isNaN(Date.parse(input.asOfIso))) throw new Error("asOfIso must be ISO-8601");

  const stateByName = new Map((input.secretStates ?? []).map((item) => [item.name, item]));
  const dueSecrets = input.keyVaultManifest.secrets
    .filter((secret) => {
      const state = stateByName.get(secret.name);
      if (!state) return true;
      const last = Date.parse(state.lastRotatedAt);
      if (Number.isNaN(last)) return true;
      const dueAt = last + input.keyVaultManifest.rotationDays * 24 * 60 * 60 * 1000;
      return dueAt <= Date.parse(input.asOfIso);
    })
    .map((secret) => ({
      name: secret.name,
      kind: secret.kind,
      command:
        secret.kind === "certificate"
          ? "az keyvault certificate import"
          : "az keyvault secret set",
    }));

  return {
    workflowType: "token-rotation",
    vaultName: input.keyVaultManifest.vaultName,
    status: "ready",
    failedChecks: [],
    rotationDays: input.keyVaultManifest.rotationDays,
    dueSecrets,
  };
}

/**
 * @param {{
 *   connectorReadiness: Record<string, { status: "ready"|"blocked"; reasonCodes?: string[] }>;
 *   indexingJob: { jobId: string; sourceArtifactIds: string[] };
 *   runtimeTelemetry: { counters: { failureCount: number } };
 * }} input
 */
export function buildIndexRehydrationRunbookExecution(input) {
  if (!input.indexingJob?.jobId) throw new Error("indexingJob.jobId is required");
  const blockedChecks = Object.entries(input.connectorReadiness)
    .filter(([, check]) => check.status === "blocked")
    .map(([name]) => name);
  const rehydrationMode = blockedChecks.length > 0 || input.runtimeTelemetry.counters.failureCount > 0
    ? "full"
    : "incremental";

  return {
    workflowType: "index-rehydration",
    status: blockedChecks.length > 0 ? "blocked" : "ready",
    failedChecks: blockedChecks,
    rehydrationMode,
    steps: [
      { stepId: "pause-indexing", command: "frontieriq index pause" },
      { stepId: "rehydrate-index", command: `frontieriq index rehydrate --job ${input.indexingJob.jobId} --mode ${rehydrationMode}` },
      { stepId: "validate-acl-purview", command: "frontieriq index validate-security" },
      { stepId: "resume-indexing", command: "frontieriq index resume" },
    ],
  };
}

/**
 * @param {{
 *   tenantId: string;
 *   currentLifecycleState: "draft"|"pilot"|"approved"|"production"|"deprecated"|"archived";
 *   trigger: { source: "governance-decision"|"overshare-enforcement"; outcome: string; principalId: string; reasonCodes: string[] };
 * }} input
 */
export function buildTenantSuspendRevokeRunbookExecution(input) {
  if (!input.tenantId) throw new Error("tenantId is required");
  if (!input.trigger?.source) throw new Error("trigger.source is required");

  const suspendTransition = applyLifecycleTransition({
    itemId: input.tenantId,
    currentState: input.currentLifecycleState,
    nextState: "deprecated",
    changedBy: "securityOperator",
    reason: `${input.trigger.source}:${input.trigger.outcome}`,
  });

  const revokeTransition = suspendTransition.ok
    ? applyLifecycleTransition({
      itemId: input.tenantId,
      currentState: "deprecated",
      nextState: "archived",
      changedBy: "securityOperator",
      reason: "tenant_revoke_completed",
    })
    : { ok: false, errors: ["suspend-transition-failed"] };

  return {
    workflowType: "tenant-suspend-revoke",
    tenantId: input.tenantId,
    status: suspendTransition.ok && revokeTransition.ok ? "ready" : "blocked",
    failedChecks: [
      ...(suspendTransition.ok ? [] : suspendTransition.errors),
      ...(revokeTransition.ok ? [] : revokeTransition.errors),
    ],
    actions: [
      { action: "disable-principal", principalId: input.trigger.principalId },
      { action: "revoke-consent", reasonCodes: [...input.trigger.reasonCodes] },
      { action: "archive-tenant-assets", targetState: "archived" },
    ],
    lifecycleChanges: {
      suspendTransition: suspendTransition.ok ? suspendTransition.change : null,
      revokeTransition: revokeTransition.ok ? revokeTransition.change : null,
    },
  };
}

/**
 * @param {{
 *   catalog: ReturnType<typeof buildOperatorPlaybookCatalog>;
 *   onboarding: ReturnType<typeof buildOnboardingRunbookExecution>;
 *   incidentResponse: ReturnType<typeof buildIncidentResponseRunbookExecution>;
 *   tokenRotation: ReturnType<typeof buildTokenRotationRunbookExecution>;
 *   indexRehydration: ReturnType<typeof buildIndexRehydrationRunbookExecution>;
 *   tenantSuspendRevoke: ReturnType<typeof buildTenantSuspendRevokeRunbookExecution>;
 * }} input
 */
export function summarizeOperatorPlaybookReadiness(input) {
  const catalogValidation = validateOperatorPlaybookCatalog(input.catalog);
  const checks = {
    catalogCoverage: makeCheck(catalogValidation.ok, catalogValidation.ok ? [] : catalogValidation.errors),
    onboardingReady: makeCheck(input.onboarding.status === "ready", input.onboarding.failedChecks),
    incidentResponseReady: makeCheck(input.incidentResponse.status === "ready", input.incidentResponse.failedChecks),
    tokenRotationReady: makeCheck(input.tokenRotation.status === "ready", input.tokenRotation.failedChecks),
    indexRehydrationReady: makeCheck(input.indexRehydration.status === "ready", input.indexRehydration.failedChecks),
    tenantSuspendRevokeReady: makeCheck(input.tenantSuspendRevoke.status === "ready", input.tenantSuspendRevoke.failedChecks),
  };

  return {
    workflowTypes: [...WORKFLOW_TYPES],
    overallStatus: Object.values(checks).every((check) => check.status === "ready") ? "ready" : "blocked",
    checks,
    failedChecks: Object.values(checks).flatMap((check) => check.reasonCodes),
  };
}

/**
 * @param {ReturnType<typeof buildOperatorPlaybookCatalog>} catalog
 */
export function validateOperatorPlaybookCatalog(catalog) {
  /** @type {string[]} */
  const errors = [];
  if (!catalog || typeof catalog !== "object") return { ok: false, errors: ["catalog must be an object"] };
  if (typeof catalog.version !== "string" || !catalog.version) errors.push("catalog.version is required");
  if (!Array.isArray(catalog.playbooks) || catalog.playbooks.length === 0) {
    errors.push("catalog.playbooks must be a non-empty array");
  } else {
    const byWorkflow = new Set(catalog.playbooks.map((playbook) => playbook.workflowType));
    for (const workflowType of WORKFLOW_TYPES) {
      if (!byWorkflow.has(workflowType)) {
        errors.push(`missing workflow playbook: ${workflowType}`);
      }
    }
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true };
}

function makeCheck(ok, reasonCodes = []) {
  return {
    status: ok ? "ready" : "blocked",
    reasonCodes,
  };
}

