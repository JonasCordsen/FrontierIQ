/**
 * Onboarding assessment — first-run tenant baseline posture assessment.
 *
 * Deterministic contracts for establishing a tenant's initial posture baseline
 * across all four pillars. Fail-closed: any critical gap → blocked.
 *
 * Pillar: GOVERN
 */

// ---------------------------------------------------------------------------
// Checklist
// ---------------------------------------------------------------------------

const CHECKLIST_STEPS = Object.freeze([
  { id: 'entra-app-registered', pillar: 'GOVERN', title: 'Entra app registration present', criticality: 'critical' },
  { id: 'permissions-granted', pillar: 'GOVERN', title: 'Required Graph permissions granted', criticality: 'critical' },
  { id: 'keyvault-configured', pillar: 'SECURE', title: 'Key Vault configured for secrets', criticality: 'critical' },
  { id: 'mfa-enabled', pillar: 'SECURE', title: 'MFA enabled for agent principals', criticality: 'high' },
  { id: 'baseline-policy-applied', pillar: 'GOVERN', title: 'Baseline governance policy applied', criticality: 'high' },
  { id: 'coe-owner-assigned', pillar: 'GOVERN', title: 'CoE owner role assigned', criticality: 'medium' },
  { id: 'audit-log-retention', pillar: 'SECURE', title: 'Audit log retention configured', criticality: 'high' },
  { id: 'license-inventory', pillar: 'OPTIMIZE', title: 'License inventory baseline captured', criticality: 'medium' },
  { id: 'data-residency-confirmed', pillar: 'SECURE', title: 'Data residency region confirmed', criticality: 'high' },
  { id: 'initial-usage-pull', pillar: 'OBSERVE', title: 'Initial usage data pull succeeded', criticality: 'medium' },
]);

/**
 * @param {string} tenantId
 * @returns {{ ok: true, checklist: object[] } | { ok: false, code: string, errors: string[] }}
 */
export function buildAssessmentChecklist(tenantId) {
  if (!tenantId || typeof tenantId !== 'string') {
    return { ok: false, code: 'invalid_input', errors: ['tenantId is required'] };
  }
  return {
    ok: true,
    checklist: CHECKLIST_STEPS.map((s) => ({ ...s, tenantId, result: 'pending' })),
  };
}

// ---------------------------------------------------------------------------
// Step evaluator
// ---------------------------------------------------------------------------

/**
 * Evaluate a single assessment step against supplied evidence.
 *
 * @param {{ id: string, criticality: string }} step
 * @param {{ passed: boolean, notes?: string }} evidence
 * @returns {{ ok: true, result: object } | { ok: false, code: string, errors: string[] }}
 */
export function evaluateAssessmentStep(step, evidence) {
  if (!step?.id) return { ok: false, code: 'invalid_input', errors: ['step.id is required'] };
  if (!evidence || typeof evidence.passed !== 'boolean') {
    return { ok: false, code: 'invalid_input', errors: ['evidence.passed (boolean) is required'] };
  }

  const result = evidence.passed ? 'pass' : step.criticality === 'critical' ? 'fail' : 'partial';

  return {
    ok: true,
    result: {
      stepId: step.id,
      criticality: step.criticality,
      result,
      notes: evidence.notes ?? null,
    },
  };
}

// ---------------------------------------------------------------------------
// Baseline posture
// ---------------------------------------------------------------------------

/**
 * Build baseline posture from step evaluation results.
 *
 * @param {string}   tenantId
 * @param {object[]} stepResults  - from evaluateAssessmentStep
 * @returns {{ ok: true, posture: object } | { ok: false, code: string, errors: string[] }}
 */
export function buildBaselinePosture(tenantId, stepResults) {
  if (!tenantId) return { ok: false, code: 'invalid_input', errors: ['tenantId is required'] };
  if (!Array.isArray(stepResults)) return { ok: false, code: 'invalid_input', errors: ['stepResults must be an array'] };

  const gaps = stepResults.filter((r) => r.result === 'fail' || r.result === 'partial');
  const criticalGaps = gaps.filter((r) => r.criticality === 'critical' && r.result === 'fail');
  const passCount = stepResults.filter((r) => r.result === 'pass').length;
  const baselineScore = stepResults.length > 0
    ? Math.round((passCount / stepResults.length) * 100)
    : 0;

  return {
    ok: true,
    posture: {
      tenantId,
      baselineScore,
      passCount,
      failCount: stepResults.filter((r) => r.result === 'fail').length,
      partialCount: stepResults.filter((r) => r.result === 'partial').length,
      gaps,
      criticalGapCount: criticalGaps.length,
      readiness: classifyOnboardingReadiness({ criticalGapCount: criticalGaps.length, baselineScore }),
    },
  };
}

// ---------------------------------------------------------------------------
// Readiness classifier
// ---------------------------------------------------------------------------

/**
 * Classify onboarding readiness from a posture summary.
 * Fail-closed: any critical gap → blocked.
 *
 * @param {{ criticalGapCount: number, baselineScore: number }} posture
 * @returns {'ready' | 'partial' | 'blocked'}
 */
export function classifyOnboardingReadiness(posture) {
  if ((posture?.criticalGapCount ?? 1) > 0) return 'blocked';
  if ((posture?.baselineScore ?? 0) >= 80) return 'ready';
  return 'partial';
}
