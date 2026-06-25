/**
 * Source health contract.
 * Pillar: OBSERVE
 *
 * Deterministic ingestion source health scoring and outage classification.
 */

/**
 * Evaluate source health status from source metrics.
 * @param {{ sourceId:string, successRate:number, latencyMs:number, freshnessMinutes:number, errorCount:number }[]} sources
 * @returns {object[]}
 */
export function evaluateSourceHealth(sources) {
  return (Array.isArray(sources) ? sources : []).map((source) => {
    const successRate = Number.isFinite(source.successRate) ? Math.max(0, Math.min(1, source.successRate)) : 0;
    const latency = Number.isFinite(source.latencyMs) ? Math.max(0, source.latencyMs) : 0;
    const freshness = Number.isFinite(source.freshnessMinutes) ? Math.max(0, source.freshnessMinutes) : 0;
    const errors = Number.isFinite(source.errorCount) ? Math.max(0, source.errorCount) : 0;

    const score = Math.max(
      0,
      Math.min(100, Math.round(successRate * 60 + Math.max(0, 1 - latency / 5000) * 20 + Math.max(0, 1 - freshness / 240) * 20 - Math.min(20, errors)))
    );

    return {
      sourceId: source.sourceId,
      score,
      outage: classifySourceOutage(score),
      status: score >= 80 ? "healthy" : score >= 60 ? "degraded" : "critical",
    };
  });
}

/**
 * Classify outage level from score.
 * @param {number} score
 * @returns {'none'|'partial'|'major'}
 */
export function classifySourceOutage(score) {
  if (!Number.isFinite(score) || score < 60) return "major";
  if (score < 80) return "partial";
  return "none";
}

/**
 * Build source health evidence envelope.
 * @param {ReturnType<typeof evaluateSourceHealth>} health
 * @param {string} generatedAt
 * @returns {object}
 */
export function buildSourceHealthEvidence(health, generatedAt) {
  const list = Array.isArray(health) ? health : [];
  return {
    artifactType: "source-health",
    generatedAt: generatedAt ?? null,
    summary: {
      totalSources: list.length,
      healthy: list.filter((item) => item.status === "healthy").length,
      degraded: list.filter((item) => item.status === "degraded").length,
      critical: list.filter((item) => item.status === "critical").length,
    },
    health: list,
  };
}

