/**
 * Tenant health trends contract.
 * Pillar: OPTIMIZE
 *
 * Deterministic trend series and summary contract for scorecard deltas across
 * multiple snapshots.
 */

import { buildScorecardDelta, classifyHealthBand } from "./tenant-health-scorecard.mjs";

const PILLARS = Object.freeze(["OBSERVE", "GOVERN", "SECURE", "OPTIMIZE"]);

/**
 * Build deterministic tenant trend series from snapshots.
 * @param {{ tenantId: string, timestamp: string, overall: number, pillars?: Record<string,{score:number}> }[]} snapshots
 * @returns {{ ok: true, series: object } | { ok: false, reason: string, errors: string[] }}
 */
export function buildTenantHealthTrendSeries(snapshots) {
  if (!Array.isArray(snapshots) || snapshots.length === 0) {
    return { ok: false, reason: "invalid_input", errors: ["snapshots must be a non-empty array"] };
  }

  const tenantIds = [...new Set(snapshots.map((snapshot) => snapshot?.tenantId))];
  if (tenantIds.length !== 1 || !tenantIds[0]) {
    return { ok: false, reason: "invalid_input", errors: ["snapshots must belong to one tenant"] };
  }

  const invalidTimestamp = snapshots.find(
    (snapshot) => typeof snapshot?.timestamp !== "string" || Number.isNaN(Date.parse(snapshot.timestamp))
  );
  if (invalidTimestamp) {
    return { ok: false, reason: "invalid_input", errors: ["all snapshots must include valid timestamp"] };
  }

  const ordered = [...snapshots].sort((left, right) => left.timestamp.localeCompare(right.timestamp));
  const points = ordered.map((snapshot, index) => ({
    index,
    tenantId: snapshot.tenantId,
    timestamp: snapshot.timestamp,
    overall: clampScore(snapshot.overall),
    band: classifyHealthBand(clampScore(snapshot.overall)),
    pillars: normalizePillars(snapshot.pillars),
  }));

  const deltas = [];
  for (let i = 1; i < points.length; i += 1) {
    const previous = toScorecard(points[i - 1]);
    const current = toScorecard(points[i]);
    const delta = buildScorecardDelta(current, previous);
    if (!delta.ok) {
      return { ok: false, reason: "delta_failed", errors: delta.errors };
    }
    deltas.push({
      fromTimestamp: points[i - 1].timestamp,
      toTimestamp: points[i].timestamp,
      overallChange: delta.delta.overallChange,
      trend: delta.delta.trend,
      pillars: delta.delta.pillars,
    });
  }

  return {
    ok: true,
    series: {
      tenantId: tenantIds[0],
      points,
      deltas,
    },
  };
}

/**
 * Summarize trend series.
 * @param {{ tenantId:string, points:object[], deltas:object[] }} series
 * @returns {object}
 */
export function summarizeTenantHealthTrends(series) {
  const points = Array.isArray(series?.points) ? series.points : [];
  const deltas = Array.isArray(series?.deltas) ? series.deltas : [];
  const first = points[0];
  const last = points[points.length - 1];
  const byTrend = deltas.reduce(
    (acc, delta) => {
      acc[delta.trend] = (acc[delta.trend] ?? 0) + 1;
      return acc;
    },
    { improved: 0, regressed: 0, stable: 0 }
  );

  return {
    tenantId: series?.tenantId ?? null,
    periods: points.length,
    transitions: deltas.length,
    firstScore: first?.overall ?? null,
    currentScore: last?.overall ?? null,
    currentBand: last?.band ?? "critical",
    netChange: first && last ? last.overall - first.overall : 0,
    volatility: deltas.length > 0 ? Math.max(...deltas.map((delta) => Math.abs(delta.overallChange))) : 0,
    byTrend,
  };
}

/**
 * Build trend evidence envelope.
 * @param {{ tenantId:string, points:object[], deltas:object[] }} series
 * @param {string} generatedAt
 * @returns {object}
 */
export function buildTenantHealthTrendEvidence(series, generatedAt) {
  return {
    artifactType: "tenant-health-trends",
    generatedAt: generatedAt ?? null,
    summary: summarizeTenantHealthTrends(series),
    series,
  };
}

function clampScore(score) {
  const numeric = Number.isFinite(score) ? score : 0;
  return Math.max(0, Math.min(100, numeric));
}

function normalizePillars(pillars = {}) {
  return Object.fromEntries(
    PILLARS.map((pillar) => [pillar, { score: clampScore(pillars?.[pillar]?.score) }])
  );
}

function toScorecard(point) {
  return {
    tenantId: point.tenantId,
    overall: point.overall,
    pillars: normalizePillars(point.pillars),
  };
}

