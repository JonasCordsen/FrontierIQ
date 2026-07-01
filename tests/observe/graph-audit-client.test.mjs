import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  listSupportedWorkloads,
  isSupportedWorkload,
  buildAuditLogRequest,
  validateAuditLogResponse,
  classifyAuditEvent,
  checkAuditClientReadiness,
} from '../../src/observe/graph/audit-client.mjs';

const TENANT = 'tenant-xyz';

describe('listSupportedWorkloads', () => {
  it('returns at least 8 workloads', () => {
    assert.ok(listSupportedWorkloads().length >= 8);
  });
  it('includes Copilot and CopilotStudio', () => {
    const wl = listSupportedWorkloads();
    assert.ok(wl.includes('Copilot'));
    assert.ok(wl.includes('CopilotStudio'));
  });
  it('returns a new array each call', () => {
    assert.notEqual(listSupportedWorkloads(), listSupportedWorkloads());
  });
});

describe('isSupportedWorkload', () => {
  it('accepts known workloads', () => {
    assert.ok(isSupportedWorkload('SharePoint'));
    assert.ok(isSupportedWorkload('MicrosoftTeams'));
  });
  it('rejects unknown workloads', () => {
    assert.ok(!isSupportedWorkload('Jira'));
    assert.ok(!isSupportedWorkload(''));
    assert.ok(!isSupportedWorkload(null));
  });
});

describe('buildAuditLogRequest', () => {
  it('builds a request without filter', () => {
    const r = buildAuditLogRequest(TENANT);
    assert.ok(r.ok);
    assert.equal(r.request.method, 'GET');
    assert.ok(r.request.url.includes('auditLogs'));
    assert.equal(r.request.tenantId, TENANT);
  });
  it('applies workload filter', () => {
    const r = buildAuditLogRequest(TENANT, { workload: 'Copilot' });
    assert.ok(r.ok);
    assert.ok(r.request.params['$filter'].includes("Workload eq 'Copilot'"));
  });
  it('applies date range filter', () => {
    const r = buildAuditLogRequest(TENANT, { startDate: '2026-06-01', endDate: '2026-06-30' });
    assert.ok(r.ok);
    assert.ok(r.request.params['$filter'].includes('activityDateTime ge'));
    assert.ok(r.request.params['$filter'].includes('activityDateTime le'));
  });
  it('applies userId filter', () => {
    const r = buildAuditLogRequest(TENANT, { userId: 'alice@contoso.com' });
    assert.ok(r.ok);
    assert.ok(r.request.params['$filter'].includes('alice@contoso.com'));
  });
  it('combines multiple filters with and', () => {
    const r = buildAuditLogRequest(TENANT, { workload: 'SharePoint', userId: 'a@b.com' });
    assert.ok(r.request.params['$filter'].includes(' and '));
  });
  it('rejects missing tenantId', () => {
    const r = buildAuditLogRequest('');
    assert.ok(!r.ok);
    assert.equal(r.code, 'invalid_input');
  });
  it('rejects unsupported workload', () => {
    const r = buildAuditLogRequest(TENANT, { workload: 'Slack' });
    assert.ok(!r.ok);
    assert.ok(r.errors.some((e) => e.includes('workload')));
  });
  it('sets $top 1000 when no filter', () => {
    const r = buildAuditLogRequest(TENANT);
    assert.equal(r.request.params['$top'], 1000);
  });
});

describe('validateAuditLogResponse', () => {
  const validEvent = {
    Id: 'evt-001',
    CreationTime: '2026-06-01T10:00:00Z',
    Operation: 'FileShared',
    Workload: 'SharePoint',
    UserId: 'alice@contoso.com',
  };

  it('validates a well-formed payload', () => {
    const r = validateAuditLogResponse({ value: [validEvent] });
    assert.ok(r.ok);
    assert.equal(r.events.length, 1);
    assert.equal(r.events[0].id, 'evt-001');
  });
  it('enriches events with classification', () => {
    const r = validateAuditLogResponse({ value: [validEvent] });
    assert.ok(r.events[0].severity);
    assert.ok(r.events[0].pillar);
    assert.ok(r.events[0].category);
  });
  it('rejects non-object payload', () => {
    assert.equal(validateAuditLogResponse(null).code, 'invalid_payload');
    assert.equal(validateAuditLogResponse(42).code, 'invalid_payload');
  });
  it('rejects payload without value array', () => {
    assert.equal(validateAuditLogResponse({}).code, 'invalid_payload');
  });
  it('rejects events with missing required fields', () => {
    const r = validateAuditLogResponse({ value: [{ Id: 'x' }] });
    assert.ok(!r.ok);
    assert.equal(r.code, 'validation_error');
  });
  it('validates multiple events', () => {
    const r = validateAuditLogResponse({ value: [validEvent, { ...validEvent, Id: 'evt-002' }] });
    assert.ok(r.ok);
    assert.equal(r.events.length, 2);
  });
});

describe('classifyAuditEvent', () => {
  it('classifies PolicyViolation as GOVERN/high', () => {
    const c = classifyAuditEvent({ Operation: 'PolicyViolation', Workload: 'SharePoint' });
    assert.equal(c.pillar, 'GOVERN');
    assert.equal(c.severity, 'high');
    assert.equal(c.category, 'governance');
  });
  it('classifies OvershareDetected as SECURE/critical', () => {
    const c = classifyAuditEvent({ Operation: 'OvershareDetected', Workload: 'OneDrive' });
    assert.equal(c.pillar, 'SECURE');
    assert.equal(c.severity, 'critical');
  });
  it('classifies AgentInvoked with Copilot workload as agent-activity', () => {
    const c = classifyAuditEvent({ Operation: 'AgentInvoked', Workload: 'Copilot' });
    assert.equal(c.category, 'agent-activity');
    assert.equal(c.pillar, 'OBSERVE');
  });
  it('classifies FileShared as data-access/SECURE', () => {
    const c = classifyAuditEvent({ Operation: 'FileShared', Workload: 'SharePoint' });
    assert.equal(c.category, 'data-access');
    assert.equal(c.severity, 'medium');
  });
  it('defaults unknown operations to low/OBSERVE/general', () => {
    const c = classifyAuditEvent({ Operation: 'SomeNewOp', Workload: 'Exchange' });
    assert.equal(c.severity, 'low');
    assert.equal(c.pillar, 'OBSERVE');
    assert.equal(c.category, 'general');
  });
  it('handles missing operation gracefully', () => {
    const c = classifyAuditEvent({});
    assert.equal(c.severity, 'low');
  });
});

describe('checkAuditClientReadiness', () => {
  it('is ready when fully configured', () => {
    const r = checkAuditClientReadiness({ tenantId: TENANT, hasCredential: true, hasAuditPermission: true });
    assert.ok(r.ready);
    assert.equal(r.blockers.length, 0);
  });
  it('blocks when permission missing', () => {
    const r = checkAuditClientReadiness({ tenantId: TENANT, hasCredential: true, hasAuditPermission: false });
    assert.ok(!r.ready);
    assert.ok(r.blockers.some((b) => b.includes('AuditLog.Read.All')));
  });
  it('accumulates multiple blockers', () => {
    const r = checkAuditClientReadiness({ tenantId: '', hasCredential: false, hasAuditPermission: false });
    assert.equal(r.blockers.length, 3);
  });
});
