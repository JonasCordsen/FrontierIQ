import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDefaultThresholds,
  evaluateThresholds,
  classifyAlertSeverity,
  buildThresholdSummary,
} from '../../src/optimize/delivery/alert-threshold-engine.mjs';

describe('buildDefaultThresholds', () => {
  it('returns an array of threshold objects', () => {
    const t = buildDefaultThresholds();
    assert.ok(Array.isArray(t) && t.length >= 6);
  });
  it('each threshold has required fields', () => {
    for (const t of buildDefaultThresholds()) {
      assert.ok(t.id && t.metric && t.operator && typeof t.threshold === 'number' && t.severity);
    }
  });
  it('returns a new array each call', () => {
    assert.notEqual(buildDefaultThresholds(), buildDefaultThresholds());
  });
});

describe('evaluateThresholds', () => {
  const thresholds = buildDefaultThresholds();

  it('triggers alert when metric is below threshold', () => {
    const r = evaluateThresholds({ overallScore: 30 }, thresholds);
    assert.ok(r.ok);
    assert.ok(r.alerts.some((a) => a.metric === 'overallScore'));
  });
  it('does not alert when metric is above threshold', () => {
    const r = evaluateThresholds({ overallScore: 90 }, thresholds);
    assert.ok(r.ok);
    assert.ok(!r.alerts.some((a) => a.thresholdId === 'overall-health-critical'));
  });
  it('triggers overshare-rate-high when gt threshold', () => {
    const r = evaluateThresholds({ overshareRate: 0.1 }, thresholds);
    assert.ok(r.alerts.some((a) => a.thresholdId === 'overshare-rate-high'));
  });
  it('alert includes actual, delta, and threshold', () => {
    const r = evaluateThresholds({ overallScore: 20 }, thresholds);
    const alert = r.alerts.find((a) => a.thresholdId === 'overall-health-critical');
    assert.equal(alert.actual, 20);
    assert.equal(alert.threshold, 40);
    assert.ok(alert.delta > 0);
  });
  it('skips metrics not present in metrics object', () => {
    const r = evaluateThresholds({}, thresholds);
    assert.ok(r.ok);
    assert.equal(r.alerts.length, 0);
    assert.equal(r.evaluated, 0);
  });
  it('evaluates custom single threshold', () => {
    const custom = [{ id: 't1', metric: 'myMetric', operator: 'gt', threshold: 10, severity: 'high', description: 'x' }];
    const r = evaluateThresholds({ myMetric: 15 }, custom);
    assert.equal(r.alerts.length, 1);
    assert.equal(r.alerts[0].thresholdId, 't1');
  });
  it('rejects non-object metrics', () => {
    assert.ok(!evaluateThresholds(null, thresholds).ok);
    assert.ok(!evaluateThresholds([], thresholds).ok);
  });
  it('rejects non-array thresholds', () => {
    assert.ok(!evaluateThresholds({}, null).ok);
  });
  it('triggers compliance-gap-critical when criticalComplianceGaps > 0', () => {
    const r = evaluateThresholds({ criticalComplianceGaps: 2 }, thresholds);
    assert.ok(r.alerts.some((a) => a.thresholdId === 'compliance-gap-critical'));
  });
});

describe('classifyAlertSeverity', () => {
  it('returns base severity when delta ratio <= 0.5', () => {
    assert.equal(classifyAlertSeverity('medium', 4, 10), 'medium');
  });
  it('elevates by one band when delta ratio > 0.5', () => {
    assert.equal(classifyAlertSeverity('medium', 6, 10), 'high');
  });
  it('caps at critical', () => {
    assert.equal(classifyAlertSeverity('critical', 100, 1), 'critical');
  });
  it('handles zero threshold gracefully', () => {
    assert.equal(classifyAlertSeverity('high', 5, 0), 'high');
  });
  it('returns base severity for unknown base', () => {
    assert.equal(classifyAlertSeverity('extreme', 10, 5), 'extreme');
  });
});

describe('buildThresholdSummary', () => {
  const alerts = [
    { thresholdId: 'a', metric: 'overallScore', severity: 'critical', delta: 20 },
    { thresholdId: 'b', metric: 'overshareRate', severity: 'high', delta: 0.02 },
    { thresholdId: 'c', metric: 'licenseUtilization', severity: 'medium', delta: 0.1 },
  ];

  it('counts total alerts', () => {
    const r = buildThresholdSummary(alerts);
    assert.ok(r.ok);
    assert.equal(r.summary.total, 3);
  });
  it('counts by severity', () => {
    const r = buildThresholdSummary(alerts);
    assert.equal(r.summary.countBySeverity.critical, 1);
    assert.equal(r.summary.countBySeverity.high, 1);
    assert.equal(r.summary.countBySeverity.medium, 1);
  });
  it('requiresAction is true when critical or high present', () => {
    const r = buildThresholdSummary(alerts);
    assert.ok(r.summary.requiresAction);
  });
  it('requiresAction is false when only medium/low', () => {
    const r = buildThresholdSummary([{ severity: 'low', metric: 'x' }, { severity: 'medium', metric: 'y' }]);
    assert.ok(!r.summary.requiresAction);
  });
  it('mostCriticalMetric is the worst alert metric', () => {
    const r = buildThresholdSummary(alerts);
    assert.equal(r.summary.mostCriticalMetric, 'overallScore');
  });
  it('mostCriticalMetric is null for empty alerts', () => {
    const r = buildThresholdSummary([]);
    assert.equal(r.summary.mostCriticalMetric, null);
  });
  it('rejects non-array input', () => {
    assert.ok(!buildThresholdSummary(null).ok);
  });
});
