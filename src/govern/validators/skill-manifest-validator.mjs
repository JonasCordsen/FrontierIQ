import { isHighRiskPermission } from "../../secure/permissions/high-risk-rules.mjs";
import { evaluateSkillManifestPolicies } from "../policy/policy-catalog.mjs";

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
 */
export function validateSkillManifest(manifest) {
  /** @type {string[]} */
  const errors = [];
  if (!manifest.skillId) errors.push("skillId is required");
  if (!manifest.name) errors.push("name is required");
  if (!manifest.owner) errors.push("owner is required");
  if (!manifest.solutionId) errors.push("solutionId is required");
  if (!Array.isArray(manifest.permissionScopes)) errors.push("permissionScopes must be an array");
  if (!["high", "medium", "low"].includes(manifest.riskBand)) errors.push("riskBand is invalid");
  if (manifest.testsPassed !== true) errors.push("testsPassed must be true");
  if (manifest.dataSources !== undefined && !Array.isArray(manifest.dataSources)) {
    errors.push("dataSources must be an array when provided");
  }
  if (manifest.modelProviders !== undefined && !Array.isArray(manifest.modelProviders)) {
    errors.push("modelProviders must be an array when provided");
  }
  if (manifest.responsibleAiReviewed !== undefined && typeof manifest.responsibleAiReviewed !== "boolean") {
    errors.push("responsibleAiReviewed must be a boolean when provided");
  }

  const hasHighRiskScope = (manifest.permissionScopes ?? []).some((scope) =>
    isHighRiskPermission(scope, "appRole")
  );
  if ((manifest.riskBand === "high" || hasHighRiskScope) && !manifest.approvalTicket) {
    errors.push("approvalTicket is required for high-risk manifests.");
  }

  const policyEvaluation = evaluateSkillManifestPolicies(manifest);
  errors.push(...policyEvaluation.errors);

  if (errors.length > 0) {
    return {
      ok: false,
      errors: [...new Set(errors)],
      matchedPolicyIds: policyEvaluation.matchedPolicyIds,
      violatedPolicyIds: policyEvaluation.violatedPolicyIds,
      policyVersion: policyEvaluation.policyVersion,
    };
  }
  return {
    ok: true,
    matchedPolicyIds: policyEvaluation.matchedPolicyIds,
    violatedPolicyIds: [],
    policyVersion: policyEvaluation.policyVersion,
  };
}

export function summarizeManifestRisk(manifest) {
  const highRiskScopes = (manifest.permissionScopes ?? []).filter((scope) =>
    isHighRiskPermission(scope, "appRole")
  );
  return {
    riskBand: manifest.riskBand,
    highRiskScopeCount: highRiskScopes.length,
    highRiskScopes,
  };
}
