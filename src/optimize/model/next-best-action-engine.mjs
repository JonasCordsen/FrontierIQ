const DEFAULT_PILLAR_WEIGHTS = Object.freeze({
  observe: 0.2,
  govern: 0.3,
  secure: 0.3,
  optimize: 0.2,
});

/**
 * @typedef {{
 *   id: string;
 *   title: string;
 *   pillar: "observe"|"govern"|"secure"|"optimize";
 *   impact: number;      // 1-10
 *   effort: number;      // 1-10 (higher means harder)
 *   riskReduction: number; // 1-10
 *   confidence: number;  // 0-1
 * }} CandidateAction
 */

/**
 * @param {CandidateAction[]} actions
 * @param {{ weights?: Record<string, number>; top?: number }} options
 */
export function prioritizeNextBestActions(actions, options = {}) {
  const weights = options.weights ?? DEFAULT_PILLAR_WEIGHTS;
  const top = options.top ?? 10;

  const scored = actions
    .map((action) => {
      const validation = validateCandidateAction(action);
      if (!validation.ok) {
        throw new Error(`Invalid candidate action ${action.id}: ${validation.errors.join("; ")}`);
      }

      const pillarWeight = weights[action.pillar] ?? 0.25;
      // Higher impact/risk reduction/confidence and lower effort rank higher.
      const rawScore =
        ((action.impact * 0.4 + action.riskReduction * 0.4 + (10 - action.effort) * 0.2) *
          pillarWeight *
          action.confidence);
      return {
        ...action,
        priorityScore: Number(rawScore.toFixed(4)),
      };
    })
    .sort((a, b) => b.priorityScore - a.priorityScore);

  return scored.slice(0, top);
}

/**
 * @param {CandidateAction} action
 * @returns {{ ok: true } | { ok: false; errors: string[] }}
 */
export function validateCandidateAction(action) {
  /** @type {string[]} */
  const errors = [];
  if (!action || typeof action !== "object") return { ok: false, errors: ["action must be object"] };
  if (typeof action.id !== "string" || !action.id) errors.push("id must be a non-empty string");
  if (typeof action.title !== "string" || !action.title) errors.push("title must be a non-empty string");
  if (!["observe", "govern", "secure", "optimize"].includes(action.pillar)) {
    errors.push("pillar must be observe|govern|secure|optimize");
  }
  if (!isBetween(action.impact, 1, 10)) errors.push("impact must be between 1 and 10");
  if (!isBetween(action.effort, 1, 10)) errors.push("effort must be between 1 and 10");
  if (!isBetween(action.riskReduction, 1, 10)) errors.push("riskReduction must be between 1 and 10");
  if (typeof action.confidence !== "number" || action.confidence < 0 || action.confidence > 1) {
    errors.push("confidence must be between 0 and 1");
  }
  if (errors.length > 0) return { ok: false, errors };
  return { ok: true };
}

function isBetween(value, min, max) {
  return typeof value === "number" && value >= min && value <= max;
}

