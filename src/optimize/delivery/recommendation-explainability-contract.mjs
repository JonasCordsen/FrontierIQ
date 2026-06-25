/**
 * Recommendation explainability contract.
 * Pillar: OPTIMIZE
 *
 * Deterministic rationale traces for coach actions.
 */

/**
 * Build explainability trace for one coach action.
 * @param {{ id:string, pillar:string, title:string, severity:string, impact:number, confidence:number, effort?:string, controlId?:string }} action
 * @returns {object}
 */
export function buildRecommendationRationaleTrace(action) {
  const impact = Number.isFinite(action?.impact) ? Math.max(0, Math.min(100, action.impact)) : 0;
  const confidence = Number.isFinite(action?.confidence) ? Math.max(0, Math.min(1, action.confidence)) : 0;
  const severity = action?.severity ?? "low";
  const severityWeight = severity === "critical" ? 4 : severity === "high" ? 3 : severity === "medium" ? 2 : 1;
  const priorityScore = Number((impact * confidence * severityWeight).toFixed(4));

  return {
    actionId: action?.id ?? null,
    pillar: action?.pillar ?? null,
    title: action?.title ?? null,
    reasoning: {
      severity,
      impact,
      confidence,
      severityWeight,
      effort: action?.effort ?? "high",
      linkedControlId: action?.controlId ?? null,
    },
    priorityScore,
    rationale: [
      `severity=${severity} (weight ${severityWeight})`,
      `impact=${impact}`,
      `confidence=${confidence}`,
      `priorityScore=${priorityScore}`,
    ],
  };
}

/**
 * Build explainability bundle for action list.
 * @param {object[]} actions
 * @returns {object}
 */
export function buildRecommendationExplainabilityBundle(actions) {
  const traces = (Array.isArray(actions) ? actions : []).map(buildRecommendationRationaleTrace);
  return {
    traces,
    summary: summarizeRecommendationExplainability(traces),
  };
}

/**
 * Summarize explainability traces.
 * @param {object[]} traces
 * @returns {object}
 */
export function summarizeRecommendationExplainability(traces) {
  const list = Array.isArray(traces) ? traces : [];
  const topTrace = [...list].sort((a, b) => b.priorityScore - a.priorityScore)[0] ?? null;
  return {
    total: list.length,
    explainable: list.filter((item) => Array.isArray(item.rationale) && item.rationale.length > 0).length,
    avgPriorityScore: list.length > 0
      ? Number((list.reduce((acc, item) => acc + item.priorityScore, 0) / list.length).toFixed(4))
      : 0,
    topActionId: topTrace?.actionId ?? null,
    status: list.length > 0 ? "ready" : "blocked",
  };
}

