/**
 * Governance rules engine contract.
 * Pillar: GOVERN
 *
 * Deterministic rule evaluation and decision evidence contract for governance
 * approvals.
 */

import { buildGovernanceMatrix, buildRiskTaxonomy } from "./governance-matrix-risk-taxonomy.mjs";

const SUPPORTED_RULES = Object.freeze([
  "risk-band-resolution",
  "control-coverage",
  "reviewer-coverage",
  "review-gate-alignment",
]);

/**
 * Evaluate governance rules for an asset request.
 * @param {{
 *   assetType: 'agent'|'skill';
 *   riskScore: number;
 *   controlsPresent?: string[];
 *   reviewersPresent?: string[];
 *   requestedReviewGate?: string;
 *   enabledRules?: string[];
 * }} input
 * @returns {object}
 */
export function evaluateGovernanceRules(input = {}) {
  const taxonomy = buildRiskTaxonomy();
  const matrix = buildGovernanceMatrix();
  const enabledRules = Array.isArray(input.enabledRules) ? input.enabledRules : [...SUPPORTED_RULES];

  const unsupportedRules = enabledRules.filter((rule) => !SUPPORTED_RULES.includes(rule));
  if (unsupportedRules.length > 0) {
    return {
      allowed: false,
      status: "blocked",
      reasonCodes: unsupportedRules.map((rule) => `unknown-rule:${rule}`),
      checks: {},
    };
  }

  const riskBand = resolveRiskBand(input.riskScore, taxonomy);
  const mapping = matrix.mappings.find(
    (item) => item.assetType === input.assetType && item.riskBand === riskBand
  );

  const controlsPresent = new Set(input.controlsPresent ?? []);
  const reviewersPresent = new Set(input.reviewersPresent ?? []);
  const missingControls = mapping
    ? mapping.requiredControlIds.filter((controlId) => !controlsPresent.has(controlId))
    : [];
  const missingReviewers = mapping
    ? mapping.requiredReviewers.filter((reviewer) => !reviewersPresent.has(reviewer))
    : [];

  const checks = {
    riskBandResolution: {
      status: enabledRules.includes("risk-band-resolution") && riskBand === "unknown" ? "blocked" : "ready",
      reasonCodes:
        enabledRules.includes("risk-band-resolution") && riskBand === "unknown"
          ? ["invalid-risk-score"]
          : [],
    },
    controlCoverage: {
      status:
        enabledRules.includes("control-coverage") && missingControls.length > 0
          ? "blocked"
          : "ready",
      reasonCodes: enabledRules.includes("control-coverage")
        ? missingControls.map((controlId) => `missing-control:${controlId}`)
        : [],
    },
    reviewerCoverage: {
      status:
        enabledRules.includes("reviewer-coverage") && missingReviewers.length > 0
          ? "blocked"
          : "ready",
      reasonCodes: enabledRules.includes("reviewer-coverage")
        ? missingReviewers.map((reviewer) => `missing-reviewer:${reviewer}`)
        : [],
    },
    reviewGateAlignment: {
      status:
        enabledRules.includes("review-gate-alignment") &&
        mapping &&
        input.requestedReviewGate &&
        input.requestedReviewGate !== mapping.reviewGate
          ? "blocked"
          : "ready",
      reasonCodes:
        enabledRules.includes("review-gate-alignment") &&
        mapping &&
        input.requestedReviewGate &&
        input.requestedReviewGate !== mapping.reviewGate
          ? [`review-gate-mismatch:${input.requestedReviewGate}:${mapping.reviewGate}`]
          : [],
    },
  };

  const reasonCodes = [
    ...checks.riskBandResolution.reasonCodes,
    ...checks.controlCoverage.reasonCodes,
    ...checks.reviewerCoverage.reasonCodes,
    ...checks.reviewGateAlignment.reasonCodes,
    ...(mapping ? [] : [`missing-governance-mapping:${input.assetType}:${riskBand}`]),
  ];

  const allowed = reasonCodes.length === 0;
  return {
    assetType: input.assetType ?? null,
    riskScore: input.riskScore ?? null,
    riskBand,
    requiredReviewGate: mapping?.reviewGate ?? null,
    allowed,
    status: allowed ? "approved" : "blocked",
    checks,
    reasonCodes,
  };
}

/**
 * Build human-readable decision explanation.
 * @param {ReturnType<typeof evaluateGovernanceRules>} decision
 * @returns {string}
 */
export function explainGovernanceRuleDecision(decision) {
  if (decision.allowed) {
    return `Approved ${decision.assetType} at ${decision.riskBand} risk with review gate ${decision.requiredReviewGate}.`;
  }
  if (!Array.isArray(decision.reasonCodes) || decision.reasonCodes.length === 0) {
    return `Blocked ${decision.assetType} governance request due to unknown validation error.`;
  }
  return `Blocked ${decision.assetType} governance request: ${decision.reasonCodes.join(", ")}.`;
}

/**
 * Build governance decision evidence envelope.
 * @param {ReturnType<typeof evaluateGovernanceRules>} decision
 * @param {string} generatedAt
 * @returns {object}
 */
export function buildGovernanceRuleEvidence(decision, generatedAt) {
  return {
    artifactType: "governance-rule-decision",
    generatedAt: generatedAt ?? null,
    decision,
    explanation: explainGovernanceRuleDecision(decision),
  };
}

function resolveRiskBand(riskScore, taxonomy) {
  if (!Number.isFinite(riskScore)) return "unknown";
  const normalized = Math.max(0, Math.min(100, riskScore));
  return taxonomy.bands.find((band) => normalized >= band.scoreMin && normalized <= band.scoreMax)?.riskBand ?? "unknown";
}

