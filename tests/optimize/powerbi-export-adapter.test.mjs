import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DATASET_NAME,
  PBI_COLUMN_TYPES,
  buildDatasetSchema,
  scorecardToRows,
  pillarScoresToRows,
  actionsToRows,
  buildPowerBIPayload,
} from '../../src/optimize/reporting/powerbi-export-adapter.mjs';

const TS = '2024-01-01T00:00:00.000Z';
const TENANT = 'tenant-pbi';

const scorecard = {
  overallScore: 75,
  healthBand: 'good',
  pillarScores: { OBSERVE: 80, GOVERN: 70, SECURE: 75, OPTIMIZE: 72 },
};

const actions = [
  { id: 'a1', pillar: 'SECURE', title: 'Enable MFA', severity: 'high', impact: 8, confidence: 0.9 },
  { id: 'a2', pillar: 'GOVERN', title: 'Review policies', severity: 'medium', impact: 5, confidence: 0.7 },
];

describe('buildDatasetSchema', () => {
  const schema = buildDatasetSchema();
  it('has correct dataset name', () => {
    assert.equal(schema.name, DATASET_NAME);
  });
  it('has TenantScorecard, CoachActions, PillarScores tables', () => {
    const names = schema.tables.map(t => t.name);
    assert.ok(names.includes('TenantScorecard'));
    assert.ok(names.includes('CoachActions'));
    assert.ok(names.includes('PillarScores'));
  });
  it('TenantScorecard has all required columns', () => {
    const t = schema.tables.find(t => t.name === 'TenantScorecard');
    const cols = t.columns.map(c => c.name);
    assert.ok(cols.includes('tenantId'));
    assert.ok(cols.includes('overallScore'));
    assert.ok(cols.includes('healthBand'));
  });
  it('uses recognised PBI data types', () => {
    const validTypes = new Set(Object.values(PBI_COLUMN_TYPES));
    for (const table of schema.tables) {
      for (const col of table.columns) {
        assert.ok(validTypes.has(col.dataType), `unknown type: ${col.dataType} in ${table.name}.${col.name}`);
      }
    }
  });
});

describe('scorecardToRows', () => {
  it('produces one row with correct field mapping', () => {
    const rows = scorecardToRows(scorecard, TENANT, TS);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].tenantId, TENANT);
    assert.equal(rows[0].overallScore, 75);
    assert.equal(rows[0].healthBand, 'good');
    assert.equal(rows[0].secureScore, 75);
  });
  it('returns empty array for null scorecard', () => {
    assert.deepEqual(scorecardToRows(null, TENANT, TS), []);
  });
  it('defaults missing pillar scores to 0', () => {
    const rows = scorecardToRows({ overallScore: 50, healthBand: 'fair', pillarScores: {} }, TENANT, TS);
    assert.equal(rows[0].observeScore, 0);
  });
});

describe('pillarScoresToRows', () => {
  it('produces one row per pillar', () => {
    const rows = pillarScoresToRows(scorecard, TENANT, TS);
    assert.equal(rows.length, 4);
    const pillars = rows.map(r => r.pillar);
    assert.ok(pillars.includes('OBSERVE'));
    assert.ok(pillars.includes('SECURE'));
  });
  it('returns empty array when pillarScores missing', () => {
    assert.deepEqual(pillarScoresToRows({}, TENANT, TS), []);
  });
  it('sets correct score for each pillar', () => {
    const rows = pillarScoresToRows(scorecard, TENANT, TS);
    const observe = rows.find(r => r.pillar === 'OBSERVE');
    assert.equal(observe.score, 80);
  });
});

describe('actionsToRows', () => {
  it('produces one row per action with rank', () => {
    const rows = actionsToRows(actions, TENANT, TS);
    assert.equal(rows.length, 2);
    assert.equal(rows[0].rank, 1);
    assert.equal(rows[1].rank, 2);
  });
  it('maps action fields correctly', () => {
    const rows = actionsToRows(actions, TENANT, TS);
    assert.equal(rows[0].actionId, 'a1');
    assert.equal(rows[0].pillar, 'SECURE');
    assert.equal(rows[0].severity, 'high');
    assert.equal(rows[0].impact, 8);
    assert.equal(rows[0].confidence, 0.9);
  });
  it('returns empty array for non-array input', () => {
    assert.deepEqual(actionsToRows(null, TENANT, TS), []);
  });
  it('generates fallback actionId when id is missing', () => {
    const rows = actionsToRows([{ pillar: 'OBSERVE', severity: 'low' }], TENANT, TS);
    assert.ok(rows[0].actionId.startsWith('action-'));
  });
});

describe('buildPowerBIPayload', () => {
  it('returns schema and rows object', () => {
    const p = buildPowerBIPayload({ scorecard, actions, tenantId: TENANT, generatedAt: TS });
    assert.ok(p.schema);
    assert.ok(p.rows);
  });
  it('rows object has all three tables', () => {
    const p = buildPowerBIPayload({ scorecard, actions, tenantId: TENANT, generatedAt: TS });
    assert.ok(Array.isArray(p.rows.TenantScorecard));
    assert.ok(Array.isArray(p.rows.PillarScores));
    assert.ok(Array.isArray(p.rows.CoachActions));
  });
  it('returns empty rows when called with no args', () => {
    const p = buildPowerBIPayload();
    assert.deepEqual(p.rows.TenantScorecard, []);
    assert.deepEqual(p.rows.CoachActions, []);
  });
  it('TenantScorecard has one row and PillarScores has four', () => {
    const p = buildPowerBIPayload({ scorecard, actions, tenantId: TENANT, generatedAt: TS });
    assert.equal(p.rows.TenantScorecard.length, 1);
    assert.equal(p.rows.PillarScores.length, 4);
  });
});
