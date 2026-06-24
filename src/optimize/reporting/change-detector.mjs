/**
 * Change detector — posture change detection and regression alerts.
 *
 * Detects meaningful changes in tenant posture between successive scorecard runs
 * and classifies them as regressions, improvements, or noise.
 *
 * Pillar: OPTIMIZE
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAGNITUDE_THRESHOLDS = Object.freeze({ noise: 2, medium: 5, high: 10 });
const VALID_PILLARS = Object.freeze(['OBSERVE', 'GOVERN', 'SECURE', 'OPTIMIZE']);

// ---------------------------------------------------------------------------
// Change detection
// ---------------------------------------------------------------------------

/**
 * Detect changes between two scorecards.
 *
 * Fail-closed: if previous is missing, all current metrics are reported as
 * new-baseline, not regressions.
 *
 * @param {object} current   - scorecard from buildHealthScorecard
 * @param {object} [previous] - prior scorecard; if null/undefined → new-baseline
 * @returns {{ ok: true, changes: object[], isNewBaseline: boolean } | { ok: false, code: string, errors: string[] }}
 */
export function detectChanges(current, previous) {
  if (!current?.tenantId) {
    return { ok: false, code: 'invalid_input', errors: ['current scorecard must have tenantId'] };
  }

  if (!previous) {
    const changes = VALID_PILLARS.map((pillar) => ({
      pillar,
      metric: `${pillar.toLowerCase()}Score`,
      currentValue: current.pillars?.[pillar]?.score ?? 0,
      previousValue: null,
      direction: 'new-baseline',
      magnitude: 'new-baseline',
    }));
    return { ok: true, changes, isNewBaseline: true };
  }

  if (previous.tenantId && previous.tenantId !== current.tenantId) {
    return { ok: false, code: 'invalid_input', errors: ['scorecards must be for the same tenant'] };
  }

  const changes = [];

  for (const pillar of VALID_PILLARS) {
    const curr = current.pillars?.[pillar]?.score ?? 0;
    const prev = previous.pillars?.[pillar]?.score ?? 0;
    const diff = curr - prev;

    if (Math.abs(diff) <= MAGNITUDE_THRESHOLDS.noise) continue;

    changes.push({
      pillar,
      metric: `${pillar.toLowerCase()}Score`,
      currentValue: curr,
      previousValue: prev,
      direction: diff > 0 ? 'improvement' : 'regression',
      magnitude: classifyChange({ diff: Math.abs(diff) }),
    });
  }

  // Overall score
  const overallDiff = (current.overall ?? 0) - (previous.overall ?? 0);
  if (Math.abs(overallDiff) > MAGNITUDE_THRESHOLDS.noise) {
    changes.push({
      pillar: 'ALL',
      metric: 'overallScore',
      currentValue: current.overall ?? 0,
      previousValue: previous.overall ?? 0,
      direction: overallDiff > 0 ? 'improvement' : 'regression',
      magnitude: classifyChange({ diff: Math.abs(overallDiff) }),
    });
  }

  return { ok: true, changes, isNewBaseline: false };
}

// ---------------------------------------------------------------------------
// Change classifier
// ---------------------------------------------------------------------------

/**
 * Classify a change as noise / medium / high magnitude.
 *
 * @param {{ diff: number }} change
 * @returns {'noise' | 'medium' | 'high'}
 */
export function classifyChange(change) {
  const diff = Math.abs(change?.diff ?? 0);
  if (diff <= MAGNITUDE_THRESHOLDS.noise) return 'noise';
  if (diff <= MAGNITUDE_THRESHOLDS.medium) return 'medium';
  return 'high';
}

// ---------------------------------------------------------------------------
// Report builder
// ---------------------------------------------------------------------------

/**
 * @param {object[]} changes   - from detectChanges
 * @returns {{ ok: true, report: object } | { ok: false, code: string, errors: string[] }}
 */
export function buildChangeReport(changes) {
  if (!Array.isArray(changes)) {
    return { ok: false, code: 'invalid_input', errors: ['changes must be an array'] };
  }

  const regressions = changes.filter((c) => c.direction === 'regression');
  const improvements = changes.filter((c) => c.direction === 'improvement');
  const newBaselines = changes.filter((c) => c.direction === 'new-baseline');
  const unchanged = VALID_PILLARS.filter(
    (p) => !changes.some((c) => c.pillar === p),
  );

  return {
    ok: true,
    report: {
      totalChanges: changes.length,
      regressions,
      improvements,
      newBaselines,
      unchangedPillars: unchanged,
      hasRegressions: regressions.length > 0,
      hasCriticalRegressions: regressions.some((c) => c.magnitude === 'high'),
    },
  };
}

// ---------------------------------------------------------------------------
// Critical regression filter
// ---------------------------------------------------------------------------

/**
 * @param {object[]} changes
 * @returns {object[]}
 */
export function listCriticalRegressions(changes) {
  if (!Array.isArray(changes)) return [];
  return changes.filter((c) => c.direction === 'regression' && c.magnitude === 'high');
}
