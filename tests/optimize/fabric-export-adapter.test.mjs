import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  FABRIC_TABLE_NAMES,
  FABRIC_COLUMN_TYPES,
  buildSignalsTableSchema,
  buildAuditEventsTableSchema,
  buildScorecardHistoryTableSchema,
  exportSignals,
  exportAuditEvents,
  exportScorecardHistory,
  buildFabricExportBundle,
} from '../../src/optimize/reporting/fabric-export-adapter.mjs';

const TS = '2024-01-01T00:00:00.000Z';
const TENANT = 'tenant-fabric';

const signals = [
  { id: 's1', resourceId: 'res-1', pillar: 'SECURE', severity: 'high', category: 'identity', detectedAt: TS },
  { id: 's2', resourceId: 'res-2', pillar: 'OBSERVE', severity: 'medium', category: 'usage', detectedAt: TS },
];

const auditEvents = [
  { id: 'e1', userId: 'user-1', activityType: 'fileAccess', severity: 'medium', pillar: 'SECURE', occurredAt: TS },
  { id: 'e2', activityType: 'loginFailure', severity: 'high', pillar: 'SECURE', occurredAt: TS },
];

const scorecard = {
  overallScore: 72,
  healthBand: 'good',
  generatedAt: TS,
  pillarScores: { OBSERVE: 80, GOVERN: 65, SECURE: 70, OPTIMIZE: 75 },
};

describe('FABRIC_TABLE_NAMES', () => {
  it('contains all expected table names', () => {
    assert.ok(FABRIC_TABLE_NAMES.SIGNALS);
    assert.ok(FABRIC_TABLE_NAMES.AUDIT_EVENTS);
    assert.ok(FABRIC_TABLE_NAMES.SCORECARD_HISTORY);
  });
});

describe('buildSignalsTableSchema', () => {
  const schema = buildSignalsTableSchema();
  it('has correct table name', () => {
    assert.equal(schema.tableName, FABRIC_TABLE_NAMES.SIGNALS);
  });
  it('includes required columns', () => {
    const cols = schema.columns.map(c => c.name);
    assert.ok(cols.includes('signalId'));
    assert.ok(cols.includes('tenantId'));
    assert.ok(cols.includes('severity'));
    assert.ok(cols.includes('exportedAt'));
  });
  it('uses valid Fabric column types', () => {
    const validTypes = new Set(Object.values(FABRIC_COLUMN_TYPES));
    for (const col of schema.columns) {
      assert.ok(validTypes.has(col.type), `unknown type: ${col.type} on ${col.name}`);
    }
  });
});

describe('buildAuditEventsTableSchema', () => {
  const schema = buildAuditEventsTableSchema();
  it('has audit_events table name', () => {
    assert.equal(schema.tableName, FABRIC_TABLE_NAMES.AUDIT_EVENTS);
  });
  it('includes userId and activityType', () => {
    const cols = schema.columns.map(c => c.name);
    assert.ok(cols.includes('userId'));
    assert.ok(cols.includes('activityType'));
  });
});

describe('buildScorecardHistoryTableSchema', () => {
  const schema = buildScorecardHistoryTableSchema();
  it('has scorecard_history table name', () => {
    assert.equal(schema.tableName, FABRIC_TABLE_NAMES.SCORECARD_HISTORY);
  });
  it('includes pillar score columns', () => {
    const cols = schema.columns.map(c => c.name);
    assert.ok(cols.includes('observeScore'));
    assert.ok(cols.includes('governScore'));
    assert.ok(cols.includes('secureScore'));
    assert.ok(cols.includes('optimizeScore'));
  });
});

describe('exportSignals', () => {
  it('produces one row per signal', () => {
    const r = exportSignals(signals, TENANT, TS);
    assert.equal(r.rows.length, 2);
    assert.equal(r.tableName, FABRIC_TABLE_NAMES.SIGNALS);
  });
  it('maps signal fields correctly', () => {
    const r = exportSignals(signals, TENANT, TS);
    assert.equal(r.rows[0].signalId, 's1');
    assert.equal(r.rows[0].tenantId, TENANT);
    assert.equal(r.rows[0].pillar, 'SECURE');
    assert.equal(r.rows[0].exportedAt, TS);
  });
  it('returns empty rows for null input', () => {
    const r = exportSignals(null, TENANT, TS);
    assert.deepEqual(r.rows, []);
  });
  it('generates fallback signalId when id missing', () => {
    const r = exportSignals([{ pillar: 'OBSERVE', severity: 'low' }], TENANT, TS);
    assert.ok(r.rows[0].signalId.startsWith('signal-'));
  });
});

describe('exportAuditEvents', () => {
  it('produces one row per event', () => {
    const r = exportAuditEvents(auditEvents, TENANT, TS);
    assert.equal(r.rows.length, 2);
  });
  it('maps userId correctly', () => {
    const r = exportAuditEvents(auditEvents, TENANT, TS);
    assert.equal(r.rows[0].userId, 'user-1');
    assert.equal(r.rows[1].userId, null);
  });
  it('returns empty rows for non-array', () => {
    assert.deepEqual(exportAuditEvents('bad', TENANT, TS).rows, []);
  });
  it('falls back to category when activityType missing', () => {
    const r = exportAuditEvents([{ id: 'x', category: 'login', severity: 'low' }], TENANT, TS);
    assert.equal(r.rows[0].activityType, 'login');
  });
});

describe('exportScorecardHistory', () => {
  it('produces one row for the scorecard', () => {
    const r = exportScorecardHistory(scorecard, TENANT, TS);
    assert.equal(r.rows.length, 1);
    assert.equal(r.rows[0].overallScore, 72);
    assert.equal(r.rows[0].observeScore, 80);
    assert.equal(r.rows[0].healthBand, 'good');
  });
  it('returns empty rows for null scorecard', () => {
    assert.deepEqual(exportScorecardHistory(null, TENANT, TS).rows, []);
  });
});

describe('buildFabricExportBundle', () => {
  it('returns bundle with all three tables', () => {
    const b = buildFabricExportBundle({ signals, auditEvents, scorecard, tenantId: TENANT, exportedAt: TS });
    assert.equal(b.tables.length, 3);
    const tableNames = b.tables.map(t => t.tableName);
    assert.ok(tableNames.includes(FABRIC_TABLE_NAMES.SIGNALS));
    assert.ok(tableNames.includes(FABRIC_TABLE_NAMES.AUDIT_EVENTS));
    assert.ok(tableNames.includes(FABRIC_TABLE_NAMES.SCORECARD_HISTORY));
  });
  it('returns empty rows on all tables when called with no args', () => {
    const b = buildFabricExportBundle();
    for (const table of b.tables) {
      assert.deepEqual(table.rows, []);
    }
  });
  it('each table has a schema with columns array', () => {
    const b = buildFabricExportBundle({ signals, auditEvents, scorecard, tenantId: TENANT, exportedAt: TS });
    for (const table of b.tables) {
      assert.ok(Array.isArray(table.schema.columns));
    }
  });
});
