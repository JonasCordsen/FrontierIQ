import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createRemediationRecord,
  acknowledgeAction,
  resolveAction,
  verifyResolution,
  buildRemediationSummary,
} from '../../src/optimize/delivery/remediation-tracker.mjs';

const ACTION = { id: 'act-001', title: 'Enable MFA', severity: 'high', pillar: 'SECURE' };

describe('createRemediationRecord', () => {
  it('creates a record with status=open', () => {
    const r = createRemediationRecord(ACTION);
    assert.ok(r.ok);
    assert.equal(r.record.status, 'open');
    assert.equal(r.record.actionId, 'act-001');
  });
  it('sets all timestamp fields to null initially', () => {
    const r = createRemediationRecord(ACTION);
    assert.equal(r.record.acknowledgedAt, null);
    assert.equal(r.record.resolvedAt, null);
    assert.equal(r.record.verifiedAt, null);
  });
  it('defaults severity and pillar when not provided', () => {
    const r = createRemediationRecord({ id: 'x', title: 'Test' });
    assert.ok(r.record.severity);
    assert.ok(r.record.pillar);
  });
  it('rejects action without id', () => {
    assert.ok(!createRemediationRecord({ title: 'Test' }).ok);
  });
  it('rejects action without title', () => {
    assert.ok(!createRemediationRecord({ id: 'x' }).ok);
  });
  it('rejects null action', () => {
    assert.ok(!createRemediationRecord(null).ok);
  });
});

describe('acknowledgeAction', () => {
  const { record } = createRemediationRecord(ACTION);

  it('transitions open → acknowledged', () => {
    const r = acknowledgeAction(record, 'alice@contoso.com');
    assert.ok(r.ok);
    assert.equal(r.record.status, 'acknowledged');
    assert.equal(r.record.assignee, 'alice@contoso.com');
  });
  it('sets acknowledgedAt', () => {
    const r = acknowledgeAction(record, 'alice@contoso.com', '2026-06-01T10:00:00Z');
    assert.equal(r.record.acknowledgedAt, '2026-06-01T10:00:00Z');
  });
  it('rejects transition from acknowledged', () => {
    const acked = acknowledgeAction(record, 'alice@contoso.com').record;
    const r = acknowledgeAction(acked, 'bob@contoso.com');
    assert.ok(!r.ok);
    assert.equal(r.code, 'invalid_transition');
  });
  it('rejects missing assignee', () => {
    assert.ok(!acknowledgeAction(record, '').ok);
  });
  it('rejects missing record', () => {
    assert.ok(!acknowledgeAction(null, 'alice@contoso.com').ok);
  });
});

describe('resolveAction', () => {
  const { record } = createRemediationRecord(ACTION);
  const acked = acknowledgeAction(record, 'alice@contoso.com').record;

  it('transitions acknowledged → resolved', () => {
    const r = resolveAction(acked, 'evidence-ref-001');
    assert.ok(r.ok);
    assert.equal(r.record.status, 'resolved');
    assert.equal(r.record.evidence, 'evidence-ref-001');
  });
  it('rejects resolving from open (must acknowledge first)', () => {
    const r = resolveAction(record, 'evidence-ref-001');
    assert.ok(!r.ok);
    assert.equal(r.code, 'invalid_transition');
  });
  it('rejects empty evidence string', () => {
    const r = resolveAction(acked, '');
    assert.ok(!r.ok);
    assert.ok(r.errors.some((e) => e.includes('evidence')));
  });
  it('rejects missing record', () => {
    assert.ok(!resolveAction(null, 'evidence').ok);
  });
});

describe('verifyResolution', () => {
  const { record } = createRemediationRecord(ACTION);
  const acked = acknowledgeAction(record, 'alice@contoso.com').record;
  const resolved = resolveAction(acked, 'evidence-ref-001').record;

  it('transitions resolved → verified', () => {
    const r = verifyResolution(resolved);
    assert.ok(r.ok);
    assert.equal(r.record.status, 'verified');
  });
  it('sets verifiedAt', () => {
    const r = verifyResolution(resolved, '2026-06-10T12:00:00Z');
    assert.equal(r.record.verifiedAt, '2026-06-10T12:00:00Z');
  });
  it('rejects verification without evidence', () => {
    const noEvidence = { ...resolved, evidence: null };
    const r = verifyResolution(noEvidence);
    assert.ok(!r.ok);
    assert.equal(r.code, 'missing_evidence');
  });
  it('rejects verification from open status', () => {
    const r = verifyResolution(record);
    assert.ok(!r.ok);
    assert.equal(r.code, 'invalid_transition');
  });
  it('rejects verified again (terminal state)', () => {
    const verified = verifyResolution(resolved).record;
    const r = verifyResolution(verified);
    assert.ok(!r.ok);
  });
});

describe('buildRemediationSummary', () => {
  const { record: r1 } = createRemediationRecord(ACTION);
  const { record: r2 } = createRemediationRecord({ id: 'act-002', title: 'Review RACI', severity: 'medium', pillar: 'GOVERN' });
  const acked = acknowledgeAction(r2, 'bob@contoso.com').record;

  it('counts records by status', () => {
    const r = buildRemediationSummary([r1, acked]);
    assert.ok(r.ok);
    assert.equal(r.summary.countByStatus.open, 1);
    assert.equal(r.summary.countByStatus.acknowledged, 1);
    assert.equal(r.summary.total, 2);
  });
  it('meanTimeToResolveHours is null when no verified records', () => {
    const r = buildRemediationSummary([r1]);
    assert.equal(r.summary.meanTimeToResolveHours, null);
  });
  it('overdueCount is 0 when now equals createdAt (sentinel)', () => {
    const r = buildRemediationSummary([r1]);
    assert.equal(r.summary.overdueCount, 0);
  });
  it('rejects non-array records', () => {
    assert.ok(!buildRemediationSummary(null).ok);
  });
  it('handles empty records', () => {
    const r = buildRemediationSummary([]);
    assert.equal(r.summary.total, 0);
    assert.equal(r.summary.overdueCount, 0);
  });
});
