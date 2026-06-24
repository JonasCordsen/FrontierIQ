/**
 * Coach action aggregator — ranked cross-pillar recommendation list for IT admins.
 *
 * Pulls coach actions from all four pillars, merges, deduplicates, ranks, and
 * filters them into a unified prioritized list.
 *
 * Pillar: OPTIMIZE
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_PILLARS = Object.freeze(['OBSERVE', 'GOVERN', 'SECURE', 'OPTIMIZE']);
const VALID_SEVERITIES = Object.freeze(['critical', 'high', 'medium', 'low']);
const VALID_EFFORTS = Object.freeze(['low', 'medium', 'high']);

const SEVERITY_WEIGHT = Object.freeze({ critical: 4, high: 3, medium: 2, low: 1 });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function scoreAction(action) {
  const impact = Math.max(0, Math.min(100, action.impact ?? 0));
  const confidence = Math.max(0, Math.min(1, action.confidence ?? 0));
  const severityW = SEVERITY_WEIGHT[action.severity] ?? 1;
  return impact * confidence * severityW;
}

// ---------------------------------------------------------------------------
// Aggregation
// ---------------------------------------------------------------------------

/**
 * @typedef {object} CoachAction
 * @property {string}  id          - unique action ID (used for deduplication)
 * @property {string}  pillar      - OBSERVE | GOVERN | SECURE | OPTIMIZE
 * @property {string}  title       - human-readable action title
 * @property {string}  description - what to change and expected impact
 * @property {string}  severity    - critical | high | medium | low
 * @property {number}  impact      - 0–100 estimated impact score
 * @property {number}  confidence  - 0–1 confidence in the recommendation
 * @property {string}  effort      - low | medium | high implementation effort
 * @property {string}  [controlId] - optional linked governance control ID
 */

/**
 * Aggregate coach actions from all pillars into a ranked, merged list.
 *
 * @param {Record<string, CoachAction[]>} pillarActions  - keyed by pillar name
 * @returns {{ ok: true, actions: CoachAction[] } | { ok: false, code: string, errors: string[] }}
 */
export function aggregateCoachActions(pillarActions) {
  if (!pillarActions || typeof pillarActions !== 'object' || Array.isArray(pillarActions)) {
    return { ok: false, code: 'invalid_input', errors: ['pillarActions must be an object'] };
  }

  const all = [];
  for (const [pillar, actions] of Object.entries(pillarActions)) {
    if (!Array.isArray(actions)) continue;
    for (const a of actions) {
      if (!a.id || !a.title) continue;
      all.push({ ...a, pillar: a.pillar ?? pillar });
    }
  }

  const deduped = deduplicateActions(all);
  deduped.sort((a, b) => scoreAction(b) - scoreAction(a));

  return { ok: true, actions: deduped };
}

// ---------------------------------------------------------------------------
// Deduplication
// ---------------------------------------------------------------------------

/**
 * Remove duplicate actions by ID; if same controlId appears multiple times keep highest-score.
 *
 * @param {CoachAction[]} actions
 * @returns {CoachAction[]}
 */
export function deduplicateActions(actions) {
  if (!Array.isArray(actions)) return [];

  const byId = new Map();
  const byControl = new Map();

  for (const action of actions) {
    if (byId.has(action.id)) {
      const existing = byId.get(action.id);
      if (scoreAction(action) > scoreAction(existing)) byId.set(action.id, action);
    } else {
      byId.set(action.id, action);
    }
  }

  const deduped = [...byId.values()];

  const result = [];
  for (const action of deduped) {
    if (action.controlId) {
      if (byControl.has(action.controlId)) {
        const existing = byControl.get(action.controlId);
        if (scoreAction(action) > scoreAction(existing)) {
          byControl.set(action.controlId, action);
        }
      } else {
        byControl.set(action.controlId, action);
        result.push(action);
      }
    } else {
      result.push(action);
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Grouping
// ---------------------------------------------------------------------------

/**
 * Group a flat action list by pillar.
 *
 * @param {CoachAction[]} actions
 * @returns {Record<string, CoachAction[]>}
 */
export function groupByPillar(actions) {
  if (!Array.isArray(actions)) return {};
  const groups = {};
  for (const pillar of VALID_PILLARS) groups[pillar] = [];
  for (const a of actions) {
    const p = VALID_PILLARS.includes(a.pillar) ? a.pillar : 'OBSERVE';
    groups[p].push(a);
  }
  return groups;
}

// ---------------------------------------------------------------------------
// Filtering
// ---------------------------------------------------------------------------

/**
 * @typedef {object} ActionFilter
 * @property {string}   [pillar]    - restrict to one pillar
 * @property {string}   [severity]  - minimum severity
 * @property {string}   [effort]    - maximum effort
 */

/**
 * Filter a ranked action list by pillar, minimum severity, and maximum effort.
 *
 * @param {CoachAction[]} actions
 * @param {ActionFilter}  filter
 * @returns {{ ok: true, actions: CoachAction[] } | { ok: false, code: string, errors: string[] }}
 */
export function applyAdminFilter(actions, filter = {}) {
  if (!Array.isArray(actions)) {
    return { ok: false, code: 'invalid_input', errors: ['actions must be an array'] };
  }
  if (filter.pillar && !VALID_PILLARS.includes(filter.pillar)) {
    return { ok: false, code: 'invalid_input', errors: [`unknown pillar '${filter.pillar}'`] };
  }
  if (filter.severity && !VALID_SEVERITIES.includes(filter.severity)) {
    return { ok: false, code: 'invalid_input', errors: [`unknown severity '${filter.severity}'`] };
  }

  let result = actions;

  if (filter.pillar) result = result.filter((a) => a.pillar === filter.pillar);

  if (filter.severity) {
    const minIdx = VALID_SEVERITIES.indexOf(filter.severity);
    result = result.filter((a) => VALID_SEVERITIES.indexOf(a.severity) <= minIdx);
  }

  if (filter.effort) {
    const maxIdx = VALID_EFFORTS.indexOf(filter.effort);
    result = result.filter((a) => VALID_EFFORTS.indexOf(a.effort ?? 'high') <= maxIdx);
  }

  return { ok: true, actions: result };
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

/**
 * Build a concise summary of an action list.
 *
 * @param {CoachAction[]} actions
 * @returns {{ ok: true, summary: object } | { ok: false, code: string, errors: string[] }}
 */
export function buildActionSummary(actions) {
  if (!Array.isArray(actions)) {
    return { ok: false, code: 'invalid_input', errors: ['actions must be an array'] };
  }

  const countByPillar = {};
  const countBySeverity = {};
  let estimatedTotalImpact = 0;

  for (const a of actions) {
    const p = a.pillar ?? 'OBSERVE';
    countByPillar[p] = (countByPillar[p] ?? 0) + 1;
    const s = a.severity ?? 'low';
    countBySeverity[s] = (countBySeverity[s] ?? 0) + 1;
    estimatedTotalImpact += a.impact ?? 0;
  }

  return {
    ok: true,
    summary: {
      total: actions.length,
      countByPillar,
      countBySeverity,
      estimatedTotalImpact: Math.round(estimatedTotalImpact),
      topAction: actions[0] ?? null,
    },
  };
}
