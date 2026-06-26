/**
 * Recommendation impact simulation contract.
 * Pillar: OPTIMIZE
 *
 * Deterministic before/after KPI and value impact projections for coach actions.
 */

/**
 * Simulate one recommendation impact against baseline KPIs.
 * @param {{ id:string, title?:string, confidence?:number, deltas?:Record<string,number> }} recommendation
 * @param {Record<string,number>} baseline
 * @returns {object}
 */
export function simulateRecommendationImpact(recommendation, baseline) {
  const confidence = Number.isFinite(recommendation?.confidence) ? Math.max(0, Math.min(1, recommendation.confidence)) : 0;
  const before = normalizeKpiRecord(baseline);
  const requestedDeltas = recommendation?.deltas ?? {};
  const after = {};
  const appliedDelta = {};

  for (const [kpi, value] of Object.entries(before)) {
    const proposed = Number.isFinite(requestedDeltas[kpi]) ? requestedDeltas[kpi] : 0;
    const confidenceAdjusted = Number((proposed * confidence).toFixed(4));
    after[kpi] = Number(Math.max(0, value + confidenceAdjusted).toFixed(4));
    appliedDelta[kpi] = Number((after[kpi] - value).toFixed(4));
  }

  return {
    recommendationId: recommendation?.id ?? null,
    title: recommendation?.title ?? null,
    confidence,
    before,
    after,
    appliedDelta,
    expectedNetImpact: Number(Object.values(appliedDelta).reduce((acc, value) => acc + value, 0).toFixed(4)),
  };
}

/**
 * Simulate portfolio impacts using recommendation-specific baselines.
 * @param {{ recommendation:object, baseline:Record<string,number> }[]} items
 * @returns {object[]}
 */
export function simulatePortfolioImpact(items) {
  return (Array.isArray(items) ? items : []).map((item) => {
    return simulateRecommendationImpact(item?.recommendation ?? {}, item?.baseline ?? {});
  });
}

/**
 * Summarize simulation portfolio.
 * @param {object[]} simulations
 * @returns {object}
 */
export function summarizeImpactSimulation(simulations) {
  const list = Array.isArray(simulations) ? simulations : [];
  const totalNetImpact = Number(list.reduce((acc, item) => acc + (item.expectedNetImpact ?? 0), 0).toFixed(4));
  return {
    totalRecommendations: list.length,
    positive: list.filter((item) => (item.expectedNetImpact ?? 0) > 0).length,
    neutralOrNegative: list.filter((item) => (item.expectedNetImpact ?? 0) <= 0).length,
    totalNetImpact,
    topRecommendationId: [...list].sort((a, b) => (b.expectedNetImpact ?? 0) - (a.expectedNetImpact ?? 0))[0]?.recommendationId ?? null,
    status: list.length > 0 ? "ready" : "blocked",
  };
}

function normalizeKpiRecord(record) {
  const out = {};
  for (const [key, value] of Object.entries(record ?? {})) {
    out[key] = Number.isFinite(value) ? value : 0;
  }
  return out;
}

