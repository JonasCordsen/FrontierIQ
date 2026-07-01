import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  aggregateCoachActions,
  deduplicateActions,
  groupByPillar,
  applyAdminFilter,
  buildActionSummary,
} from '../../src/optimize/delivery/coach-action-aggregator.mjs';

const makeAction = (overrides = {}) => ({
  id: 'action-001',
  pillar: 'GOVERN',
  title: 'Enable MFA for all agent principals',
  description: 'Reduce identity risk by enforcing MFA.',
  severity: 'high',
  impact: 80,
  confidence: 0.9,
  effort: 'low',
  ...overrides,
});

const PILLAR_ACTIONS = {
  GOVERN: [
    makeAction({ id: 'g1', severity: 'high', impact: 80, confidence: 0.9 }),
    makeAction({ id: 'g2', severity: 'medium', impact: 50, confidence: 0.7, controlId: 'ctrl-01' }),
  ],
  SECURE: [
    makeAction({ id: 's1', pillar: 'SECURE', severity: 'critical', impact: 95, confidence: 0.95 }),
  ],
  OBSERVE: [
    makeAction({ id: 'o1', pillar: 'OBSERVE', severity: 'low', impact: 20, confidence: 0.5 }),
  ],
  OPTIMIZE: [],
};

describe('aggregateCoachActions', () => {
  it('merges all pillar actions into one list', () => {
    const r = aggregateCoachActions(PILLAR_ACTIONS);
    assert.ok(r.ok);
    assert.equal(r.actions.length, 4);
  });
  it('sorts by score descending (critical/high first)', () => {
    const r = aggregateCoachActions(PILLAR_ACTIONS);
    assert.equal(r.actions[0].id, 's1');
  });
  it('skips actions without id or title', () => {
    const r = aggregateCoachActions({ GOVERN: [{ severity: 'high' }] });
    assert.ok(r.ok);
    assert.equal(r.actions.length, 0);
  });
  it('handles empty pillar arrays', () => {
    const r = aggregateCoachActions({ OBSERVE: [], GOVERN: [], SECURE: [], OPTIMIZE: [] });
    assert.ok(r.ok);
    assert.equal(r.actions.length, 0);
  });
  it('rejects non-object input', () => {
    assert.ok(!aggregateCoachActions(null).ok);
    assert.ok(!aggregateCoachActions([]).ok);
  });
});

describe('deduplicateActions', () => {
  it('removes duplicate IDs keeping highest score', () => {
    const actions = [
      makeAction({ id: 'x', impact: 50, confidence: 0.5 }),
      makeAction({ id: 'x', impact: 90, confidence: 0.9 }),
    ];
    const r = deduplicateActions(actions);
    assert.equal(r.length, 1);
    assert.equal(r[0].impact, 90);
  });
  it('deduplicates by controlId keeping one per control', () => {
    const actions = [
      makeAction({ id: 'a', controlId: 'ctrl-99', impact: 60, confidence: 0.6 }),
      makeAction({ id: 'b', controlId: 'ctrl-99', impact: 80, confidence: 0.8 }),
    ];
    const controlActions = deduplicateActions(actions).filter((a) => a.controlId === 'ctrl-99');
    assert.equal(controlActions.length, 1);
  });
  it('returns empty array for non-array input', () => {
    assert.deepEqual(deduplicateActions(null), []);
  });
  it('preserves distinct actions', () => {
    const actions = [makeAction({ id: 'a' }), makeAction({ id: 'b' })];
    assert.equal(deduplicateActions(actions).length, 2);
  });
});

