/**
 * Tenant insights API contract.
 * Pillar: OBSERVE
 *
 * Unifies trend, cost, performance, and coach-action briefing into one API
 * payload contract.
 */

import { summarizeTenantHealthTrends } from "../../optimize/reporting/tenant-health-trends-contract.mjs";
import { summarizeCostAttributionByPillar } from "../../optimize/model/cost-attribution-adapter-contract.mjs";
import { buildPerformanceMetricsSummary } from "./performance-metrics-contract.mjs";
import { buildTenantBriefing } from "../../optimize/delivery/tenant-briefing.mjs";

/**
 * Build tenant insights payload.
 * @param {{
 *   tenantId:string;
 *   healthTrendSeries?:object;
 *   costRows?:object[];
 *   performanceSamples?:object[];
 *   coachActions?:object[];
 *   riskFlags?:object[];
 *   generatedAt?:string;
 * }} input
 * @returns {{ ok:true, payload:object } | { ok:false, errors:string[] }}
 */
export function buildTenantInsightsPayload(input = {}) {
  const errors = [];
  if (!input.tenantId) errors.push("tenantId is required");
  if (errors.length > 0) return { ok: false, errors };

  const trendSummary = summarizeTenantHealthTrends(input.healthTrendSeries ?? { tenantId: input.tenantId, points: [], deltas: [] });
  const costSummary = summarizeCostAttributionByPillar(input.costRows ?? []);
  const performanceSummary = buildPerformanceMetricsSummary(input.performanceSamples ?? []);

  const latestPoint = (input.healthTrendSeries?.points ?? [])[input.healthTrendSeries?.points?.length - 1] ?? null;
  const briefingResult = buildTenantBriefing({
    tenantId: input.tenantId,
    scorecard: {
      tenantId: input.tenantId,
      overall: latestPoint?.overall ?? 0,
      band: latestPoint?.band ?? "critical",
    },
    actions: Array.isArray(input.coachActions) ? input.coachActions : [],
    flags: Array.isArray(input.riskFlags) ? input.riskFlags : [],
  });

  return {
    ok: true,
    payload: {
      tenantId: input.tenantId,
      generatedAt: input.generatedAt ?? null,
      trendSummary,
      costSummary,
      performanceSummary,
      briefing: briefingResult.ok ? briefingResult.briefing : null,
    },
  };
}

/**
 * Validate tenant insights payload shape.
 * @param {object} payload
 * @returns {{ ok:true } | { ok:false, errors:string[] }}
 */
export function validateTenantInsightsPayload(payload) {
  const errors = [];
  if (!payload?.tenantId) errors.push("tenantId is required");
  if (!payload?.trendSummary) errors.push("trendSummary is required");
  if (!payload?.costSummary) errors.push("costSummary is required");
  if (!payload?.performanceSummary) errors.push("performanceSummary is required");
  return errors.length > 0 ? { ok: false, errors } : { ok: true };
}

/**
 * Build API response envelope.
 * @param {object} payload
 * @returns {object}
 */
export function buildTenantInsightsResponse(payload) {
  const validation = validateTenantInsightsPayload(payload);
  if (!validation.ok) {
    return {
      status: "error",
      errors: validation.errors.map((message) => ({ code: "invalid_payload", message })),
      data: null,
    };
  }
  return {
    status: "success",
    errors: [],
    data: payload,
  };
}

