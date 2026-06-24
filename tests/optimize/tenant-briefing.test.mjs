import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildHealthHeadline,
  buildRiskHighlights,
  buildComplianceAlert,
  buildTenantBriefing,
  buildBriefingSummary,
} from '../../src/optimize/delivery/tenant-briefing.mjs';

const TENANT = 'tenant-briefing-test';

const scorecard = {
  tenantId: TENANT,
  overall: 73,
  band: 'fair',
  pillars: {},
};

const flags = [
  { id: 'f1', severity: 'critical', description: 'Oversharing detected', pillar: 'SECURE', action: 'Review sharing policy' },
  { id: 'f2', severity: 'high', description: 'Policy gap in agent onboarding', pillar: 'GOVERN', action: 'Enable approval gates' },
  { id: 'f3', severity: 'medium', description: 'Low training completion rate', pillar: 'GOVERN' },
  { id: 'f4', severity: 'low', description: 'Stale usage data', pillar: 'OBSERVE' },
];

const actions = [
  { id: 'a1', title: 'Enable MFA', severity: 'high', impact: 80, pillar: 'SECURE' },
  { id: 'a2', title: 'Review RACI', severity: 'medium', impact: 50, pillar: 'GOVERN' },
  { id: 'a3', title: 'Refresh usage data', severity: 'low', impact: 20, pillar: 'OBSERVE' },
];

describe('buildHealthHeadline', () => {
  it('includes tenantId, band, and score', () => {
    const r = buildHealthHeadline(scorecard);
    assert.ok(r.ok);
    assert.ok(r.headline.includes(TENANT));
    assert.ok(r.headline.includes('73'));
    assert.ok(r.headline.includes('FAIR'));
  });
  it('appends improving trend when present', () => {
    const r = buildHealthHeadline({ ...scorecard, delta: { trend: 'improved' } });
    assert.ok(r.headline.includes('improving'));
  });
  it('appends regressing trend when present', () => {
    const r = buildHealthHeadline({ ...scorecard, delta: { trend: 'regressed' } });
    assert.ok(r.headline.includes('regressing'));
  });
  it('no trend appended for stable', () => {
    const r = buildHealthHeadline({ ...scorecard, delta: { trend: 'stable' } });
    assert.ok(!r.headline.includes('improving') && !r.headline.includes('regressing'));
  });
  it('rejects scorecard without tenantId', () => {
    assert.ok(!buildHealthHeadline({ overall: 50 }).ok);
  });
  it('rejects scorecard without numeric overall', () => {
    assert.ok(!buildHealthHeadline({ tenantId: TENANT }).ok);
  });
});

describe('buildRiskHighlights', () => {
  it('returns top 3 by severity', () => {
    const r = buildRiskHighlights(flags);
    assert.ok(r.ok);
    assert.equal(r.highlights.length, 3);
    assert.equal(r.highlights[0].severity, 'critical');
    assert.equal(r.highlights[1].severity, 'high');
  });
  it('respects n parameter', () => {
    const r = buildRiskHighlights(flags, 1);
    assert.equal(r.highlights.length, 1);
    assert.equal(r.highlights[0].severity, 'critical');
  });
  it('returns empty array when no flags', () => {
    const r = buildRiskHighlights([]);
    assert.ok(r.ok);
    assert.equal(r.highlights.length, 0);
  });
  it('rejects non-array input', () => {
    assert.ok(!buildRiskHighlights(null).ok);
  });
});

describe('buildComplianceAlert', () => {
  it('returns critical and high alerts', () => {
    const r = buildComplianceAlert(flags);
    assert.ok(r.ok);
    assert.equal(r.alerts.length, 2);
  });
  it('requiresImmediateAction is true when critical present', () => {
    const r = buildComplianceAlert(flags);
    assert.ok(r.requiresImmediateAction);
  });
  it('requiresImmediateAction is false when no critical', () => {
    const r = buildComplianceAlert([{ id: 'x', severity: 'high', description: 'gap', pillar: 'GOVERN' }]);
    assert.ok(!r.requiresImmediateAction);
  });
  it('returns empty alerts when all flags are low/medium', () => {
    const r = buildComplianceAlert([{ id: 'x', severity: 'low', description: 'minor', pillar: 'OBSERVE' }]);
    assert.equal(r.alerts.length, 0);
    assert.ok(!r.requiresImmediateAction);
  });
  it('rejects non-array input', () => {
    assert.ok(!buildComplianceAlert(null).ok);
  });
});

