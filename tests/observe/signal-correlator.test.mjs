import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCorrelationKey,
  classifyCorrelationRisk,
  correlateSignals,
  listHighRiskCorrelations,
  buildCorrelationSummary,
} from '../../src/observe/signal-correlator.mjs';

const base = { tenantId: 't1', resourceId: 'res-1', timestamp: '2026-06-01T10:00:00Z', severity: 'high', pillar: 'SECURE' };

describe('buildCorrelationKey', () => {
  it('produces a string key', () => {
    assert.equal(typeof buildCorrelationKey(base), 'string');
  });
  it('same tenant+resource+bucket → same key', () => {
    const a = { ...base, timestamp: '2026-06-01T10:10:00Z' };
    const b = { ...base, timestamp: '2026-06-01T10:30:00Z' };
    assert.equal(buildCorrelationKey(a), buildCorrelationKey(b));
  });
  it('different resource → different key', () => {
    assert.notEqual(buildCorrelationKey(base), buildCorrelationKey({ ...base, resourceId: 'res-2' }));
  });
  it('different time bucket → different key', () => {
    const a = { ...base, timestamp: '2026-06-01T10:00:00Z' };
    const b = { ...base, timestamp: '2026-06-01T12:00:00Z' };
    assert.notEqual(buildCorrelationKey(a), buildCorrelationKey(b));
  });
  it('handles missing timestamp gracefully', () => {
    assert.equal(typeof buildCorrelationKey({ tenantId: 't1', resourceId: 'r1' }), 'string');
  });
});

describe('classifyCorrelationRisk', () => {
  it('single low signal with one pillar → low', () => {
    const r = classifyCorrelationRisk({ signals: [{ severity: 'low' }], pillars: ['OBSERVE'] });
    assert.equal(r, 'low');
  });
  it('single high signal with one pillar → high', () => {
    const r = classifyCorrelationRisk({ signals: [{ severity: 'high' }], pillars: ['SECURE'] });
    assert.equal(r, 'high');
  });
  it('elevates when two pillars involved', () => {
    const r = classifyCorrelationRisk({ signals: [{ severity: 'high' }, { severity: 'medium' }], pillars: ['SECURE', 'GOVERN'] });
    assert.equal(r, 'critical');
  });
  it('caps at critical', () => {
    const r = classifyCorrelationRisk({ signals: [{ severity: 'critical' }], pillars: ['SECURE', 'GOVERN', 'OBSERVE', 'OPTIMIZE'] });
    assert.equal(r, 'critical');
  });
  it('empty signals → low', () => {
    assert.equal(classifyCorrelationRisk({ signals: [], pillars: [] }), 'low');
  });
});

describe('correlateSignals', () => {
  const signals = [
    { ...base, pillar: 'SECURE', severity: 'high' },
    { ...base, pillar: 'GOVERN', severity: 'medium', timestamp: '2026-06-01T10:20:00Z' },
    { tenantId: 't1', resourceId: 'res-2', timestamp: '2026-06-01T10:00:00Z', pillar: 'OBSERVE', severity: 'low' },
  ];

  it('groups signals by tenant+resource+window', () => {
    const r = correlateSignals(signals);
    assert.ok(r.ok);
    assert.equal(r.correlations.length, 2);
  });
  it('elevates severity for multi-pillar groups', () => {
    const r = correlateSignals(signals);
    const group = r.correlations.find((c) => c.resourceId === 'res-1');
    assert.ok(['high', 'critical'].includes(group.elevatedSeverity));
  });
  it('records pillars per group', () => {
    const r = correlateSignals(signals);
    const group = r.correlations.find((c) => c.resourceId === 'res-1');
    assert.ok(group.pillars.includes('SECURE'));
    assert.ok(group.pillars.includes('GOVERN'));
  });
  it('skips signals missing required fields', () => {
    const r = correlateSignals([{ pillar: 'SECURE', severity: 'high' }]);
    assert.ok(r.ok);
    assert.equal(r.correlations.length, 0);
    assert.equal(r.skipped.length, 1);
    assert.equal(r.skipped[0].reason, 'missing_required_fields');
  });
  it('skips signals with unknown pillar', () => {
    const r = correlateSignals([{ ...base, pillar: 'UNKNOWN' }]);
    assert.equal(r.skipped[0].reason, 'unknown_pillar');
  });
  it('rejects non-array input', () => {
    assert.ok(!correlateSignals(null).ok);
    assert.ok(!correlateSignals('string').ok);
  });
  it('handles empty signal array', () => {
    const r = correlateSignals([]);
    assert.ok(r.ok);
    assert.equal(r.correlations.length, 0);
  });
});

describe('listHighRiskCorrelations', () => {
  it('returns only high and critical groups', () => {
    const correlations = [
      { elevatedSeverity: 'critical', resourceId: 'r1' },
      { elevatedSeverity: 'high', resourceId: 'r2' },
      { elevatedSeverity: 'medium', resourceId: 'r3' },
      { elevatedSeverity: 'low', resourceId: 'r4' },
    ];
    const r = listHighRiskCorrelations(correlations);
    assert.equal(r.length, 2);
    assert.ok(r.every((c) => ['high', 'critical'].includes(c.elevatedSeverity)));
  });
  it('returns empty array for non-array input', () => {
    assert.deepEqual(listHighRiskCorrelations(null), []);
  });
  it('returns empty array when no high-risk groups', () => {
    assert.equal(listHighRiskCorrelations([{ elevatedSeverity: 'low' }]).length, 0);
  });
});

describe('buildCorrelationSummary', () => {
  it('counts total and high-risk correlations', () => {
    const correlations = [
      { elevatedSeverity: 'critical', pillars: ['SECURE', 'GOVERN'] },
      { elevatedSeverity: 'medium', pillars: ['OBSERVE'] },
    ];
    const r = buildCorrelationSummary(correlations);
    assert.ok(r.ok);
    assert.equal(r.summary.total, 2);
    assert.equal(r.summary.highRiskCount, 1);
  });
  it('counts by severity', () => {
    const r = buildCorrelationSummary([
      { elevatedSeverity: 'high', pillars: ['SECURE'] },
      { elevatedSeverity: 'high', pillars: ['GOVERN'] },
    ]);
    assert.equal(r.summary.countBySeverity.high, 2);
  });
  it('counts by pillar coverage', () => {
    const r = buildCorrelationSummary([
      { elevatedSeverity: 'critical', pillars: ['SECURE', 'GOVERN'] },
    ]);
    assert.equal(r.summary.countByPillarCoverage[2], 1);
  });
  it('rejects non-array input', () => {
    assert.ok(!buildCorrelationSummary(null).ok);
  });
  it('handles empty correlations', () => {
    const r = buildCorrelationSummary([]);
    assert.equal(r.summary.total, 0);
    assert.equal(r.summary.highRiskCount, 0);
  });
});
