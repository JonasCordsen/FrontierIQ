/**
 * Fabric export adapter — signals and audit events shaped for Microsoft Fabric lakehouse ingestion.
 * Pillar: OPTIMIZE (reporting)
 *
 * Produces row-oriented record sets suitable for Fabric lakehouse Delta table ingestion.
 * Format: { tableName, schema: { columns: [...] }, rows: [...] }
 * No HTTP, no side effects. Pure/deterministic.
 */

/** Fabric Delta table names. */
export const FABRIC_TABLE_NAMES = Object.freeze({
  SIGNALS: 'frontieriq_signals',
  AUDIT_EVENTS: 'frontieriq_audit_events',
  CORRELATIONS: 'frontieriq_correlations',
  SCORECARD_HISTORY: 'frontieriq_scorecard_history',
});

/** Fabric column data types (Delta Lake / Spark types). */
export const FABRIC_COLUMN_TYPES = Object.freeze({
  STRING: 'string',
  LONG: 'long',
  DOUBLE: 'double',
  BOOLEAN: 'boolean',
  TIMESTAMP: 'timestamp',
  INTEGER: 'integer',
});

/**
 * Build the Fabric table schema for signals.
 * @returns {Object}
 */
export function buildSignalsTableSchema() {
  return {
    tableName: FABRIC_TABLE_NAMES.SIGNALS,
    columns: [
      { name: 'signalId', type: FABRIC_COLUMN_TYPES.STRING, nullable: false },
      { name: 'tenantId', type: FABRIC_COLUMN_TYPES.STRING, nullable: false },
      { name: 'resourceId', type: FABRIC_COLUMN_TYPES.STRING, nullable: true },
      { name: 'pillar', type: FABRIC_COLUMN_TYPES.STRING, nullable: false },
      { name: 'severity', type: FABRIC_COLUMN_TYPES.STRING, nullable: false },
      { name: 'category', type: FABRIC_COLUMN_TYPES.STRING, nullable: true },
      { name: 'detectedAt', type: FABRIC_COLUMN_TYPES.TIMESTAMP, nullable: false },
      { name: 'exportedAt', type: FABRIC_COLUMN_TYPES.TIMESTAMP, nullable: false },
    ],
  };
}

/**
 * Build the Fabric table schema for audit events.
 * @returns {Object}
 */
export function buildAuditEventsTableSchema() {
  return {
    tableName: FABRIC_TABLE_NAMES.AUDIT_EVENTS,
    columns: [
      { name: 'eventId', type: FABRIC_COLUMN_TYPES.STRING, nullable: false },
      { name: 'tenantId', type: FABRIC_COLUMN_TYPES.STRING, nullable: false },
      { name: 'userId', type: FABRIC_COLUMN_TYPES.STRING, nullable: true },
      { name: 'activityType', type: FABRIC_COLUMN_TYPES.STRING, nullable: false },
      { name: 'severity', type: FABRIC_COLUMN_TYPES.STRING, nullable: false },
      { name: 'pillar', type: FABRIC_COLUMN_TYPES.STRING, nullable: true },
      { name: 'occurredAt', type: FABRIC_COLUMN_TYPES.TIMESTAMP, nullable: false },
      { name: 'exportedAt', type: FABRIC_COLUMN_TYPES.TIMESTAMP, nullable: false },
    ],
  };
}

/**
 * Build the Fabric table schema for scorecard history.
 * @returns {Object}
 */
export function buildScorecardHistoryTableSchema() {
  return {
    tableName: FABRIC_TABLE_NAMES.SCORECARD_HISTORY,
    columns: [
      { name: 'tenantId', type: FABRIC_COLUMN_TYPES.STRING, nullable: false },
      { name: 'overallScore', type: FABRIC_COLUMN_TYPES.INTEGER, nullable: false },
      { name: 'healthBand', type: FABRIC_COLUMN_TYPES.STRING, nullable: false },
      { name: 'observeScore', type: FABRIC_COLUMN_TYPES.INTEGER, nullable: true },
      { name: 'governScore', type: FABRIC_COLUMN_TYPES.INTEGER, nullable: true },
      { name: 'secureScore', type: FABRIC_COLUMN_TYPES.INTEGER, nullable: true },
      { name: 'optimizeScore', type: FABRIC_COLUMN_TYPES.INTEGER, nullable: true },
      { name: 'generatedAt', type: FABRIC_COLUMN_TYPES.TIMESTAMP, nullable: false },
      { name: 'exportedAt', type: FABRIC_COLUMN_TYPES.TIMESTAMP, nullable: false },
    ],
  };
}

