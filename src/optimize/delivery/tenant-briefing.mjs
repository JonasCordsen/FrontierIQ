/**
 * Tenant briefing — IT admin daily briefing payload contract.
 *
 * Assembles the IT admin-facing daily briefing from health scorecard,
 * ranked coach actions, and compliance/risk flags.
 *
 * Pillar: OPTIMIZE
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const RISK_SEVERITY_ORDER = Object.freeze(['critical', 'high', 'medium', 'low']);
const MAX_HIGHLIGHTS = 3;

// ---------------------------------------------------------------------------
// Health headline
// ---------------------------------------------------------------------------

/**
 * Build a one-line health headline string from a scorecard.
 *
 * @param {{ tenantId: string, overall: number, band: string }} scorecard
 * @returns {{ ok: true, headline: string } | { ok: false, code: string, errors: string[] }}
 */
export function buildHealthHeadline(scorecard) {
  if (!scorecard?.tenantId || typeof scorecard.overall !== 'number') {
    return { ok: false, code: 'invalid_input', errors: ['scorecard must have tenantId and overall score'] };
  }

  const trend = scorecard.delta?.trend ?? null;
  const trendPart = trend === 'improved' ? ' ↑ improving' : trend === 'regressed' ? ' ↓ regressing' : '';
  const headline = `Tenant ${scorecard.tenantId}: ${scorecard.band?.toUpperCase()} (${scorecard.overall}/100)${trendPart}`;

  return { ok: true, headline };
}

// ---------------------------------------------------------------------------
// Risk highlights
// ---------------------------------------------------------------------------

/**
 * @typedef {object} RiskFlag
 * @property {string} id
 * @property {string} severity    - critical | high | medium | low
 * @property {string} description
 * @property {string} pillar
 * @property {string} [action]    - recommended action
 */

/**
 * Build the top N risk highlights from a list of flags, sorted by severity.
 *
 * @param {RiskFlag[]} flags
 * @param {number}     [n=3]
 * @returns {{ ok: true, highlights: RiskFlag[] } | { ok: false, code: string, errors: string[] }}
 */
export function buildRiskHighlights(flags, n = MAX_HIGHLIGHTS) {
  if (!Array.isArray(flags)) {
    return { ok: false, code: 'invalid_input', errors: ['flags must be an array'] };
  }

  const sorted = [...flags].sort(
    (a, b) => RISK_SEVERITY_ORDER.indexOf(a.severity) - RISK_SEVERITY_ORDER.indexOf(b.severity),
  );

  return { ok: true, highlights: sorted.slice(0, n) };
}

// ---------------------------------------------------------------------------
// Compliance alert
// ---------------------------------------------------------------------------

/**
 * Extract critical or high-severity compliance gaps requiring immediate attention.
 *
 * @param {RiskFlag[]} flags
 * @returns {{ ok: true, alerts: RiskFlag[], requiresImmediateAction: boolean } | { ok: false, code: string, errors: string[] }}
 */
export function buildComplianceAlert(flags) {
  if (!Array.isArray(flags)) {
    return { ok: false, code: 'invalid_input', errors: ['flags must be an array'] };
  }

  const alerts = flags.filter(
    (f) => f.severity === 'critical' || f.severity === 'high',
  );

  return {
    ok: true,
    alerts,
    requiresImmediateAction: alerts.some((a) => a.severity === 'critical'),
  };
}

// ---------------------------------------------------------------------------
// Briefing builder
// ---------------------------------------------------------------------------

/**
 * @typedef {object} BriefingInput
 * @property {string}   tenantId
 * @property {object}   scorecard   - from buildHealthScorecard
 * @property {object[]} actions     - ranked coach actions
 * @property {object[]} flags       - risk / compliance flags
 */

/**
 * Build the complete IT admin daily briefing payload.
 *
 * @param {BriefingInput} input
 * @returns {{ ok: true, briefing: object } | { ok: false, code: string, errors: string[] }}
 */
export function buildTenantBriefing(input) {
  const errors = [];
  if (!input?.tenantId) errors.push('tenantId is required');
  if (!input?.scorecard) errors.push('scorecard is required');
  if (!Array.isArray(input?.actions)) errors.push('actions must be an array');
  if (!Array.isArray(input?.flags)) errors.push('flags must be an array');
  if (errors.length) return { ok: false, code: 'invalid_input', errors };

  const headlineResult = buildHealthHeadline(input.scorecard);
  const highlightResult = buildRiskHighlights(input.flags);
  const alertResult = buildComplianceAlert(input.flags);

  return {
    ok: true,
    briefing: {
      tenantId: input.tenantId,
      headline: headlineResult.ok ? headlineResult.headline : '(unavailable)',
      overallScore: input.scorecard.overall ?? 0,
      band: input.scorecard.band ?? 'critical',
      topActions: input.actions.slice(0, 5),
      riskHighlights: highlightResult.ok ? highlightResult.highlights : [],
      complianceAlerts: alertResult.ok ? alertResult.alerts : [],
      requiresImmediateAction: alertResult.ok ? alertResult.requiresImmediateAction : false,
      generatedAt: new Date(0).toISOString(),
    },
  };
}

// ---------------------------------------------------------------------------
// Summary (token-efficient for notifications / email)
// ---------------------------------------------------------------------------

/**
 * Build a token-efficient summary string from a briefing payload.
 *
 * @param {object} briefing   - from buildTenantBriefing
 * @returns {{ ok: true, summary: string } | { ok: false, code: string, errors: string[] }}
 */
export function buildBriefingSummary(briefing) {
  if (!briefing?.tenantId) {
    return { ok: false, code: 'invalid_input', errors: ['briefing must have tenantId'] };
  }

  const urgent = briefing.requiresImmediateAction ? ' ⚠ IMMEDIATE ACTION REQUIRED.' : '';
  const actionCount = briefing.topActions?.length ?? 0;
  const alertCount = briefing.complianceAlerts?.length ?? 0;

  const summary = [
    briefing.headline ?? '(no headline)',
    `${actionCount} coach action${actionCount !== 1 ? 's' : ''} recommended.`,
    alertCount > 0 ? `${alertCount} compliance alert${alertCount !== 1 ? 's' : ''} open.` : '',
    urgent,
  ]
    .filter(Boolean)
    .join(' ');

  return { ok: true, summary };
}
