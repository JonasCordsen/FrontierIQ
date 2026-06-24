import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  listSupportedPeriods,
  isSupportedPeriod,
  buildUsageDetailRequest,
  buildUserCountSummaryRequest,
  validateUsageDetailResponse,
  validateUserCountSummaryResponse,
  checkClientReadiness,
} from '../../src/observe/graph/reports-client.mjs';

const TENANT = 'tenant-abc';

describe('listSupportedPeriods', () => {
  it('returns four period codes', () => {
    const periods = listSupportedPeriods();
    assert.deepEqual(periods, ['D7', 'D30', 'D90', 'D180']);
  });
  it('returns a new array each call', () => {
    assert.notEqual(listSupportedPeriods(), listSupportedPeriods());
  });
});

describe('isSupportedPeriod', () => {
  it('accepts valid periods', () => {
    for (const p of ['D7', 'D30', 'D90', 'D180']) assert.ok(isSupportedPeriod(p));
  });
  it('rejects unknown periods', () => {
    assert.ok(!isSupportedPeriod('D14'));
    assert.ok(!isSupportedPeriod(''));
    assert.ok(!isSupportedPeriod(null));
  });
});

describe('buildUsageDetailRequest', () => {
  it('builds a valid request descriptor', () => {
    const result = buildUsageDetailRequest(TENANT, 'D30');
    assert.ok(result.ok);
    assert.equal(result.request.method, 'GET');
    assert.ok(result.request.url.includes("period='D30'"));
    assert.equal(result.request.tenantId, TENANT);
    assert.equal(result.request.period, 'D30');
    assert.ok(result.request.headers['X-FrontierIQ-TenantId']);
  });
  it('defaults to JSON format', () => {
    const { request } = buildUsageDetailRequest(TENANT, 'D7');
    assert.equal(request.headers['Accept'], 'application/json');
  });
  it('accepts CSV format override', () => {
    const { request } = buildUsageDetailRequest(TENANT, 'D7', { format: 'CSV' });
    assert.equal(request.headers['Accept'], 'text/csv');
  });
  it('rejects missing tenantId', () => {
    const r = buildUsageDetailRequest('', 'D7');
    assert.ok(!r.ok);
    assert.equal(r.code, 'invalid_input');
  });
  it('rejects unsupported period', () => {
    const r = buildUsageDetailRequest(TENANT, 'D14');
    assert.ok(!r.ok);
    assert.ok(r.errors.some((e) => e.includes('period')));
  });
  it('rejects both missing tenantId and bad period', () => {
    const r = buildUsageDetailRequest('', 'bad');
    assert.ok(!r.ok);
    assert.equal(r.errors.length, 2);
  });
});

describe('buildUserCountSummaryRequest', () => {
  it('builds a valid request descriptor', () => {
    const result = buildUserCountSummaryRequest(TENANT, 'D90');
    assert.ok(result.ok);
    assert.ok(result.request.url.includes("period='D90'"));
    assert.equal(result.request.tenantId, TENANT);
  });
  it('rejects missing tenantId', () => {
    assert.ok(!buildUserCountSummaryRequest(null, 'D30').ok);
  });
  it('rejects bad period', () => {
    assert.ok(!buildUserCountSummaryRequest(TENANT, 'monthly').ok);
  });
});

describe('validateUsageDetailResponse', () => {
  const validRecord = {
    reportRefreshDate: '2026-06-01',
    userPrincipalName: 'user@contoso.com',
    displayName: 'Alice',
    lastActivityDate: '2026-05-30',
    copilotActivityCount: 12,
  };

  it('validates a well-formed payload', () => {
    const result = validateUsageDetailResponse({ value: [validRecord] });
    assert.ok(result.ok);
    assert.equal(result.records.length, 1);
    assert.equal(result.records[0].copilotActivityCount, 12);
  });
  it('coerces copilotActivityCount to number', () => {
    const r = validateUsageDetailResponse({ value: [{ ...validRecord, copilotActivityCount: '5' }] });
    assert.ok(r.ok);
    assert.equal(typeof r.records[0].copilotActivityCount, 'number');
  });
  it('defaults assignedProducts to empty array when absent', () => {
    const r = validateUsageDetailResponse({ value: [validRecord] });
    assert.deepEqual(r.records[0].assignedProducts, []);
  });
  it('rejects non-object payload', () => {
    assert.equal(validateUsageDetailResponse(null).code, 'invalid_payload');
    assert.equal(validateUsageDetailResponse('string').code, 'invalid_payload');
  });
  it('rejects payload without value array', () => {
    assert.equal(validateUsageDetailResponse({}).code, 'invalid_payload');
  });
  it('rejects records missing required fields', () => {
    const r = validateUsageDetailResponse({ value: [{ userPrincipalName: 'a@b.com' }] });
    assert.ok(!r.ok);
    assert.equal(r.code, 'validation_error');
  });
  it('validates multiple records', () => {
    const r = validateUsageDetailResponse({ value: [validRecord, { ...validRecord, userPrincipalName: 'b@c.com' }] });
    assert.ok(r.ok);
    assert.equal(r.records.length, 2);
  });
});

describe('validateUserCountSummaryResponse', () => {
  const validRecord = {
    reportRefreshDate: '2026-06-01',
    reportDate: '2026-05-31',
    enabledUserCount: 100,
    activeUserCount: 72,
  };

  it('validates a well-formed payload', () => {
    const r = validateUserCountSummaryResponse({ value: [validRecord] });
    assert.ok(r.ok);
    assert.equal(r.records[0].activeUserCount, 72);
  });
  it('computes utilizationRate', () => {
    const r = validateUserCountSummaryResponse({ value: [validRecord] });
    assert.equal(r.records[0].utilizationRate, 0.72);
  });
  it('utilizationRate is 0 when activeUserCount is 0', () => {
    const r = validateUserCountSummaryResponse({ value: [{ ...validRecord, activeUserCount: 0 }] });
    assert.equal(r.records[0].utilizationRate, 0);
  });
  it('rejects non-object payload', () => {
    assert.ok(!validateUserCountSummaryResponse(null).ok);
  });
  it('rejects missing required fields', () => {
    const r = validateUserCountSummaryResponse({ value: [{ reportRefreshDate: '2026-06-01' }] });
    assert.ok(!r.ok);
  });
});

describe('checkClientReadiness', () => {
  it('is ready when all fields are set', () => {
    const r = checkClientReadiness({ tenantId: TENANT, hasCredential: true, hasReportsPermission: true });
    assert.ok(r.ready);
    assert.equal(r.blockers.length, 0);
  });
  it('blocks when tenantId missing', () => {
    const r = checkClientReadiness({ tenantId: '', hasCredential: true, hasReportsPermission: true });
    assert.ok(!r.ready);
    assert.ok(r.blockers.some((b) => b.includes('tenantId')));
  });
  it('blocks when credential missing', () => {
    const r = checkClientReadiness({ tenantId: TENANT, hasCredential: false, hasReportsPermission: true });
    assert.ok(!r.ready);
    assert.ok(r.blockers.some((b) => b.includes('credential')));
  });
  it('blocks when permission missing', () => {
    const r = checkClientReadiness({ tenantId: TENANT, hasCredential: true, hasReportsPermission: false });
    assert.ok(!r.ready);
    assert.ok(r.blockers.some((b) => b.includes('Reports.Read.All')));
  });
  it('accumulates multiple blockers', () => {
    const r = checkClientReadiness({ tenantId: '', hasCredential: false, hasReportsPermission: false });
    assert.equal(r.blockers.length, 3);
  });
});