/**
 * Convert an array of correlated signal groups into Fabric signals rows.
 * @param {Object[]} signals - Raw signal objects (e.g. from signal-correlator)
 * @param {string} tenantId
 * @param {string} exportedAt - ISO timestamp
 * @returns {Object} { tableName, schema, rows }
 */
export function exportSignals(signals, tenantId, exportedAt) {
  const schema = buildSignalsTableSchema();
  if (!Array.isArray(signals)) {
    return { tableName: schema.tableName, schema, rows: [] };
  }
  const rows = signals.map((s, idx) => ({
    signalId: s.id ?? `signal-${idx}`,
    tenantId: tenantId ?? null,
    resourceId: s.resourceId ?? null,
    pillar: s.pillar ?? null,
    severity: s.severity ?? 'unknown',
    category: s.category ?? null,
    detectedAt: s.detectedAt ?? null,
    exportedAt: exportedAt ?? null,
  }));
  return { tableName: schema.tableName, schema, rows };
}

/**
 * Convert an array of audit events into Fabric audit_events rows.
 * @param {Object[]} events - Classified audit event objects
 * @param {string} tenantId
 * @param {string} exportedAt
 * @returns {Object} { tableName, schema, rows }
 */
export function exportAuditEvents(events, tenantId, exportedAt) {
  const schema = buildAuditEventsTableSchema();
  if (!Array.isArray(events)) {
    return { tableName: schema.tableName, schema, rows: [] };
  }
  const rows = events.map((e, idx) => ({
    eventId: e.id ?? `event-${idx}`,
    tenantId: tenantId ?? null,
    userId: e.userId ?? null,
    activityType: e.activityType ?? e.category ?? null,
    severity: e.severity ?? 'unknown',
    pillar: e.pillar ?? null,
    occurredAt: e.occurredAt ?? e.createdAt ?? null,
    exportedAt: exportedAt ?? null,
  }));
  return { tableName: schema.tableName, schema, rows };
}

/**
 * Convert a scorecard into a Fabric scorecard_history row set.
 * @param {Object} scorecard
 * @param {string} tenantId
 * @param {string} exportedAt
 * @returns {Object} { tableName, schema, rows }
 */
export function exportScorecardHistory(scorecard, tenantId, exportedAt) {
  const schema = buildScorecardHistoryTableSchema();
  if (!scorecard || typeof scorecard !== 'object') {
    return { tableName: schema.tableName, schema, rows: [] };
  }
  const rows = [
    {
      tenantId: tenantId ?? null,
      overallScore: scorecard.overallScore ?? 0,
      healthBand: scorecard.healthBand ?? 'unknown',
      observeScore: scorecard.pillarScores?.OBSERVE ?? null,
      governScore: scorecard.pillarScores?.GOVERN ?? null,
      secureScore: scorecard.pillarScores?.SECURE ?? null,
      optimizeScore: scorecard.pillarScores?.OPTIMIZE ?? null,
      generatedAt: scorecard.generatedAt ?? null,
      exportedAt: exportedAt ?? null,
    },
  ];
  return { tableName: schema.tableName, schema, rows };
}

/**
 * Build a full Fabric export bundle containing all tables.
 * @param {Object} opts
 * @param {Object[]} opts.signals
 * @param {Object[]} opts.auditEvents
 * @param {Object} opts.scorecard
 * @param {string} opts.tenantId
 * @param {string} opts.exportedAt
 * @returns {{ tables: Object[] }}
 */
export function buildFabricExportBundle({ signals, auditEvents, scorecard, tenantId, exportedAt } = {}) {
  return {
    tables: [
      exportSignals(signals, tenantId, exportedAt),
      exportAuditEvents(auditEvents, tenantId, exportedAt),
      exportScorecardHistory(scorecard, tenantId, exportedAt),
    ],
  };
}