describe('groupByPillar', () => {
  it('groups actions by pillar', () => {
    const actions = [
      makeAction({ id: 'a', pillar: 'GOVERN' }),
      makeAction({ id: 'b', pillar: 'SECURE' }),
      makeAction({ id: 'c', pillar: 'GOVERN' }),
    ];
    const g = groupByPillar(actions);
    assert.equal(g.GOVERN.length, 2);
    assert.equal(g.SECURE.length, 1);
    assert.equal(g.OBSERVE.length, 0);
  });
  it('returns all four pillar keys even when empty', () => {
    const g = groupByPillar([]);
    assert.ok('OBSERVE' in g && 'GOVERN' in g && 'SECURE' in g && 'OPTIMIZE' in g);
  });
  it('defaults unknown pillar to OBSERVE', () => {
    const g = groupByPillar([makeAction({ pillar: 'UNKNOWN' })]);
    assert.equal(g.OBSERVE.length, 1);
  });
  it('returns empty object for non-array input', () => {
    assert.deepEqual(groupByPillar(null), {});
  });
});

describe('applyAdminFilter', () => {
  const actions = [
    makeAction({ id: 'a', pillar: 'GOVERN', severity: 'critical', effort: 'low' }),
    makeAction({ id: 'b', pillar: 'SECURE', severity: 'high', effort: 'medium' }),
    makeAction({ id: 'c', pillar: 'GOVERN', severity: 'low', effort: 'high' }),
  ];

  it('filters by pillar', () => {
    const r = applyAdminFilter(actions, { pillar: 'GOVERN' });
    assert.ok(r.ok);
    assert.ok(r.actions.every((a) => a.pillar === 'GOVERN'));
  });
  it('filters by minimum severity (critical only)', () => {
    const r = applyAdminFilter(actions, { severity: 'critical' });
    assert.ok(r.ok);
    assert.ok(r.actions.every((a) => a.severity === 'critical'));
  });
  it('filters by maximum effort', () => {
    const r = applyAdminFilter(actions, { effort: 'low' });
    assert.ok(r.ok);
    assert.ok(r.actions.every((a) => a.effort === 'low'));
  });
  it('combines pillar and severity filters', () => {
    const r = applyAdminFilter(actions, { pillar: 'GOVERN', severity: 'critical' });
    assert.ok(r.ok);
    assert.equal(r.actions.length, 1);
  });
  it('returns all actions when no filter', () => {
    const r = applyAdminFilter(actions, {});
    assert.ok(r.ok);
    assert.equal(r.actions.length, 3);
  });
  it('rejects unknown pillar', () => {
    assert.ok(!applyAdminFilter(actions, { pillar: 'UNKNOWN' }).ok);
  });
  it('rejects unknown severity', () => {
    assert.ok(!applyAdminFilter(actions, { severity: 'extreme' }).ok);
  });
  it('rejects non-array actions', () => {
    assert.ok(!applyAdminFilter(null).ok);
  });
});

describe('buildActionSummary', () => {
  const actions = [
    makeAction({ id: 'a', pillar: 'GOVERN', severity: 'critical', impact: 90 }),
    makeAction({ id: 'b', pillar: 'SECURE', severity: 'high', impact: 70 }),
    makeAction({ id: 'c', pillar: 'GOVERN', severity: 'medium', impact: 40 }),
  ];

  it('counts total actions', () => {
    const r = buildActionSummary(actions);
    assert.ok(r.ok);
    assert.equal(r.summary.total, 3);
  });
  it('counts by pillar', () => {
    const r = buildActionSummary(actions);
    assert.equal(r.summary.countByPillar.GOVERN, 2);
    assert.equal(r.summary.countByPillar.SECURE, 1);
  });
  it('counts by severity', () => {
    const r = buildActionSummary(actions);
    assert.equal(r.summary.countBySeverity.critical, 1);
    assert.equal(r.summary.countBySeverity.high, 1);
  });
  it('sums estimated total impact', () => {
    const r = buildActionSummary(actions);
    assert.equal(r.summary.estimatedTotalImpact, 200);
  });
  it('topAction is first action', () => {
    const r = buildActionSummary(actions);
    assert.equal(r.summary.topAction?.id, 'a');
  });
  it('topAction is null for empty list', () => {
    const r = buildActionSummary([]);
    assert.equal(r.summary.topAction, null);
  });
  it('rejects non-array input', () => {
    assert.ok(!buildActionSummary(null).ok);
  });
});
