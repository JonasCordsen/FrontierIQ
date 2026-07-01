/**
 * Coach action delivery contract.
 * Pillar: OPTIMIZE
 *
 * Deterministic packaging and delivery readiness checks for ranked coach
 * actions.
 */

import {
  aggregateCoachActions,
  applyAdminFilter,
  buildActionSummary,
} from "./coach-action-aggregator.mjs";

const DELIVERY_CHANNELS = Object.freeze(["api", "email", "teams"]);

/**
 * Build coach action delivery package.
 * @param {{ pillarActions: Record<string,object[]>, channel:string, maxActions?:number, filter?:object, generatedAt?:string }} input
 * @returns {object}
 */
export function buildCoachActionDeliveryPackage(input = {}) {
  const channel = DELIVERY_CHANNELS.includes(input.channel) ? input.channel : "api";
  const maxActions = Number.isFinite(input.maxActions) ? Math.max(1, Math.floor(input.maxActions)) : 10;

  const aggregateResult = aggregateCoachActions(input.pillarActions ?? {});
  if (!aggregateResult.ok) {
    return { ok: false, reason: "invalid_actions", errors: aggregateResult.errors };
  }

  const filtered = input.filter ? applyAdminFilter(aggregateResult.actions, input.filter) : { ok: true, actions: aggregateResult.actions };
  if (!filtered.ok) return { ok: false, reason: "invalid_filter", errors: filtered.errors };

  const actions = filtered.actions.slice(0, maxActions);
  const summaryResult = buildActionSummary(actions);
  const summary = summaryResult.ok ? summaryResult.summary : { total: actions.length };

  return {
    ok: true,
    package: {
      channel,
      generatedAt: input.generatedAt ?? null,
      readinessStatus: actions.length > 0 ? "ready" : "blocked",
      routes: buildCoachActionDeliveryRoutes(channel),
      summary,
      actions,
    },
  };
}

/**
 * Build route configuration for channel.
 * @param {string} channel
 * @returns {object}
 */
export function buildCoachActionDeliveryRoutes(channel) {
  if (channel === "email") {
    return { primary: "digest_email", fallback: "api_poll", notifyOps: true };
  }
  if (channel === "teams") {
    return { primary: "teams_adaptive_card", fallback: "digest_email", notifyOps: true };
  }
  return { primary: "api_response", fallback: "none", notifyOps: false };
}

/**
 * Summarize delivery package.
 * @param {{ readinessStatus:string, channel:string, actions:object[], summary:object }} deliveryPackage
 * @returns {object}
 */
export function summarizeCoachActionDelivery(deliveryPackage) {
  return {
    readinessStatus: deliveryPackage?.readinessStatus ?? "blocked",
    channel: deliveryPackage?.channel ?? "api",
    deliveredActions: Array.isArray(deliveryPackage?.actions) ? deliveryPackage.actions.length : 0,
    topAction: deliveryPackage?.summary?.topAction ?? null,
    status: deliveryPackage?.readinessStatus === "ready" ? "ready" : "blocked",
  };
}

