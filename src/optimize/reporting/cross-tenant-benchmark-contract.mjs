/**
 * Cross-tenant benchmark contract.
 * Pillar: OPTIMIZE
 *
 * Deterministic percentile benchmarking across tenant cohorts.
 */

/**
 * Build normalized benchmark rows for a metric.
 * @param {{ tenantId:string, cohort?:string, metrics?:Record<string,number> }[]} tenantMetrics
 * @param {string} metricKey
 * @returns {object[]}
 */
export function buildBenchmarkCohorts(tenantMetrics, metricKey) {
  return (Array.isArray(tenantMetrics) ? tenantMetrics : [])
    .map((item) => {
      const value = Number.isFinite(item?.metrics?.[metricKey]) ? item.metrics[metricKey] : 0;
      return {
        tenantId: item?.tenantId ?? null,
        cohort: item?.cohort ?? "default",
        metricKey,
        value,
      };
    })
    .sort((left, right) => right.value - left.value);
}

/**
 * Calculate deterministic cohort percentile rank by metric.
 * @param {{ tenantId:string, cohort?:string, metrics?:Record<string,number> }[]} tenantMetrics
 * @param {string} metricKey
 * @returns {object[]}
 */
export function calculateTenantPercentiles(tenantMetrics, metricKey) {
  const rows = buildBenchmarkCohorts(tenantMetrics, metricKey);
  const byCohort = new Map();
  for (const row of rows) {
    if (!byCohort.has(row.cohort)) byCohort.set(row.cohort, []);
    byCohort.get(row.cohort).push(row);
  }

  const percentiles = [];
  for (const [cohort, cohortRows] of byCohort.entries()) {
    const values = cohortRows.map((row) => row.value).sort((a, b) => a - b);
    for (const row of cohortRows) {
      const countLessOrEqual = values.filter((value) => value <= row.value).length;
      const percentile = values.length > 0 ? Math.round((countLessOrEqual / values.length) * 100) : 0;
      percentiles.push({
        tenantId: row.tenantId,
        cohort,
        metricKey,
        value: row.value,
        percentile,
        benchmarkBand: percentile >= 75 ? "top_quartile" : percentile >= 25 ? "mid_band" : "lagging",
      });
    }
  }

  return percentiles.sort((left, right) => right.percentile - left.percentile);
}

/**
 * Summarize benchmark current state.
 * @param {object[]} percentiles
 * @returns {object}
 */
export function buildCrossTenantBenchmarkSummary(percentiles) {
  const rows = Array.isArray(percentiles) ? percentiles : [];
  return {
    totalTenants: rows.length,
    topQuartile: rows.filter((item) => item.benchmarkBand === "top_quartile").length,
    midBand: rows.filter((item) => item.benchmarkBand === "mid_band").length,
    lagging: rows.filter((item) => item.benchmarkBand === "lagging").length,
    topTenantId: rows[0]?.tenantId ?? null,
    status: rows.length > 0 ? "ready" : "blocked",
    rows,
  };
}

