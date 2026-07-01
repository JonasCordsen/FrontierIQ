/**
 * Tenant onboarding workflow contract.
 * Pillar: GOVERN
 *
 * Deterministic workflow planning and execution summary for tenant onboarding
 * readiness checkpoints.
 */

import {
  buildTenantOnboardingBundle,
  validateTenantOnboardingRequest,
} from "./tenant-onboarding.mjs";

const CHECKPOINT_IDS = Object.freeze([
  "validate-request",
  "approval-gate",
  "provisioning-bundle",
  "evidence-bundle",
]);

/**
 * Build deterministic onboarding workflow plan.
 * @param {object} requestInput
 * @param {string} generatedAt
 * @returns {{ ok: true, plan: object } | { ok: false, reason: string, errors: string[] }}
 */
export function buildOnboardingWorkflowPlan(requestInput, generatedAt = null) {
  const validated = validateTenantOnboardingRequest(requestInput);
  if (!validated.ok) {
    return { ok: false, reason: "invalid_request", errors: validated.errors };
  }

  const bundle = buildTenantOnboardingBundle(validated.value);
  const needsApproval = Boolean(validated.value.hasHighRiskPermission);
  const hasApprovalTicket = Boolean(validated.value.approvalTicket);
  const provisioningReady = Boolean(
    bundle.onboardingPackage &&
      bundle.keyVaultManifest &&
      bundle.templateContract &&
      bundle.scriptPack
  );
  const hasEvidence = Array.isArray(bundle.evidenceArtifacts) && bundle.evidenceArtifacts.length > 0;

  const checkpoints = [
    {
      id: "validate-request",
      label: "Validate onboarding request",
      status: "ready",
      reasonCodes: [],
    },
    {
      id: "approval-gate",
      label: "Verify approval gate",
      status: !needsApproval || hasApprovalTicket ? "ready" : "blocked",
      reasonCodes: !needsApproval || hasApprovalTicket ? [] : ["missing-approval-ticket"],
    },
    {
      id: "provisioning-bundle",
      label: "Build provisioning bundle",
      status: provisioningReady ? "ready" : "blocked",
      reasonCodes: provisioningReady ? [] : ["missing-provisioning-components"],
    },
    {
      id: "evidence-bundle",
      label: "Assemble onboarding evidence artifacts",
      status: hasEvidence ? "ready" : "blocked",
      reasonCodes: hasEvidence ? [] : ["missing-evidence-artifacts"],
    },
  ];

  const blocked = checkpoints.filter((checkpoint) => checkpoint.status === "blocked");
  return {
    ok: true,
    plan: {
      tenantId: validated.value.tenantId,
      solutionId: validated.value.solutionId,
      generatedAt,
      workflowVersion: "2026.06.1",
      checkpointIds: [...CHECKPOINT_IDS],
      checkpoints,
      overallStatus: blocked.length === 0 ? "ready" : "blocked",
      failedCheckpoints: blocked.flatMap((checkpoint) => checkpoint.reasonCodes),
      bundle,
    },
  };
}

/**
 * Evaluate checkpoint execution state.
 * @param {object} plan
 * @param {{ checkpointId: string, status: 'completed'|'failed'|'skipped', note?: string }[]} executions
 * @returns {{ overallStatus: string, checkpoints: object[], failedCheckpoints: string[] }}
 */
export function evaluateOnboardingWorkflowCheckpoints(plan, executions = []) {
  const checkpointMap = new Map((plan?.checkpoints ?? []).map((checkpoint) => [checkpoint.id, checkpoint]));
  const executionMap = new Map(
    (Array.isArray(executions) ? executions : []).map((execution) => [execution.checkpointId, execution])
  );

  const unknownExecutionIds = [...executionMap.keys()].filter((id) => !checkpointMap.has(id));
  const evaluated = [...checkpointMap.values()].map((checkpoint) => {
    const execution = executionMap.get(checkpoint.id);
    if (checkpoint.status === "blocked") {
      return {
        ...checkpoint,
        executionStatus: "blocked",
      };
    }
    if (!execution) {
      return {
        ...checkpoint,
        executionStatus: "pending",
      };
    }
    if (execution.status === "completed") {
      return {
        ...checkpoint,
        executionStatus: "completed",
      };
    }
    if (execution.status === "failed") {
      return {
        ...checkpoint,
        executionStatus: "failed",
        reasonCodes: [...checkpoint.reasonCodes, `execution-failed:${checkpoint.id}`],
      };
    }
    return {
      ...checkpoint,
      executionStatus: "skipped",
      reasonCodes: [...checkpoint.reasonCodes, `execution-skipped:${checkpoint.id}`],
    };
  });

  const failedCheckpoints = [
    ...evaluated.flatMap((checkpoint) => checkpoint.reasonCodes ?? []),
    ...unknownExecutionIds.map((id) => `unknown-checkpoint:${id}`),
  ];

  const hasBlocked = evaluated.some((checkpoint) => checkpoint.executionStatus === "blocked");
  const hasFailed = evaluated.some((checkpoint) => checkpoint.executionStatus === "failed");
  const hasPending = evaluated.some((checkpoint) => checkpoint.executionStatus === "pending");
  const hasUnknown = unknownExecutionIds.length > 0;

  const overallStatus = hasUnknown || hasBlocked || hasFailed
    ? "blocked"
    : hasPending
      ? "in_progress"
      : "completed";

  return {
    overallStatus,
    checkpoints: evaluated,
    failedCheckpoints,
  };
}

/**
 * Summarize onboarding workflow execution outcome.
 * @param {object} plan
 * @param {ReturnType<typeof evaluateOnboardingWorkflowCheckpoints>} evaluation
 * @returns {object}
 */
export function summarizeOnboardingWorkflowOutcome(plan, evaluation) {
  const checkpoints = Array.isArray(evaluation?.checkpoints) ? evaluation.checkpoints : [];
  const counts = checkpoints.reduce(
    (acc, checkpoint) => {
      const key = checkpoint.executionStatus ?? "pending";
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    },
    { completed: 0, pending: 0, failed: 0, blocked: 0, skipped: 0 }
  );

  return {
    tenantId: plan?.tenantId ?? null,
    solutionId: plan?.solutionId ?? null,
    overallStatus: evaluation?.overallStatus ?? "blocked",
    checkpointCount: checkpoints.length,
    counts,
    failedCheckpoints: evaluation?.failedCheckpoints ?? [],
    readyForActivation: evaluation?.overallStatus === "completed",
  };
}

