/**
 * Executive delta briefing contract.
 * Pillar: OPTIMIZE
 *
 * Deterministic period-over-period executive variance summary.
 */

/**
 * Build executive delta briefing from current and previous executive report.
 * @param {{ topline?:{ maturityOverall:number, totalCost:number, totalValuePoints:number, roiIndex:number }, keyRecommendations?:object[] }} current
 * @param {{ topline?:{ maturityOverall:number, totalCost:number, totalValuePoints:number, roiIndex:number }, keyRecommendations?:object[] }} previous
 * @returns {object}
 */
export function buildExecutiveDeltaBriefing(current, previous) {
  const curr = current?.topline ?? {};
  const prev = previous?.topline ?? {};
  return {
    toplineDelta: {
      maturityOverall: delta(curr.maturityOverall, prev.maturityOverall),
      totalCost: delta(curr.totalCost, prev.totalCost),
      totalValuePoints: delta(curr.totalValuePoints, prev.totalValuePoints),
      roiIndex: delta(curr.roiIndex, prev.roiIndex),
    },
    recommendationDelta: {
      currentCount: Array.isArray(current?.keyRecommendations) ? current.keyRecommendations.length : 0,
      previousCount: Array.isArray(previous?.keyRecommendations) ? previous.keyRecommendations.length : 0,
    },
  };
}

/**
 * Summarize executive delta.
 * @param {ReturnType<typeof buildExecutiveDeltaBriefing>} briefing
 * @returns {object}
 */
export function summarizeExecutiveDelta(briefing) {
  const topline = briefing?.toplineDelta ?? {};
  const improved = [
    topline.maturityOverall > 0,
    topline.totalValuePoints > 0,
    topline.roiIndex > 0,
  ].filter(Boolean).length;
  const regressed = [
    topline.maturityOverall < 0,
    topline.totalValuePoints < 0,
    topline.roiIndex < 0,
  ].filter(Boolean).length;
  return {
    improvedMetrics: improved,
    regressedMetrics: regressed,
    status: regressed > improved ? "at-risk" : "stable",
  };
}

/**
 * Build executive delta evidence envelope.
 * @param {ReturnType<typeof buildExecutiveDeltaBriefing>} briefing
 * @param {string} generatedAt
 * @returns {object}
 */
export function buildExecutiveDeltaEvidence(briefing, generatedAt) {
  return {
    artifactType: "executive-delta-briefing",
    generatedAt: generatedAt ?? null,
    summary: summarizeExecutiveDelta(briefing),
    briefing,
  };
}

function delta(current, previous) {
  const c = Number.isFinite(current) ? current : 0;
  const p = Number.isFinite(previous) ? previous : 0;
  return Number((c - p).toFixed(4));
}

