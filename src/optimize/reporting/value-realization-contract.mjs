/**
 * Value realization contract.
 * Pillar: OPTIMIZE
 *
 * Deterministic realized-vs-expected value scoring and trend summary.
 */

/**
 * Build one value realization snapshot.
 * @param {{ period:string, expectedValue:number, realizedValue:number, totalCost:number }} input
 * @returns {object}
 */
export function buildValueRealizationSnapshot(input) {
  const expected = Number.isFinite(input?.expectedValue) ? input.expectedValue : 0;
  const realized = Number.isFinite(input?.realizedValue) ? input.realizedValue : 0;
  const totalCost = Number.isFinite(input?.totalCost) ? input.totalCost : 0;
  const realizationRate = expected > 0 ? Number((realized / expected).toFixed(4)) : 0;
  const roiIndex = totalCost > 0 ? Number((realized / totalCost).toFixed(4)) : 0;

  return {
    period: input?.period ?? null,
    expectedValue: expected,
    realizedValue: realized,
    totalCost,
    realizationRate,
    roiIndex,
    status: realizationRate >= 1 ? "above_target" : realizationRate >= 0.8 ? "near_target" : "below_target",
  };
}

/**
 * Build trend from snapshots.
 * @param {object[]} snapshots
 * @returns {object}
 */
export function buildValueRealizationTrend(snapshots) {
  const ordered = (Array.isArray(snapshots) ? snapshots : [])
    .map(buildValueRealizationSnapshot)
    .sort((left, right) => String(left.period).localeCompare(String(right.period)));

  const deltas = [];
  for (let i = 1; i < ordered.length; i += 1) {
    deltas.push({
      fromPeriod: ordered[i - 1].period,
      toPeriod: ordered[i].period,
      realizationChange: Number((ordered[i].realizationRate - ordered[i - 1].realizationRate).toFixed(4)),
      roiChange: Number((ordered[i].roiIndex - ordered[i - 1].roiIndex).toFixed(4)),
    });
  }

  return { snapshots: ordered, deltas };
}

/**
 * Summarize value realization health.
 * @param {ReturnType<typeof buildValueRealizationTrend>} trend
 * @returns {object}
 */
export function summarizeValueRealizationHealth(trend) {
  const snapshots = Array.isArray(trend?.snapshots) ? trend.snapshots : [];
  const latest = snapshots[snapshots.length - 1] ?? null;
  const avgRealizationRate = snapshots.length > 0
    ? Number((snapshots.reduce((acc, item) => acc + item.realizationRate, 0) / snapshots.length).toFixed(4))
    : 0;
  const avgRoi = snapshots.length > 0
    ? Number((snapshots.reduce((acc, item) => acc + item.roiIndex, 0) / snapshots.length).toFixed(4))
    : 0;

  return {
    periods: snapshots.length,
    avgRealizationRate,
    avgRoi,
    latestStatus: latest?.status ?? "below_target",
    status: avgRealizationRate >= 0.8 ? "ready" : "blocked",
  };
}

