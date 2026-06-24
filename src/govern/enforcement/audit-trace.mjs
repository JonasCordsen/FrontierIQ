/**
 * Creates deterministic audit records for governance decisions.
 * The record format is intentionally simple and append-only friendly.
 */

/**
 * @param {{
 *   tenantId: string;
 *   solutionId: string;
 *   principalId: string;
 *   actionType: string;
 *   resourceId: string;
 *   decision: "allow"|"deny"|"require_approval";
 *   reasons: string[];
 *   enforcedControls: string[];
 *   evaluatedAt: string;
 *   metadata?: Record<string, string|number|boolean>;
 * }} input
 */
export function createDecisionTraceRecord(input) {
  return {
    version: "2026.06.1",
    traceType: "governance-decision",
    tenantId: input.tenantId,
    solutionId: input.solutionId,
    principalId: input.principalId,
    actionType: input.actionType,
    resourceId: input.resourceId,
    decision: input.decision,
    reasons: [...input.reasons],
    enforcedControls: [...input.enforcedControls],
    evaluatedAt: input.evaluatedAt,
    metadata: input.metadata ?? {},
  };
}

