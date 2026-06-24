/**
 * Tenant health scorecard — unified pillar-level and overall posture score.
 *
 * Combines OBSERVE / GOVERN / SECURE / OPTIMIZE pillar inputs into a single
 * per-tenant health scorecard. Fail-closed: missing pillar data → pillar score
 * of 0, never omitted.
 *
 * Pillar: OPTIMIZE (primary)
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PILLARS = Object.freeze(['OBSERVE', 'GOVERN', 'SECURE', 'OPTIMIZE']);

const PILLAR_WEIGHTS = Object.freeze({
  OBSERVE: 0.2,
  GOVERN: 0.3,
  SECURE: 0.3,
  OPTIMIZE: 0.2,
});

const HEALTH_BANDS = Object.freeze([
  { band: 'critical', min: 0, max: 39 },
  { band: 'at-risk', min: 40, max: 59 },
  { band: 'fair', min: 60, max: 79 },
  { band: 'healthy', min: 80, max: 100 },
]);

// ---------------------------------------------------------------------------
// Band classifier
// ---------------------------------------------------------------------------

/**
 * @param {number} score  0–100
 * @returns {'critical' | 'at-risk' | 'fair' | 'healthy'}
 */
export function classifyHealthBand(score) {
  const s = Math.max(0, Math.min(100, score));
  return HEALTH_BANDS.find((b) => s >= b.min && s <= b.max)?.band ?? 'critical';
}

// ---------------------------------------------------------------------------
// Scorecard builder
// ---------------------------------------------------------------------------

/**
 * @typedef {object} PillarInput
 * @property {number}  score        - 0–100; omit or pass undefined → treated as 0
 * @property {string[]} positives   - positive signal descriptions
 * @property {string[]} negatives   - negative signal / risk descriptions
 */

/**
 * Build a unified health scorecard for a tenant.
 *
 * @param {string}                          tenantId
 * @param {Record<string, PillarInput>}     pillarInputs  - keyed by OBSERVE/GOVERN/SECURE/OPTIMIZE
 * @returns {{ ok: true, scorecard: object } | { ok: false, code: string, errors: string[] }}
 */
export function buildHealthScorecard(tenantId, pillarInputs) {
  if (!tenantId || typeof tenantId !== 'string') {
    return { ok: false, code: 'invalid_input', errors: ['tenantId is required'] };
  }
  if (!pillarInputs || typeof pillarInputs !== 'object' || Array.isArray(pillarInputs)) {
    return { ok: false, code: 'invalid_input', errors: ['pillarInputs must be an object'] };
  }

  const pillarScores = {};
  let overallScore = 0;

  for (const pillar of PILLARS) {
    const input = pillarInputs[pillar];
    const raw = typeof input?.score === 'number' ? input.score : 0;
    const clamped = Math.max(0, Math.min(100, raw));
    pillarScores[pillar] = {
      score: clamped,
      band: classifyHealthBand(clamped),
      positives: Array.isArray(input?.positives) ? input.positives : [],
      negatives: Array.isArray(input?.negatives) ? input.negatives : [],
    };
    overallScore += clamped * PILLAR_WEIGHTS[pillar];
  }

  const overall = Math.round(overallScore);

  return {
    ok: true,
    scorecard: {
      tenantId,
      overall,
      band: classifyHealthBand(overall),
      pillars: pillarScores,
      generatedAt: new Date(0).toISOString(), // deterministic sentinel
    },
  };
}

// ---------------------------------------------------------------------------
// Score drivers
// ---------------------------------------------------------------------------

/**
 * Extract the top N positive and negative score drivers from a scorecard.
 *
 * @param {object} scorecard   - from buildHealthScorecard
 * @param {number} [n=5]
 * @returns {{ topPositives: object[], topNegatives: object[] }}
 */
export function listScoreDrivers(scorecard, n = 5) {
  const positives = [];
  const negatives = [];

  for (const [pillar, data] of Object.entries(scorecard.pillars ?? {})) {
    for (const p of data.positives ?? []) positives.push({ pillar, text: p });
    for (const n_ of data.negatives ?? []) negatives.push({ pillar, text: n_ });
  }

  return {
    topPositives: positives.slice(0, n),
    topNegatives: negatives.slice(0, n),
  };
}

// ---------------------------------------------------------------------------
// Delta
// ---------------------------------------------------------------------------

/**
 * Compare two scorecards (current vs previous) and produce a delta report.
 *
 * @param {object} current    - scorecard from buildHealthScorecard
 * @param {object} previous   - prior scorecard for the same tenant
 * @returns {{ ok: true, delta: object } | { ok: false, code: string, errors: string[] }}
 */
export function buildScorecardDelta(current, previous) {
  if (!current?.tenantId || !previous?.tenantId) {
    return { ok: false, code: 'invalid_input', errors: ['both scorecards must have a tenantId'] };
  }
  if (current.tenantId !== previous.tenantId) {
    return { ok: false, code: 'invalid_input', errors: ['scorecards must be for the same tenant'] };
  }

  const overallChange = current.overall - previous.overall;
  const trend = overallChange > 2 ? 'improved' : overallChange < -2 ? 'regressed' : 'stable';

  const pillarDeltas = {};
  for (const pillar of PILLARS) {
    const curr = current.pillars?.[pillar]?.score ?? 0;
    const prev = previous.pillars?.[pillar]?.score ?? 0;
    const change = curr - prev;
    pillarDeltas[pillar] = {
      currentScore: curr,
      previousScore: prev,
      change,
      trend: change > 2 ? 'improved' : change < -2 ? 'regressed' : 'stable',
    };
  }

  return {
    ok: true,
    delta: {
      tenantId: current.tenantId,
      overallChange,
      trend,
      pillars: pillarDeltas,
    },
  };
}
