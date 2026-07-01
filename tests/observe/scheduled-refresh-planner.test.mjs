import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDefaultRefreshPolicy,
  buildRefreshSchedule,
  checkStaleness,
  listOverduePillars,
} from '../../src/observe/graph/scheduled-refresh-planner.mjs';

describe('buildDefaultRefreshPolicy', () => {
  it('returns intervalHours for all four pillars', () => {
    const p = buildDefaultRefreshPolicy();
    assert.ok('OBSERVE' in p.intervalHours);
    assert.ok('GOVERN' in p.intervalHours);
    assert.ok('SECURE' in p.intervalHours);
    assert.ok('OPTIMIZE' in p.intervalHours);
  });
  it('OBSERVE is 6h', () => assert.equal(buildDefaultRefreshPolicy().intervalHours.OBSERVE, 6));
  it('SECURE is 12h', () => assert.equal(buildDefaultRefreshPolicy().intervalHours.SECURE, 12));
});

describe('buildRefreshSchedule', () => {
  it('builds a schedule with nextRefreshAt per pillar', () => {
    const r = buildRefreshSchedule('tenant-x');
    assert.ok(r.ok);
    assert.equal(r.schedule.tenantId, 'tenant-x');
    for (const pillar of ['OBSERVE', 'GOVERN', 'SECURE', 'OPTIMIZE']) {
      assert.ok(r.schedule.pillars[pillar].nextRefreshAt);
      assert.ok(r.schedule.pillars[pillar].intervalHours > 0);
    }
  });
  it('nextRefreshAt is anchor + intervalHours', () => {
    const anchor = '1970-01-01T00:00:00.000Z';
    const r = buildRefreshSchedule('t', undefined, anchor);
    const obsNext = new Date(r.schedule.pillars.OBSERVE.nextRefreshAt).getTime();
    assert.equal(obsNext, 6 * 3600 * 1000);
  });
  it('accepts custom policy', () => {
    const custom = { intervalHours: { OBSERVE: 2, GOVERN: 2, SECURE: 2, OPTIMIZE: 2 } };
    const r = buildRefreshSchedule('t', custom);
    assert.equal(r.schedule.pillars.OBSERVE.intervalHours, 2);
  });
  it('rejects missing tenantId', () => {
    assert.ok(!buildRefreshSchedule('').ok);
    assert.ok(!buildRefreshSchedule(null).ok);
  });
});

describe('checkStaleness', () => {
  const anchor = '1970-01-01T00:00:00.000Z';
  const { schedule } = buildRefreshSchedule('t', undefined, anchor);

  it('fresh when lastRefreshedAt equals now', () => {
    const lastRefreshedAt = { OBSERVE: anchor, GOVERN: anchor, SECURE: anchor, OPTIMIZE: anchor };
    const r = checkStaleness(schedule, lastRefreshedAt, anchor);
    assert.ok(r.ok);
    assert.equal(r.staleness.OBSERVE.status, 'fresh');
  });
  it('stale when age is between 1x and 2x interval', () => {
    const staleTime = new Date(7 * 3600 * 1000).toISOString();
    const now = new Date(14 * 3600 * 1000).toISOString();
    const r = checkStaleness(schedule, { OBSERVE: staleTime, GOVERN: staleTime, SECURE: staleTime, OPTIMIZE: staleTime }, now);
    assert.equal(r.staleness.OBSERVE.status, 'stale');
  });
  it('overdue when age exceeds 2x interval', () => {
    const oldTime = new Date(0).toISOString();
    const now = new Date(100 * 3600 * 1000).toISOString();
    const r = checkStaleness(schedule, { OBSERVE: oldTime, GOVERN: oldTime, SECURE: oldTime, OPTIMIZE: oldTime }, now);
    assert.equal(r.staleness.OBSERVE.status, 'overdue');
  });
  it('overdue when lastRefreshedAt is null (fail-closed)', () => {
    const r = checkStaleness(schedule, { OBSERVE: null, GOVERN: null, SECURE: null, OPTIMIZE: null }, anchor);
    assert.equal(r.staleness.OBSERVE.status, 'overdue');
  });
  it('rejects invalid schedule', () => {
    assert.ok(!checkStaleness({}, {}, anchor).ok);
  });
  it('rejects non-object lastRefreshedAt', () => {
    assert.ok(!checkStaleness(schedule, null, anchor).ok);
  });
});

describe('listOverduePillars', () => {
  const anchor = '1970-01-01T00:00:00.000Z';
  const { schedule } = buildRefreshSchedule('t', undefined, anchor);

  it('returns overdue pillar names', () => {
    const now = new Date(100 * 3600 * 1000).toISOString();
    const overdue = listOverduePillars(schedule, { OBSERVE: anchor, GOVERN: anchor, SECURE: anchor, OPTIMIZE: anchor }, now);
    assert.ok(Array.isArray(overdue));
    assert.ok(overdue.includes('OBSERVE'));
  });
  it('returns empty when all fresh', () => {
    const overdue = listOverduePillars(schedule, { OBSERVE: anchor, GOVERN: anchor, SECURE: anchor, OPTIMIZE: anchor }, anchor);
    assert.equal(overdue.length, 0);
  });
  it('returns all when all null (fail-closed)', () => {
    const overdue = listOverduePillars(schedule, { OBSERVE: null, GOVERN: null, SECURE: null, OPTIMIZE: null }, anchor);
    assert.equal(overdue.length, 4);
  });
});
