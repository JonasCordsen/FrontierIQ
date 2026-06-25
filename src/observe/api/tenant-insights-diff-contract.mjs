/**
 * Tenant insights diff contract.
 * Pillar: OBSERVE
 *
 * Deterministic diff contract for tenant insight payload changes.
 */

/**
 * Build deterministic diff between two tenant insight payloads.
 * @param {object} current
 * @param {object} previous
 * @returns {object}
 */
export function buildTenantInsightsDiff(current, previous) {
  const changedFields = [];
  const detail = {};

  for (const field of ["trendSummary", "costSummary", "performanceSummary", "briefing"]) {
    const currentValue = current?.[field] ?? null;
    const previousValue = previous?.[field] ?? null;
    if (!deepEqual(currentValue, previousValue)) {
      changedFields.push(field);
      detail[field] = { previous: previousValue, current: currentValue };
    }
  }

  return {
    tenantId: current?.tenantId ?? previous?.tenantId ?? null,
    changed: changedFields.length > 0,
    changedFields,
    detail,
  };
}

/**
 * Summarize insight diff.
 * @param {ReturnType<typeof buildTenantInsightsDiff>} diff
 * @returns {object}
 */
export function summarizeTenantInsightsDiff(diff) {
  return {
    tenantId: diff?.tenantId ?? null,
    changed: Boolean(diff?.changed),
    changedFieldCount: Array.isArray(diff?.changedFields) ? diff.changedFields.length : 0,
    changedFields: diff?.changedFields ?? [],
    status: diff?.changed ? "changed" : "stable",
  };
}

/**
 * Build evidence envelope for insights diff.
 * @param {ReturnType<typeof buildTenantInsightsDiff>} diff
 * @param {string} generatedAt
 * @returns {object}
 */
export function buildTenantInsightsDiffEvidence(diff, generatedAt) {
  return {
    artifactType: "tenant-insights-diff",
    generatedAt: generatedAt ?? null,
    summary: summarizeTenantInsightsDiff(diff),
    diff,
  };
}

function deepEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

