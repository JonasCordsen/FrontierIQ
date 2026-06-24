/**
 * Remediation tracker — coach action acknowledgment and resolution lifecycle.
 *
 * Tracks the lifecycle of coach actions from open → acknowledged → resolved → verified.
 * Fail-closed: evidence is required to verify resolution.
 *
 * Pillar: OPTIMIZE
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_STATUSES = Object.freeze(['open', 'acknowledged', 'resolved', 'verified']);
const STATUS_TRANSITIONS = Object.freeze({
  open: ['acknowledged'],
  acknowledged: ['resolved', 'open'],
  resolved: ['verified', 'acknowledged'],
  verified: [],
});

const OVERDUE_THRESHOLDS_HOURS = Object.freeze({ open: 72, acknowledged: 168, resolved: 48 });

// ---------------------------------------------------------------------------
// Record creator
// ---------------------------------------------------------------------------

/**
 * Create a new remediation record for a coach action.
 *
 * @param {{ id: string, title: string, severity: string, pillar: string }} action
 * @param {string} [createdAt]  - ISO timestamp; defaults to deterministic sentinel
 * @returns {{ ok: true, record: object } | { ok: false, code: string, errors: string[] }}
 */
export function createRemediationRecord(action, createdAt = new Date(0).toISOString()) {
  if (!action?.id || !action?.title) {
    return { ok: false, code: 'invalid_input', errors: ['action.id and action.title are required'] };
  }

  return {
    ok: true,
    record: {
      actionId: action.id,
      title: action.title,
      severity: action.severity ?? 'medium',
      pillar: action.pillar ?? 'OBSERVE',
      status: 'open',
      assignee: null,
      evidence: null,
      createdAt,
      acknowledgedAt: null,
      resolvedAt: null,
      verifiedAt: null,
    },
  };
}

// ---------------------------------------------------------------------------
// State transitions
// ---------------------------------------------------------------------------

function canTransition(record, targetStatus) {
  return STATUS_TRANSITIONS[record.status]?.includes(targetStatus) ?? false;
}

/**
 * Acknowledge a remediation record, assigning it to an owner.
 *
 * @param {object} record
 * @param {string} assignee
 * @param {string} [at]
 * @returns {{ ok: true, record: object } | { ok: false, code: string, errors: string[] }}
 */
export function acknowledgeAction(record, assignee, at = new Date(0).toISOString()) {
  if (!record?.actionId) return { ok: false, code: 'invalid_input', errors: ['record.actionId is required'] };
  if (!assignee) return { ok: false, code: 'invalid_input', errors: ['assignee is required'] };
  if (!canTransition(record, 'acknowledged')) {
    return { ok: false, code: 'invalid_transition', errors: [`cannot acknowledge from status '${record.status}'`] };
  }
  return { ok: true, record: { ...record, status: 'acknowledged', assignee, acknowledgedAt: at } };
}

/**
 * Mark a remediation record as resolved with supporting evidence.
 *
 * @param {object} record
 * @param {string} evidence  - reference to evidence artifact
 * @param {string} [at]
 * @returns {{ ok: true, record: object } | { ok: false, code: string, errors: string[] }}
 */
export function resolveAction(record, evidence, at = new Date(0).toISOString()) {
  if (!record?.actionId) return { ok: false, code: 'invalid_input', errors: ['record.actionId is required'] };
  if (!evidence) return { ok: false, code: 'invalid_input', errors: ['evidence is required to resolve'] };
  if (!canTransition(record, 'resolved')) {
    return { ok: false, code: 'invalid_transition', errors: [`cannot resolve from status '${record.status}'`] };
  }
  return { ok: true, record: { ...record, status: 'resolved', evidence, resolvedAt: at } };
}

/**
 * Verify that a resolved action's evidence is sufficient. Fail-closed: evidence required.
 *
 * @param {object} record
 * @param {string} [at]
 * @returns {{ ok: true, record: object } | { ok: false, code: string, errors: string[] }}
 */
export function verifyResolution(record, at = new Date(0).toISOString()) {
  if (!record?.actionId) return { ok: false, code: 'invalid_input', errors: ['record.actionId is required'] };
  if (!canTransition(record, 'verified')) {
    return { ok: false, code: 'invalid_transition', errors: [`cannot verify from status '${record.status}'`] };
  }
  if (!record.evidence) return { ok: false, code: 'missing_evidence', errors: ['evidence is required before verification'] };
  return { ok: true, record: { ...record, status: 'verified', verifiedAt: at } };
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

/**
 * Build a remediation summary from a list of records.
 *
 * @param {object[]} records
 * @param {string}   [now]   - ISO timestamp for overdue calculation; defaults to sentinel
 * @returns {{ ok: true, summary: object } | { ok: false, code: string, errors: string[] }}
 */
export function buildRemediationSummary(records, now = new Date(0).toISOString()) {
  if (!Array.isArray(records)) {
    return { ok: false, code: 'invalid_input', errors: ['records must be an array'] };
  }

  const countByStatus = {};
  const overdue = [];
  const resolveDurations = [];

  const nowMs = new Date(now).getTime();

  for (const r of records) {
    const s = r.status ?? 'open';
    countByStatus[s] = (countByStatus[s] ?? 0) + 1;

    const overdueThresholdHours = OVERDUE_THRESHOLDS_HOURS[s];
    if (overdueThresholdHours !== undefined) {
      const refAt = r.acknowledgedAt ?? r.resolvedAt ?? r.createdAt;
      if (refAt) {
        const ageHours = (nowMs - new Date(refAt).getTime()) / 3600000;
        if (ageHours > overdueThresholdHours) {
          overdue.push({ actionId: r.actionId, status: s, ageHours: Math.round(ageHours) });
        }
      }
    }

    if (r.status === 'verified' && r.createdAt && r.verifiedAt) {
      const ms = new Date(r.verifiedAt).getTime() - new Date(r.createdAt).getTime();
      resolveDurations.push(ms / 3600000);
    }
  }

  const meanTimeToResolveHours = resolveDurations.length > 0
    ? Math.round(resolveDurations.reduce((a, b) => a + b, 0) / resolveDurations.length)
    : null;

  return {
    ok: true,
    summary: {
      total: records.length,
      countByStatus,
      overdueCount: overdue.length,
      overdue,
      meanTimeToResolveHours,
    },
  };
}
