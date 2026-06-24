/**
 * Alert threshold engine — configurable threshold evaluation against scorecard metrics.
 *
 * Evaluates metrics against named thresholds and produces typed alerts when
 * values cross boundaries.
 *
 * Pillar: OPTIMIZE
 */

// ---------------------------------------------------------------------------
// Default thresholds
// ---------------------------------------------------------------------------

/**
 * @returns {object[]} Default threshold definitions
 */
export function buildDefaultThresholds() {
  return [
    { id: 'overall-health-critical', metric: 'overallScore', operator: 'lt', threshold: 40, severity: 'critical', description: 'Overall health score is critical' },
    { id: 'overall-health-low', metric: 'overallScore', operator: 'lt', threshold: 60, severity: 'high', description: 'Overall health score is below fair' },
    { id: 'govern-score-low', metric: 'governScore', operator: 'lt', threshold: 50, severity: 'high', description: 'Governance score is below acceptable' },
    { id: 'secure-score-low', metric: 'secureScore', operator: 'lt', threshold: 50, severity: 'high', description: 'Security score is below acceptable' },
    { id: 'overshare-rate-high', metric: 'overshareRate', operator: 'gt', threshold: 0.05, severity: 'critical', description: 'Overshare rate exceeds 5%' },
    { id: 'license-utilization-low', metric: 'licenseUtilization', operator: 'lt', threshold: 0.5, severity: 'medium', description: 'License utilization below 50%' },
    { id: 'active-agent-ratio-low', metric: 'activeAgentRatio', operator: 'lt', threshold: 0.3, severity: 'medium', description: 'Active agent ratio below 30%' },
    { id: 'compliance-gap-critical', metric: 'criticalComplianceGaps', operator: 'gt', threshold: 0, severity: 'critical', description: 'One or more critical compliance gaps open' },
  ];
}

// ---------------------------------------------------------------------------
// Evaluation
// ---------------------------------------------------------------------------

const OPERATORS = {
  lt: (actual, threshold) => actual < threshold,
  gt: (actual, threshold) => actual > threshold,
  lte: (actual, threshold) => actual <= threshold,
  gte: (actual, threshold) => actual >= threshold,
  eq: (actual, threshold) => actual === threshold,
};

/**
 * Evaluate a metrics object against a list of threshold definitions.
 *
 * @param {Record<string, number>} metrics
 * @param {object[]}               thresholds  - from buildDefaultThresholds or custom
 * @returns {{ ok: true, alerts: object[], evaluated: number } | { ok: false, code: string, errors: string[] }}
 */
export function evaluateThresholds(metrics, thresholds) {
  if (!metrics || typeof metrics !== 'object' || Array.isArray(metrics)) {
    return { ok: false, code: 'invalid_input', errors: ['metrics must be an object'] };
  }
  if (!Array.isArray(thresholds)) {
    return { ok: false, code: 'invalid_input', errors: ['thresholds must be an array'] };
  }

  const alerts = [];
  let evaluated = 0;

  for (const t of thresholds) {
    const actual = metrics[t.metric];
    if (actual === undefined || actual === null) continue;

    evaluated++;
    const op = OPERATORS[t.operator];
    if (!op) continue;

    if (op(actual, t.threshold)) {
      const delta = actual - t.threshold;
      alerts.push({
        thresholdId: t.id,
        metric: t.metric,
        operator: t.operator,
        threshold: t.threshold,
        actual,
        delta: Math.abs(delta),
        severity: classifyAlertSeverity(t.severity, Math.abs(delta), t.threshold),
        description: t.description,
      });
    }
  }

  return { ok: true, alerts, evaluated };
}

// ---------------------------------------------------------------------------
// Severity classifier
// ---------------------------------------------------------------------------

/**
 * Optionally elevate alert severity based on how far the value is over threshold.
 *
 * @param {string} baseSeverity
 * @param {number} delta
 * @param {number} threshold
 * @returns {string}
 */
export function classifyAlertSeverity(baseSeverity, delta, threshold) {
  if (!threshold || threshold === 0) return baseSeverity;
  const ratio = delta / Math.abs(threshold);
  const SEVERITIES = ['low', 'medium', 'high', 'critical'];
  const baseIdx = SEVERITIES.indexOf(baseSeverity);
  if (baseIdx === -1) return baseSeverity;
  // elevate by one band if ratio > 0.5, cap at critical
  const elevated = ratio > 0.5 ? Math.min(baseIdx + 1, 3) : baseIdx;
  return SEVERITIES[elevated];
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

/**
 * @param {object[]} alerts
 * @returns {{ ok: true, summary: object } | { ok: false, code: string, errors: string[] }}
 */
export function buildThresholdSummary(alerts) {
  if (!Array.isArray(alerts)) {
    return { ok: false, code: 'invalid_input', errors: ['alerts must be an array'] };
  }

  const countBySeverity = {};
  let worstAlert = null;

  for (const a of alerts) {
    const s = a.severity ?? 'low';
    countBySeverity[s] = (countBySeverity[s] ?? 0) + 1;
    if (!worstAlert || ['critical', 'high', 'medium', 'low'].indexOf(s) < ['critical', 'high', 'medium', 'low'].indexOf(worstAlert.severity)) {
      worstAlert = a;
    }
  }

  return {
    ok: true,
    summary: {
      total: alerts.length,
      countBySeverity,
      mostCriticalMetric: worstAlert?.metric ?? null,
      requiresAction: (countBySeverity.critical ?? 0) > 0 || (countBySeverity.high ?? 0) > 0,
    },
  };
}
