import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { TENANT_API_ROUTES } from '../../src/observe/api/tenant-management-api.mjs';
import { buildTenantHandlerMap, buildSmokeFixtures } from '../../src/observe/api/tenant-api-smoke-fixture-runner.mjs';
import {
  inferStatusCode,
  executeRuntimeRequest,
} from '../../src/observe/api/http-runtime-adapter.mjs';

const generatedAt = '2026-01-01T00:00:00.000Z';

describe('inferStatusCode', () => {
  it('maps success/partial/error envelopes', () => {
    assert.equal(inferStatusCode({ status: 'success' }), 200);
    assert.equal(inferStatusCode({ status: 'partial' }), 207);
    assert.equal(inferStatusCode({ status: 'error', errors: [{ code: 'route_not_found' }] }), 404);
  });
});

describe('executeRuntimeRequest', () => {
  const fixtures = buildSmokeFixtures(generatedAt);
  const handlers = buildTenantHandlerMap();

  it('returns success response and telemetry for authorized request', () => {
    const result = executeRuntimeRequest({
      routes: TENANT_API_ROUTES,
      handlers,
      generatedAt,
      durationMs: 14,
      request: {
        requestId: 'r1',
        method: 'GET',
        path: '/api/v1/tenants',
        userContext: fixtures.userContext,
        grantedPermissions: fixtures.grantedPermissions,
        records: fixtures.records,
        headers: { authorization: 'Bearer fake-token' },
        decodedClaims: {
          tid: fixtures.userContext.tenantId,
          oid: 'oid',
          iss: 'issuer',
          roles: ['User.Read.All', 'Reports.Read.All'],
          exp: Math.floor(Date.now() / 1000) + 300,
        },
        expectedTenantId: fixtures.userContext.tenantId,
      },
    });
    assert.equal(result.response.status, 'success');
    assert.equal(result.telemetry.outcome, 'success');
  });

  it('returns unauthorized response for missing bearer token', () => {
    const result = executeRuntimeRequest({
      routes: TENANT_API_ROUTES,
      handlers,
      generatedAt,
      request: {
        requestId: 'r2',
        method: 'GET',
        path: '/api/v1/tenants',
        userContext: fixtures.userContext,
        grantedPermissions: fixtures.grantedPermissions,
        records: fixtures.records,
        headers: {},
        decodedClaims: {},
        expectedTenantId: fixtures.userContext.tenantId,
      },
    });
    assert.equal(result.response.status, 'error');
    assert.equal(result.response.errors[0].code, 'bearer_missing');
    assert.equal(result.telemetry.statusCode, 401);
  });

  it('returns route_not_found when path is unknown', () => {
    const result = executeRuntimeRequest({
      routes: TENANT_API_ROUTES,
      handlers,
      generatedAt,
      request: {
        requestId: 'r3',
        method: 'GET',
        path: '/api/v1/unknown',
        userContext: fixtures.userContext,
      },
    });
    assert.equal(result.response.status, 'error');
    assert.equal(result.response.errors[0].code, 'route_not_found');
    assert.equal(result.telemetry.statusCode, 404);
  });
});
