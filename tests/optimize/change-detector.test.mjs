import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  detectChanges,
  classifyChange,
  buildChangeReport,
  listCriticalRegressions,
} from '../../src/optimize/reporting/change-detector.mjs';

const makeScorecard = (overall, pillars) => ({
  tenantId: 'tenant-delta',
  overall,
  pillars: {
    OBSERVE: { score: pillars.OBSERVE ?? 80 },
    GOVERN: { score: pillars.GOVERN ?? 70 },
    SECURE: { score: pillars.SECURE ?? 60 },
    OPTIMIZE: { score: pillars.OPTIMIZE ?? 90 },
  },
});

const current = makeScorecard(74, { OBSERVE: 80, GOVERN: 70, SECURE: 60, OPTIMIZE: 90 });
const previous = makeScorecard(60, { OBSERVE: 60, GOVERN: 50, SECURE: 40, OPTIMIZE: 70 });

describe('detectChanges', () => {
  it('detects improvements when current > previous', () => {
    const r = detectChanges(current, previous);
    assert.ok(r.ok);
    assert.ok(r.changes.some((c) => c.direction === 'improvement'));
    assert.ok(!r.isNewBaseline);
  });
  it('detects regressions when current < previous', () => {
    const r = detectChanges(previous, current);
    assert.ok(r.ok);
    assert.ok(r.changes.some((c) => c.direction === 'regression'));
  });
  it('skips changes within noise threshold', () => {
    const almostSame = makeScorecard(75, { OBSERVE: 81, GOVERN: 71, SECURE: 61, OPTIMIZE: 91 });
    const r = detectChanges(almostSame, current);
    assert.ok(r.ok);
    assert.equal(r.changes.length, 0);
  });
  it('isNewBaseline=true when previous is null', () => {
    const r = detectChanges(current, null);
    assert.ok(r.ok);
    assert.ok(r.isNewBaseline);
    assert.ok(r.changes.every((c) => c.direction === 'new-baseline'));
  });
  it('new-baseline changes have null previousValue', () => {
    const r = detectChanges(current, null);
    assert.ok(r.changes.every((c) => c.previousValue === null));
  });
  it('rejects mismatched tenantIds', () => {
    const other = { ...current, tenantId: 'other-tenant' };
    const r = detectChanges(current, other);
    assert.ok(!r.ok);
  });
  it('rejects missing current tenantId', () => {
    assert.ok(!detectChanges({}, previous).ok);
  });
  it('includes overall score change', () => {
    const r = detectChanges(current, previous);
    assert.ok(r.changes.some((c) => c.metric === 'overallScore'));
  });
});

describe('classifyChange', () => {
  it('noise for diff <= 2', () => {
    assert.equal(classifyChange({ diff: 1 }), 'noise');
    assert.equal(classifyChange({ diff: 2 }), 'noise');
  });
  it('medium for diff 3–5', () => {
    assert.equal(classifyChange({ diff: 3 }), 'medium');
    assert.equal(classifyChange({ diff: 5 }), 'medium');
  });
  it('high for diff > 5', () => {
    assert.equal(classifyChange({ diff: 6 }), 'high');
    assert.equal(classifyChange({ diff: 50 }), 'high');
  });
  it('handles missing diff gracefully', () => {
    assert.equal(classifyChange({}), 'noise');
    assert.equal(classifyChange(null), 'noise');
  });
});

describe('buildChangeReport', () => {
  it('separates regressions and improvements', () => {
    const { changes } = detectChanges(current, previous);
    const r = buildChangeReport(changes);
    assert.ok(r.ok);
    assert.ok(Array.isArray(r.report.regressions));
    assert.ok(Array.isArray(r.report.improvements));
  });
  it('hasRegressions is true when regressions present', () => {
    const { changes } = detectChanges(previous, current);
    const r = buildChangeReport(changes);
    assert.ok(r.report.hasRegressions);
  });
  it('hasRegressions is false when none', () => {
    const { changes } = detectChanges(current, previous);
    const r = buildChangeReport(changes);
    assert.ok(!r.report.hasRegressions);
  });
  it('reports unchanged pillars', () => {
    const r = buildChangeReport([]);
    assert.ok(Array.isArray(r.report.unchangedPillars));
    assert.equal(r.report.unchangedPillars.length, 4);
  });
  it('new-baseline changes go into newBaselines', () => {
    const { changes } = detectChanges(current, null);
    const r = buildChangeReport(changes);
    assert.ok(r.report.newBaselines.length > 0);
  });
  it('rejects non-array input', () => {
    assert.ok(!buildChangeReport(null).ok);
  });
});

describe('listCriticalRegressions', () => {
  it('returns only high-magnitude regressions', () => {
    const changes = [
      { direction: 'regression', magnitude: 'high', pillar: 'SECURE' },
      { direction: 'regression', magnitude: 'medium', pillar: 'GOVERN' },
      { direction: 'improvement', magnitude: 'high', pillar: 'OBSERVE' },
    ];
    const r = listCriticalRegressions(changes);
    assert.equal(r.length, 1);
    assert.equal(r[0].pillar, 'SECURE');
  });
  it('returns empty when no critical regressions', () => {
    assert.equal(listCriticalRegressions([{ direction: 'improvement', magnitude: 'high' }]).length, 0);
  });
  it('returns empty array for non-array input', () => {
    assert.deepEqual(listCriticalRegressions(null), []);
  });
});