describe('buildTenantBriefing', () => {
  it('builds a complete briefing payload', () => {
    const r = buildTenantBriefing({ tenantId: TENANT, scorecard, actions, flags });
    assert.ok(r.ok);
    assert.equal(r.briefing.tenantId, TENANT);
    assert.ok(r.briefing.headline);
    assert.ok(Array.isArray(r.briefing.topActions));
    assert.ok(Array.isArray(r.briefing.riskHighlights));
    assert.ok(Array.isArray(r.briefing.complianceAlerts));
    assert.ok(typeof r.briefing.requiresImmediateAction === 'boolean');
  });
  it('limits topActions to 5', () => {
    const manyActions = Array.from({ length: 10 }, (_, i) => ({ id: `a${i}`, title: `Action ${i}` }));
    const r = buildTenantBriefing({ tenantId: TENANT, scorecard, actions: manyActions, flags: [] });
    assert.ok(r.briefing.topActions.length <= 5);
  });
  it('requiresImmediateAction true when critical flag present', () => {
    const r = buildTenantBriefing({ tenantId: TENANT, scorecard, actions, flags });
    assert.ok(r.briefing.requiresImmediateAction);
  });
  it('rejects missing tenantId', () => {
    assert.ok(!buildTenantBriefing({ scorecard, actions, flags }).ok);
  });
  it('rejects missing scorecard', () => {
    assert.ok(!buildTenantBriefing({ tenantId: TENANT, actions, flags }).ok);
  });
  it('rejects non-array actions', () => {
    assert.ok(!buildTenantBriefing({ tenantId: TENANT, scorecard, actions: null, flags }).ok);
  });
  it('rejects non-array flags', () => {
    assert.ok(!buildTenantBriefing({ tenantId: TENANT, scorecard, actions, flags: null }).ok);
  });
  it('accumulates all validation errors', () => {
    const r = buildTenantBriefing({});
    assert.ok(!r.ok);
    assert.ok(r.errors.length >= 3);
  });
});

describe('buildBriefingSummary', () => {
  it('produces a compact string summary', () => {
    const { briefing } = buildTenantBriefing({ tenantId: TENANT, scorecard, actions, flags });
    const r = buildBriefingSummary(briefing);
    assert.ok(r.ok);
    assert.ok(typeof r.summary === 'string');
    assert.ok(r.summary.length > 0);
  });
  it('includes action count', () => {
    const { briefing } = buildTenantBriefing({ tenantId: TENANT, scorecard, actions, flags });
    const r = buildBriefingSummary(briefing);
    assert.ok(r.summary.includes('coach action'));
  });
  it('includes compliance alert count when present', () => {
    const { briefing } = buildTenantBriefing({ tenantId: TENANT, scorecard, actions, flags });
    const r = buildBriefingSummary(briefing);
    assert.ok(r.summary.includes('compliance alert'));
  });
  it('includes IMMEDIATE ACTION marker when required', () => {
    const { briefing } = buildTenantBriefing({ tenantId: TENANT, scorecard, actions, flags });
    const r = buildBriefingSummary(briefing);
    assert.ok(r.summary.includes('IMMEDIATE ACTION'));
  });
  it('no IMMEDIATE ACTION when no critical flags', () => {
    const { briefing } = buildTenantBriefing({ tenantId: TENANT, scorecard, actions: [], flags: [] });
    const r = buildBriefingSummary(briefing);
    assert.ok(!r.summary.includes('IMMEDIATE ACTION'));
  });
  it('rejects briefing without tenantId', () => {
    assert.ok(!buildBriefingSummary({}).ok);
  });
});
