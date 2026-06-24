import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyHealthBand,
  buildHealthScorecard,
  listScoreDrivers,
  buildScorecardDelta,
} from '../../src/optimize/reporting/tenant-health-scorecard.mjs';

const TENANT = 'tenant-health-test';

const FULL_INPUTS = {
  OBSERVE: { score: 80, positives: ['good coverage'], negatives: [] },
  GOVERN: { score: 70, positives: [], negatives: ['policy gaps'] },
  SECURE: { score: 60, positives: [], negatives: ['overshare risk', 'stale roles'] },
  OPTIMIZE: { score: 90, positives: ['high utilization'], negatives: [] },
};

describe('classifyHealthBand', () => {
  it('critical for 0–39', () => {
    assert.equal(classifyHealthBand(0), 'critical');
    assert.equal(classifyHealthBand(39), 'critical');
  });
  it('at-risk for 40–59', () => {
    assert.equal(classifyHealthBand(40), 'at-risk');
    assert.equal(classifyHealthBand(59), 'at-risk');
  });
  it('fair for 60–79', () => {
    assert.equal(classifyHealthBand(60), 'fair');
    assert.equal(classifyHealthBand(79), 'fair');
  });
  it('healthy for 80–100', () => {
    assert.equal(classifyHealthBand(80), 'healthy');
    assert.equal(classifyHealthBand(100), 'healthy');
  });
  it('clamps scores below 0 to critical', () => {
    assert.equal(classifyHealthBand(-10), 'critical');
  });
  it('clamps scores above 100 to healthy', () => {
    assert.equal(classifyHealthBand(150), 'healthy');
  });
});

describe('buildHealthScorecard', () => {
  it('builds a scorecard from full inputs', () => {
    const r = buildHealthScorecard(TENANT, FULL_INPUTS);
    assert.ok(r.ok);
    assert.equal(r.scorecard.tenantId, TENANT);
    assert.ok(typeof r.scorecard.overall === 'number');
    assert.ok(r.scorecard.overall >= 0 && r.scorecard.overall <= 100);
  });
  it('produces per-pillar scores', () => {
    const r = buildHealthScorecard(TENANT, FULL_INPUTS);
    for (const pillar of ['OBSERVE', 'GOVERN', 'SECURE', 'OPTIMIZE']) {
      assert.ok(pillar in r.scorecard.pillars);
      assert.ok(typeof r.scorecard.pillars[pillar].score === 'number');
      assert.ok(r.scorecard.pillars[pillar].band);
    }
  });
  it('computes weighted overall score', () => {
    // OBSERVE*0.2 + GOVERN*0.3 + SECURE*0.3 + OPTIMIZE*0.2 = 80*0.2+70*0.3+60*0.3+90*0.2 = 16+21+18+18 = 73
    const r = buildHealthScorecard(TENANT, FULL_INPUTS);
    assert.equal(r.scorecard.overall, 73);
  });
  it('defaults missing pillars to score 0', () => {
    const r = buildHealthScorecard(TENANT, { OBSERVE: { score: 100 } });
    assert.ok(r.ok);
    assert.equal(r.scorecard.pillars.GOVERN.score, 0);
  });
  it('defaults missing pillar data to score 0', () => {
    const r = buildHealthScorecard(TENANT, {});
    assert.equal(r.scorecard.overall, 0);
  });
  it('clamps pillar scores to 0–100', () => {
    const r = buildHealthScorecard(TENANT, { OBSERVE: { score: 150 }, GOVERN: { score: -10 }, SECURE: {}, OPTIMIZE: {} });
    assert.equal(r.scorecard.pillars.OBSERVE.score, 100);
    assert.equal(r.scorecard.pillars.GOVERN.score, 0);
  });
  it('preserves positives and negatives arrays', () => {
    const r = buildHealthScorecard(TENANT, FULL_INPUTS);
    assert.ok(r.scorecard.pillars.SECURE.negatives.includes('overshare risk'));
  });
  it('rejects missing tenantId', () => {
    const r = buildHealthScorecard('', FULL_INPUTS);
    assert.ok(!r.ok);
    assert.equal(r.code, 'invalid_input');
  });
  it('rejects non-object pillarInputs', () => {
    assert.ok(!buildHealthScorecard(TENANT, null).ok);
    assert.ok(!buildHealthScorecard(TENANT, []).ok);
  });
});

describe('listScoreDrivers', () => {
  it('returns topPositives and topNegatives', () => {
    const { scorecard } = buildHealthScorecard(TENANT, FULL_INPUTS);
    const drivers = listScoreDrivers(scorecard);
    assert.ok(Array.isArray(drivers.topPositives));
    assert.ok(Array.isArray(drivers.topNegatives));
  });
  it('limits to n drivers', () => {
    const { scorecard } = buildHealthScorecard(TENANT, FULL_INPUTS);
    const drivers = listScoreDrivers(scorecard, 1);
    assert.ok(drivers.topPositives.length <= 1);
  });
  it('each driver has pillar and text', () => {
    const { scorecard } = buildHealthScorecard(TENANT, FULL_INPUTS);
    const drivers = listScoreDrivers(scorecard);
    for (const d of [...drivers.topPositives, ...drivers.topNegatives]) {
      assert.ok(d.pillar);
      assert.ok(d.text);
    }
  });
  it('handles empty scorecard pillars gracefully', () => {
    const drivers = listScoreDrivers({ pillars: {} });
    assert.equal(drivers.topPositives.length, 0);
    assert.equal(drivers.topNegatives.length, 0);
  });
});

describe('buildScorecardDelta', () => {
  const current = buildHealthScorecard(TENANT, FULL_INPUTS).scorecard;
  const previous = buildHealthScorecard(TENANT, {
    OBSERVE: { score: 60 },
    GOVERN: { score: 50 },
    SECURE: { score: 40 },
    OPTIMIZE: { score: 70 },
  }).scorecard;

  it('builds a delta with trend', () => {
    const r = buildScorecardDelta(current, previous);
    assert.ok(r.ok);
    assert.ok(r.delta.trend);
    assert.ok(typeof r.delta.overallChange === 'number');
  });
  it('current > previous → improved', () => {
    const r = buildScorecardDelta(current, previous);
    assert.equal(r.delta.trend, 'improved');
  });
  it('equal scores → stable', () => {
    const r = buildScorecardDelta(current, current);
    assert.equal(r.delta.trend, 'stable');
  });
  it('produces per-pillar deltas', () => {
    const r = buildScorecardDelta(current, previous);
    for (const pillar of ['OBSERVE', 'GOVERN', 'SECURE', 'OPTIMIZE']) {
      assert.ok(pillar in r.delta.pillars);
      assert.ok('trend' in r.delta.pillars[pillar]);
    }
  });
  it('rejects mismatched tenantIds', () => {
    const other = buildHealthScorecard('other-tenant', FULL_INPUTS).scorecard;
    const r = buildScorecardDelta(current, other);
    assert.ok(!r.ok);
  });
  it('rejects missing tenantId in either scorecard', () => {
    assert.ok(!buildScorecardDelta({}, current).ok);
    assert.ok(!buildScorecardDelta(current, {}).ok);
  });
});
