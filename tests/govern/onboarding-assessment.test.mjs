import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAssessmentChecklist,
  evaluateAssessmentStep,
  buildBaselinePosture,
  classifyOnboardingReadiness,
} from '../../src/govern/onboarding/onboarding-assessment.mjs';

const TENANT = 'tenant-onboarding-test';

describe('buildAssessmentChecklist', () => {
  it('returns checklist with 10 steps', () => {
    const r = buildAssessmentChecklist(TENANT);
    assert.ok(r.ok);
    assert.equal(r.checklist.length, 10);
  });
  it('all steps have required fields', () => {
    const { checklist } = buildAssessmentChecklist(TENANT);
    for (const s of checklist) {
      assert.ok(s.id && s.pillar && s.title && s.criticality && s.tenantId);
    }
  });
  it('all steps start as pending', () => {
    const { checklist } = buildAssessmentChecklist(TENANT);
    assert.ok(checklist.every((s) => s.result === 'pending'));
  });
  it('covers all four pillars', () => {
    const { checklist } = buildAssessmentChecklist(TENANT);
    const pillars = new Set(checklist.map((s) => s.pillar));
    assert.ok(pillars.has('OBSERVE') && pillars.has('GOVERN') && pillars.has('SECURE') && pillars.has('OPTIMIZE'));
  });
  it('rejects missing tenantId', () => {
    assert.ok(!buildAssessmentChecklist('').ok);
    assert.ok(!buildAssessmentChecklist(null).ok);
  });
});

describe('evaluateAssessmentStep', () => {
  const step = { id: 'entra-app-registered', criticality: 'critical' };

  it('pass when evidence.passed=true', () => {
    const r = evaluateAssessmentStep(step, { passed: true });
    assert.ok(r.ok);
    assert.equal(r.result.result, 'pass');
  });
  it('fail (not partial) for critical step that did not pass', () => {
    const r = evaluateAssessmentStep(step, { passed: false });
    assert.ok(r.ok);
    assert.equal(r.result.result, 'fail');
  });
  it('partial for non-critical step that did not pass', () => {
    const r = evaluateAssessmentStep({ id: 'coe-owner-assigned', criticality: 'medium' }, { passed: false });
    assert.equal(r.result.result, 'partial');
  });
  it('includes notes in result', () => {
    const r = evaluateAssessmentStep(step, { passed: true, notes: 'Verified in portal' });
    assert.equal(r.result.notes, 'Verified in portal');
  });
  it('rejects step without id', () => {
    assert.ok(!evaluateAssessmentStep({}, { passed: true }).ok);
  });
  it('rejects evidence without passed boolean', () => {
    assert.ok(!evaluateAssessmentStep(step, { notes: 'x' }).ok);
    assert.ok(!evaluateAssessmentStep(step, null).ok);
  });
});

describe('buildBaselinePosture', () => {
  const allPass = Array.from({ length: 10 }, (_, i) => ({
    stepId: `step-${i}`, criticality: 'medium', result: 'pass',
  }));
  const withCriticalFail = [
    ...allPass.slice(0, 8),
    { stepId: 'entra-app-registered', criticality: 'critical', result: 'fail' },
    { stepId: 'permissions-granted', criticality: 'critical', result: 'fail' },
  ];

  it('produces baseline posture with score', () => {
    const r = buildBaselinePosture(TENANT, allPass);
    assert.ok(r.ok);
    assert.equal(r.posture.baselineScore, 100);
    assert.equal(r.posture.passCount, 10);
  });
  it('blocked when critical gaps present', () => {
    const r = buildBaselinePosture(TENANT, withCriticalFail);
    assert.equal(r.posture.readiness, 'blocked');
    assert.equal(r.posture.criticalGapCount, 2);
  });
  it('partial when score is below 80 with no critical gaps', () => {
    const mixed = [
      ...Array.from({ length: 5 }, (_, i) => ({ stepId: `s${i}`, criticality: 'medium', result: 'pass' })),
      ...Array.from({ length: 5 }, (_, i) => ({ stepId: `f${i}`, criticality: 'medium', result: 'partial' })),
    ];
    const r = buildBaselinePosture(TENANT, mixed);
    assert.equal(r.posture.readiness, 'partial');
  });
  it('ready when score >= 80 and no critical gaps', () => {
    const r = buildBaselinePosture(TENANT, allPass);
    assert.equal(r.posture.readiness, 'ready');
  });
  it('lists gaps', () => {
    const r = buildBaselinePosture(TENANT, withCriticalFail);
    assert.ok(r.posture.gaps.length > 0);
  });
  it('rejects missing tenantId', () => {
    assert.ok(!buildBaselinePosture('', allPass).ok);
  });
  it('rejects non-array stepResults', () => {
    assert.ok(!buildBaselinePosture(TENANT, null).ok);
  });
});

describe('classifyOnboardingReadiness', () => {
  it('blocked when criticalGapCount > 0', () => {
    assert.equal(classifyOnboardingReadiness({ criticalGapCount: 1, baselineScore: 90 }), 'blocked');
  });
  it('ready when score >= 80 and no critical gaps', () => {
    assert.equal(classifyOnboardingReadiness({ criticalGapCount: 0, baselineScore: 85 }), 'ready');
  });
  it('partial when score < 80 and no critical gaps', () => {
    assert.equal(classifyOnboardingReadiness({ criticalGapCount: 0, baselineScore: 70 }), 'partial');
  });
  it('blocked by default when posture missing', () => {
    assert.equal(classifyOnboardingReadiness(null), 'blocked');
  });
});
