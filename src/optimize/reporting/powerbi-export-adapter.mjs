/**
 * Power BI export adapter — scorecard and coach actions shaped for Power BI dataset schema.
 * Pillar: OPTIMIZE (reporting)
 *
 * Produces a Power BI Push Dataset schema: tables with columns and rows.
 * No HTTP: returns plain objects for the caller to POST to the Power BI REST API.
 * Pure/deterministic.
 */

/** Power BI dataset name used when creating a push dataset. */
export const DATASET_NAME = 'FrontierIQ_TenantInsights';

/** Supported Power BI column data types. */
export const PBI_COLUMN_TYPES = Object.freeze({
  STRING: 'String',
  INT64: 'Int64',
  DOUBLE: 'Double',
  BOOLEAN: 'Boolean',
  DATETIME: 'DateTime',
});

/**
 * Build the Power BI dataset schema definition.
 * Defines tables: TenantScorecard, CoachActions, PillarScores.
 * @returns {Object} Power BI dataset schema
 */
export function buildDatasetSchema() {
  return {
    name: DATASET_NAME,
    tables: [
      {
        name: 'TenantScorecard',
        columns: [
          { name: 'tenantId', dataType: PBI_COLUMN_TYPES.STRING },
          { name: 'generatedAt', dataType: PBI_COLUMN_TYPES.DATETIME },
          { name: 'overallScore', dataType: PBI_COLUMN_TYPES.INT64 },
          { name: 'healthBand', dataType: PBI_COLUMN_TYPES.STRING },
          { name: 'observeScore', dataType: PBI_COLUMN_TYPES.INT64 },
          { name: 'governScore', dataType: PBI_COLUMN_TYPES.INT64 },
          { name: 'secureScore', dataType: PBI_COLUMN_TYPES.INT64 },
          { name: 'optimizeScore', dataType: PBI_COLUMN_TYPES.INT64 },
        ],
      },
      {
        name: 'CoachActions',
        columns: [
          { name: 'actionId', dataType: PBI_COLUMN_TYPES.STRING },
          { name: 'tenantId', dataType: PBI_COLUMN_TYPES.STRING },
          { name: 'pillar', dataType: PBI_COLUMN_TYPES.STRING },
          { name: 'title', dataType: PBI_COLUMN_TYPES.STRING },
          { name: 'severity', dataType: PBI_COLUMN_TYPES.STRING },
          { name: 'impact', dataType: PBI_COLUMN_TYPES.INT64 },
          { name: 'confidence', dataType: PBI_COLUMN_TYPES.DOUBLE },
          { name: 'rank', dataType: PBI_COLUMN_TYPES.INT64 },
          { name: 'generatedAt', dataType: PBI_COLUMN_TYPES.DATETIME },
        ],
      },
      {
        name: 'PillarScores',
        columns: [
          { name: 'tenantId', dataType: PBI_COLUMN_TYPES.STRING },
          { name: 'pillar', dataType: PBI_COLUMN_TYPES.STRING },
          { name: 'score', dataType: PBI_COLUMN_TYPES.INT64 },
          { name: 'generatedAt', dataType: PBI_COLUMN_TYPES.DATETIME },
        ],
      },
    ],
  };
}

/**
 * Convert a tenant health scorecard into Power BI TenantScorecard rows.
 * @param {Object} scorecard - Output of tenant-health-scorecard.mjs buildHealthScorecard
 * @param {string} tenantId
 * @param {string} generatedAt - ISO timestamp
 * @returns {Object[]} Row objects for the TenantScorecard table
 */
export function scorecardToRows(scorecard, tenantId, generatedAt) {
  if (!scorecard || typeof scorecard !== 'object') return [];
  return [
    {
      tenantId: tenantId ?? null,
      generatedAt: generatedAt ?? null,
      overallScore: scorecard.overallScore ?? 0,
      healthBand: scorecard.healthBand ?? 'unknown',
      observeScore: scorecard.pillarScores?.OBSERVE ?? 0,
      governScore: scorecard.pillarScores?.GOVERN ?? 0,
      secureScore: scorecard.pillarScores?.SECURE ?? 0,
      optimizeScore: scorecard.pillarScores?.OPTIMIZE ?? 0,
    },
  ];
}

/**
 * Convert pillar scores into Power BI PillarScores rows (one row per pillar).
 * @param {Object} scorecard
 * @param {string} tenantId
 * @param {string} generatedAt
 * @returns {Object[]}
 */
export function pillarScoresToRows(scorecard, tenantId, generatedAt) {
  if (!scorecard?.pillarScores || typeof scorecard.pillarScores !== 'object') return [];
  return Object.entries(scorecard.pillarScores).map(([pillar, score]) => ({
    tenantId: tenantId ?? null,
    pillar,
    score: score ?? 0,
    generatedAt: generatedAt ?? null,
  }));
}

/**
 * Convert an array of ranked coach actions into Power BI CoachActions rows.
 * @param {Object[]} actions - Ranked coach action objects
 * @param {string} tenantId
 * @param {string} generatedAt
 * @returns {Object[]}
 */
export function actionsToRows(actions, tenantId, generatedAt) {
  if (!Array.isArray(actions)) return [];
  return actions.map((a, idx) => ({
    actionId: a.id ?? `action-${idx}`,
    tenantId: tenantId ?? null,
    pillar: a.pillar ?? null,
    title: a.title ?? null,
    severity: a.severity ?? null,
    impact: typeof a.impact === 'number' ? a.impact : 0,
    confidence: typeof a.confidence === 'number' ? a.confidence : 0,
    rank: idx + 1,
    generatedAt: generatedAt ?? null,
  }));
}

/**
 * Build a complete Power BI push payload for a tenant.
 * @param {Object} opts
 * @param {Object} opts.scorecard
 * @param {Object[]} opts.actions - Ranked coach actions
 * @param {string} opts.tenantId
 * @param {string} opts.generatedAt
 * @returns {{ schema: Object, rows: { TenantScorecard: Object[], PillarScores: Object[], CoachActions: Object[] } }}
 */
export function buildPowerBIPayload({ scorecard, actions, tenantId, generatedAt } = {}) {
  return {
    schema: buildDatasetSchema(),
    rows: {
      TenantScorecard: scorecardToRows(scorecard, tenantId, generatedAt),
      PillarScores: pillarScoresToRows(scorecard, tenantId, generatedAt),
      CoachActions: actionsToRows(actions, tenantId, generatedAt),
    },
  };
}
