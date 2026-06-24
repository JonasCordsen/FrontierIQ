/**
 * Approval board process model for medium/high-risk changes.
 */

const REQUIRED_REVIEWERS = Object.freeze([
  "securityRepresentative",
  "complianceRepresentative",
  "responsibleAiLead",
  "coeLead",
]);

/**
 * @param {{
 *   requestId: string;
 *   title: string;
 *   riskBand: "high"|"medium"|"low";
 *   requestedBy: string;
 *   reviewers: Record<string, "approved"|"rejected"|"pending">;
 *   evidenceRefs: string[];
 * }} request
 */
export function evaluateApprovalRequest(request) {
  const validation = validateApprovalRequest(request);
  if (!validation.ok) {
    return { decision: "rejected", reasons: validation.errors };
  }

  const reviewerStates = REQUIRED_REVIEWERS.map((role) => request.reviewers[role]);
  const hasRejection = reviewerStates.includes("rejected");
  if (hasRejection) {
    return { decision: "rejected", reasons: ["At least one required reviewer rejected the request."] };
  }

  const hasPending = reviewerStates.includes("pending");
  if (hasPending) {
    return { decision: "needs_more_review", reasons: ["Required reviewer approvals are still pending."] };
  }

  if (request.riskBand === "high") {
    return {
      decision: "escalate",
      reasons: ["High-risk requests require governance board escalation."],
    };
  }

  return { decision: "approved", reasons: ["All required reviewers approved."] };
}

/**
 * @param {Parameters<typeof evaluateApprovalRequest>[0]} request
 */
export function validateApprovalRequest(request) {
  /** @type {string[]} */
  const errors = [];
  if (!request || typeof request !== "object") return { ok: false, errors: ["request must be an object"] };
  if (typeof request.requestId !== "string" || !request.requestId) errors.push("requestId is required");
  if (typeof request.title !== "string" || !request.title) errors.push("title is required");
  if (!["high", "medium", "low"].includes(request.riskBand)) errors.push("riskBand must be high|medium|low");
  if (typeof request.requestedBy !== "string" || !request.requestedBy) errors.push("requestedBy is required");
  if (!Array.isArray(request.evidenceRefs) || request.evidenceRefs.length === 0) {
    errors.push("evidenceRefs must include at least one reference");
  }

  if (!request.reviewers || typeof request.reviewers !== "object") {
    errors.push("reviewers must be an object");
  } else {
    for (const reviewer of REQUIRED_REVIEWERS) {
      const state = request.reviewers[reviewer];
      if (!["approved", "rejected", "pending"].includes(state)) {
        errors.push(`reviewers.${reviewer} must be approved|rejected|pending`);
      }
    }
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true };
}

export function listRequiredReviewers() {
  return [...REQUIRED_REVIEWERS];
}

