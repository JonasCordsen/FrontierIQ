/**
 * Signal correlator — cross-pillar signal correlation and combined risk elevation.
 *
 * Detects when signals from multiple pillars co-occur for the same resource in a
 * time window and elevates the combined risk above individual signal severity.
 *
 * Pillar: OBSERVE (primary)
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_PILLARS = Object.freeze(['OBSERVE', 'GOVERN', 'SECURE', 'OPTIMIZE']);
const SEVERITY_RANK = Object.freeze({ low: 1, medium: 2, high: 3, critical: 4 });
const SEVERITY_FROM_RANK = Object.freeze({ 1: 'low', 2: 'medium', 3: 'high', 4: 'critical' });

// Risk elevation: more distinct pillars → higher combined risk
const PILLAR_COUNT_ELEVATION = Object.freeze({ 1: 0, 2: 1, 3: 2, 4: 2 });

// ---------------------------------------------------------------------------
// Correlation key
// ---------------------------------------------------------------------------

/**
 * Build a deterministic grouping key for a signal.
 * Signals with the same key are candidates for correlation.
 *
 * @param {{ tenantId: string, resourceId: string, timestamp: string }} signal
 * @param {number} [windowHours=1]  - time bucket size in hours
 * @returns {string}
 */
export function buildCorrelationKey(signal, windowHours = 1) {
  const ts = signal?.timestamp ? new Date(signal.timestamp).getTime() : 0;
  const bucket = Math.floor(ts / (windowHours * 3600 * 1000));
  return `${signal?.tenantId ?? 'unknown'}::${signal?.resourceId ?? 'unknown'}::${bucket}`;
}

// ---------------------------------------------------------------------------
// Risk classification
// ---------------------------------------------------------------------------

/**
 * Classify combined risk for a correlation group.
 *
 * @param {{ signals: object[], pillars: string[] }} group
 * @returns {'low' | 'medium' | 'high' | 'critical'}
 */
export function classifyCorrelationRisk(group) {
  const signals = group?.signals ?? [];
  const pillars = group?.pillars ?? [];

  if (signals.length === 0) return 'low';

  const maxRank = signals.reduce((max, s) => {
    const rank = SEVERITY_RANK[s.severity] ?? 1;
    return rank > max ? rank : max;
  }, 1);

  const elevation = PILLAR_COUNT_ELEVATION[Math.min(pillars.length, 4)] ?? 0;
  const elevatedRank = Math.min(4, maxRank + elevation);

  return SEVERITY_FROM_RANK[elevatedRank] ?? 'low';
}

// ---------------------------------------------------------------------------
// Correlator
// ---------------------------------------------------------------------------

/**
 * Group and correlate a flat list of signals across pillars.
 *
 * @param {object[]} signals   - normalized signals with tenantId, resourceId, pillar, severity, timestamp
 * @param {number}   [windowHours=1]
 * @returns {{ ok: true, correlations: object[], skipped: object[] } | { ok: false, code: string, errors: string[] }}
 */
export function correlateSignals(signals, windowHours = 1) {
  if (!Array.isArray(signals)) {
    return { ok: false, code: 'invalid_input', errors: ['signals must be an array'] };
  }

  const groups = new Map();
  const skipped = [];

  for (const signal of signals) {
    if (!signal.tenantId || !signal.resourceId || !signal.timestamp) {
      skipped.push({ signal, reason: 'missing_required_fields' });
      continue;
    }

    const pillar = signal.pillar ?? 'OBSERVE';
    if (!VALID_PILLARS.includes(pillar)) {
      skipped.push({ signal, reason: 'unknown_pillar' });
      continue;
    }

    const key = buildCorrelationKey(signal, windowHours);
    if (!groups.has(key)) {
      groups.set(key, { key, tenantId: signal.tenantId, resourceId: signal.resourceId, signals: [], pillars: new Set() });
    }
    const group = groups.get(key);
    group.signals.push(signal);
    group.pillars.add(pillar);
  }

  const correlations = [];
  for (const group of groups.values()) {
    const pillarsArr = [...group.pillars];
    const elevatedSeverity = classifyCorrelationRisk({ signals: group.signals, pillars: pillarsArr });
    correlations.push({
      key: group.key,
      tenantId: group.tenantId,
      resourceId: group.resourceId,
      signalCount: group.signals.length,
      pillars: pillarsArr,
      elevatedSeverity,
      signals: group.signals,
    });
  }

  return { ok: true, correlations, skipped };
}

// ---------------------------------------------------------------------------
// High-risk filter
// ---------------------------------------------------------------------------

/**
 * Return only correlation groups where elevatedSeverity is high or critical.
 *
 * @param {object[]} correlations   - from correlateSignals
 * @returns {object[]}
 */
export function listHighRiskCorrelations(correlations) {
  if (!Array.isArray(correlations)) return [];
  return correlations.filter(
    (c) => c.elevatedSeverity === 'high' || c.elevatedSeverity === 'critical',
  );
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

/**
 * @param {object[]} correlations
 * @returns {{ ok: true, summary: object } | { ok: false, code: string, errors: string[] }}
 */
export function buildCorrelationSummary(correlations) {
  if (!Array.isArray(correlations)) {
    return { ok: false, code: 'invalid_input', errors: ['correlations must be an array'] };
  }

  const countBySeverity = {};
  const countByPillarCoverage = {};

  for (const c of correlations) {
    const s = c.elevatedSeverity ?? 'low';
    countBySeverity[s] = (countBySeverity[s] ?? 0) + 1;
    const coverage = c.pillars?.length ?? 0;
    countByPillarCoverage[coverage] = (countByPillarCoverage[coverage] ?? 0) + 1;
  }

  const highRisk = listHighRiskCorrelations(correlations);

  return {
    ok: true,
    summary: {
      total: correlations.length,
      highRiskCount: highRisk.length,
      countBySeverity,
      countByPillarCoverage,
    },
  };
}
