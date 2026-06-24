import { createDecisionTraceRecord } from "./audit-trace.mjs";
import { CONTROL_IDS } from "../policy/control-catalog.mjs";
import { getPolicyProfile } from "../policy/baseline-library.mjs";
import { isHighRiskPermission } from "../../secure/permissions/high-risk-rules.mjs";

/**
 * @typedef {{
 *   tenantId: string;
 *   solutionId: string;
 *   principalId: string;
 *   actionType: string;
 *   resourceId: string;
 *   permissionName?: string;
 *   permissionKind?: "appRole"|"delegatedScope"|"rbacRole"|"custom";
 *   riskBand?: "high"|"medium"|"low";
 * }} GovernanceRequest
 */

/**
 * @typedef {{
 *   ownerAssigned: boolean;
 *   regionCompliant: boolean;
 *   retentionConfigured: boolean;
 *   auditEnabled: boolean;
 *   raiReviewed: boolean;
 *   hasApprovalTicket: boolean;
 * }} GovernanceContext
 */

/**
 * AGT-aligned deterministic evaluation:
 * - evaluate known controls for the target solution profile
 * - fail-closed on missing critical controls
 * - high-risk permission or high risk-band requires approval
 *
 * @param {GovernanceRequest} request
 * @param {GovernanceContext} context
 */
export function evaluateGovernanceRequest(request, context) {
  const profile = getPolicyProfile(request.solutionId);
  if (!profile) {
    return decision("deny", request, ["No policy profile found for solution."], ["profile.missing"]);
  }

  /** @type {string[]} */
  const reasons = [];
  /** @type {string[]} */
  const missingControls = [];
  let effect = /** @type {"allow"|"deny"|"require_approval"} */ ("allow");

  if (!context.ownerAssigned) {
    missingControls.push(CONTROL_IDS.ACCESS_OWNER_ACCOUNTABILITY);
    reasons.push("Owner accountability is missing.");
  }
  if (!context.regionCompliant) {
    missingControls.push(CONTROL_IDS.DATA_RESIDENCY_ENFORCEMENT);
    reasons.push("Data residency is not compliant.");
  }
  if (!context.retentionConfigured) {
    missingControls.push(CONTROL_IDS.DATA_RETENTION_POLICY);
    reasons.push("Retention policy is not configured.");
  }
  if (!context.auditEnabled) {
    missingControls.push(CONTROL_IDS.AUDIT_TRACEABILITY);
    reasons.push("Audit traceability is not enabled.");
  }
  if (!context.raiReviewed && (request.riskBand === "high" || request.actionType === "deploy-agent")) {
    missingControls.push(CONTROL_IDS.RESPONSIBLE_AI_REVIEW);
    reasons.push("Responsible AI review is required for this request.");
  }

  // Hard deny conditions (fail-closed)
  if (
    missingControls.includes(CONTROL_IDS.DATA_RESIDENCY_ENFORCEMENT) ||
    missingControls.includes(CONTROL_IDS.AUDIT_TRACEABILITY)
  ) {
    effect = "deny";
  }

  // Approval gate conditions for risky actions
  const riskyPermission =
    request.permissionName &&
    request.permissionKind &&
    isHighRiskPermission(request.permissionName, request.permissionKind);
  if (effect !== "deny" && (request.riskBand === "high" || riskyPermission)) {
    if (!context.hasApprovalTicket) {
      effect = "require_approval";
      reasons.push("High-risk request requires approval ticket.");
      missingControls.push(CONTROL_IDS.APPROVAL_GATES);
    }
  }

  return decision(effect, request, reasons, missingControls);
}

/**
 * @param {"allow"|"deny"|"require_approval"} effect
 * @param {GovernanceRequest} request
 * @param {string[]} reasons
 * @param {string[]} missingControls
 */
function decision(effect, request, reasons, missingControls) {
  const evaluatedAt = new Date().toISOString();
  const dedupedMissingControls = [...new Set(missingControls)];
  const dedupedReasons = [...new Set(reasons)];
  const trace = createDecisionTraceRecord({
    tenantId: request.tenantId,
    solutionId: request.solutionId,
    principalId: request.principalId,
    actionType: request.actionType,
    resourceId: request.resourceId,
    decision: effect,
    reasons: dedupedReasons,
    enforcedControls: dedupedMissingControls,
    evaluatedAt,
    metadata: {
      riskBand: request.riskBand ?? "unknown",
      permissionName: request.permissionName ?? "n/a",
    },
  });

  return {
    effect,
    reasons: dedupedReasons,
    missingControls: dedupedMissingControls,
    trace,
  };
}

