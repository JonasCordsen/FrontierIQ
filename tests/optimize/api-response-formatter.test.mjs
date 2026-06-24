import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  API_RESPONSE_VERSION,
  STATUS_SUCCESS,
  STATUS_ERROR,
  STATUS_PARTIAL,
  formatSuccess,
  formatError,
  formatPartial,
  buildMeta,
  buildPagination,
  normalizeErrors,
  deriveStatus,
} from '../../src/optimize/delivery/api-response-formatter.mjs';

const TS = '2024-01-01T00:00:00.000Z';
const TENANT = 'tenant-xyz';

describe('formatSuccess', () => {
  it('wraps data with success status and meta', () => {
    const r = formatSuccess({ data: { score: 90 }, tenantId: TENANT, generatedAt: TS, pillar: 'OPTIMIZE' });
    assert.equal(r.status, STATUS_SUCCESS);
    assert.deepEqual(r.data, { score: 90 });
    assert.equal(r.meta.tenantId, TENANT);
    assert.equal(r.meta.pillar, 'OPTIMIZE');
    assert.equal(r.meta.version, API_RESPONSE_VERSION);
    assert.deepEqual(r.errors, []);
  });
  it('includes pagination when provided', () => {
    const r = formatSuccess({ data: [], tenantId: TENANT, generatedAt: TS, pagination: { page: 1, pageSize: 10, totalCount: 25 } });
    assert.ok(r.pagination);
    assert.equal(r.pagination.totalPages, 3);
    assert.equal(r.pagination.hasNextPage, true);
  });
  it('omits pagination when not provided', () => {
    const r = formatSuccess({ data: null, tenantId: TENANT, generatedAt: TS });
    assert.equal(r.pagination, undefined);
  });
  it('sets data to null when not provided', () => {
    const r = formatSuccess({ tenantId: TENANT, generatedAt: TS });
    assert.equal(r.data, null);
  });
});

describe('formatError', () => {
  it('returns error status with null data', () => {
    const r = formatError({ errors: 'something_went_wrong', tenantId: TENANT, generatedAt: TS });
    assert.equal(r.status, STATUS_ERROR);
    assert.equal(r.data, null);
    assert.equal(r.errors[0].code, 'error');
    assert.equal(r.errors[0].message, 'something_went_wrong');
  });
  it('accepts error object with code and message', () => {
    const r = formatError({ errors: { code: 'auth_failed', message: 'token rejected' }, tenantId: TENANT, generatedAt: TS });
    assert.equal(r.errors[0].code, 'auth_failed');
  });
  it('accepts array of errors', () => {
    const r = formatError({ errors: ['err1', 'err2'], tenantId: TENANT, generatedAt: TS });
    assert.equal(r.errors.length, 2);
  });
});

describe('formatPartial', () => {
  it('returns partial status when both data and errors present', () => {
    const r = formatPartial({ data: [1, 2], errors: ['minor_issue'], tenantId: TENANT, generatedAt: TS });
    assert.equal(r.status, STATUS_PARTIAL);
    assert.deepEqual(r.data, [1, 2]);
    assert.equal(r.errors.length, 1);
  });
  it('includes pagination when provided', () => {
    const r = formatPartial({ data: [], errors: ['x'], tenantId: TENANT, generatedAt: TS, pagination: { page: 2, pageSize: 5, totalCount: 15 } });
    assert.equal(r.pagination.page, 2);
    assert.equal(r.pagination.hasNextPage, true);
  });
});

describe('buildMeta', () => {
  it('includes version, tenantId, generatedAt', () => {
    const m = buildMeta({ tenantId: TENANT, generatedAt: TS });
    assert.equal(m.version, API_RESPONSE_VERSION);
    assert.equal(m.tenantId, TENANT);
    assert.equal(m.generatedAt, TS);
  });
  it('omits pillar key when not provided', () => {
    const m = buildMeta({ tenantId: TENANT, generatedAt: TS });
    assert.equal('pillar' in m, false);
  });
  it('includes pillar when provided', () => {
    const m = buildMeta({ tenantId: TENANT, generatedAt: TS, pillar: 'SECURE' });
    assert.equal(m.pillar, 'SECURE');
  });
  it('sets nulls when opts is empty', () => {
    const m = buildMeta();
    assert.equal(m.tenantId, null);
  });
});

describe('buildPagination', () => {
  it('calculates totalPages correctly', () => {
    const p = buildPagination({ page: 1, pageSize: 10, totalCount: 35 });
    assert.equal(p.totalPages, 4);
    assert.equal(p.hasNextPage, true);
  });
  it('hasNextPage false on last page', () => {
    const p = buildPagination({ page: 3, pageSize: 10, totalCount: 25 });
    assert.equal(p.hasNextPage, false);
  });
  it('totalPages is 0 when pageSize is 0', () => {
    const p = buildPagination({ page: 1, pageSize: 0, totalCount: 10 });
    assert.equal(p.totalPages, 0);
  });
  it('defaults page to 1 and pageSize to 20', () => {
    const p = buildPagination({ totalCount: 100 });
    assert.equal(p.page, 1);
    assert.equal(p.pageSize, 20);
  });
});

describe('normalizeErrors', () => {
  it('converts string to error object', () => {
    assert.deepEqual(normalizeErrors('boom'), [{ code: 'error', message: 'boom' }]);
  });
  it('passes through error object with code', () => {
    assert.deepEqual(normalizeErrors({ code: 'x', message: 'y' }), [{ code: 'x', message: 'y' }]);
  });
  it('returns empty array for null', () => {
    assert.deepEqual(normalizeErrors(null), []);
  });
  it('handles mixed array', () => {
    const r = normalizeErrors(['str', { code: 'c', message: 'm' }]);
    assert.equal(r.length, 2);
    assert.equal(r[0].code, 'error');
    assert.equal(r[1].code, 'c');
  });
});

describe('deriveStatus', () => {
  it('success when data present and no errors', () => {
    assert.equal(deriveStatus({ x: 1 }, []), STATUS_SUCCESS);
  });
  it('error when no data and errors present', () => {
    assert.equal(deriveStatus(null, [{ code: 'e' }]), STATUS_ERROR);
  });
  it('partial when data and errors both present', () => {
    assert.equal(deriveStatus({ x: 1 }, [{ code: 'e' }]), STATUS_PARTIAL);
  });
  it('success when data is empty array', () => {
    assert.equal(deriveStatus([], []), STATUS_SUCCESS);
  });
});
