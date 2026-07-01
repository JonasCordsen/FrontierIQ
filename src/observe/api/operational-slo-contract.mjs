/**
 * Operational SLO contract.
 * Pillar: OBSERVE
 *
 * Deterministic SLO target evaluation, burn-rate classification, and breach
 * alert generation.
 */

/**
 * Evaluate SLO measurements against targets.
 * @param {{ metric:string, target:number, actual:number, windowHours:number }[]} measurements
 * @returns {object[]}
 */
export function evaluateOperationalSlo(measurements) {
  return (Array.isArray(measurements) ? measurements : []).map((item) => {
    const target = Number.isFinite(item.target) ? item.target : 0;
    const actual = Number.isFinite(item.actual) ? item.actual : 0;
    const windowHours = Number.isFinite(item.windowHours) ? Math.max(1, item.windowHours) : 24;
    const errorBudgetUsed = target > 0 ? Number((Math.max(0, actual - target) / target).toFixed(4)) : 0;
    const burnRate = Number((errorBudgetUsed / windowHours).toFixed(4));
    const status = actual <= target ? "met" : "breached";

    return {
      metric: item.metric,
      target,
      actual,
      windowHours,
      errorBudgetUsed,
      burnRate,
      burnClass: classifySloBurnRate(burnRate),
      status,
    };
  });
}

/**
 * Classify burn rate severity.
 * @param {number} burnRate
 * @returns {'low'|'medium'|'high'|'critical'}
 */
export function classifySloBurnRate(burnRate) {
  if (!Number.isFinite(burnRate) || burnRate >= 0.05) return "critical";
  if (burnRate >= 0.02) return "high";
  if (burnRate >= 0.01) return "medium";
  return "low";
}

/**
 * Build SLO breach alerts.
 * @param {ReturnType<typeof evaluateOperationalSlo>} evaluations
 * @returns {object[]}
 */
export function buildSloBreachAlerts(evaluations) {
  return (Array.isArray(evaluations) ? evaluations : [])
    .filter((item) => item.status === "breached")
    .map((item) => ({
      metric: item.metric,
      severity: item.burnClass,
      message: `${item.metric} breached target ${item.target} with actual ${item.actual}`,
      burnRate: item.burnRate,
    }));
}

