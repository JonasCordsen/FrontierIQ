import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  extractBearerToken,
  authorizeClaimsForRoute,
  authorizeRequest,
  withAuthGuard,
} from '../../src/govern/auth/auth-middleware-contract.mjs';

const tenantId = 'tenant-a';
const futureExp = Math.floor(Date.now() / 1000) + 3600;

function claims(overrides = {}) {
  return {
    tid: tenantId,
    oid: 'oid-1',
    iss: 'https://login.microsoftonline.com/tenant-a/v2.0',
    roles: ['User.Read.All', 'Reports.Read.All'],
    exp: futureExp,
    ...overrides,
  };
}

describe('extractBearerToken', () => {
  it('extracts token from standard Bearer header', () => {
    assert.equal(extractBearerToken('Bearer abc.def'), 'abc.def');
  });

  it('supports lowercase bearer prefix', () => {
    assert.equal(extractBearerToken('bearer token123'), 'token123');
  });

  it('returns null for invalid header', () => {
    assert.equal(extractBearerToken('Basic x'), null);
  });
});

describe('authorizeClaimsForRoute', () => {
  it('allows valid claims with required permissions', () => {
    const result = authorizeClaimsForRoute({
      claims: claims(),
      expectedTenantId: tenantId,
      requiredPermissions: ['User.Read.All'],
    });
    assert.equal(result.allowed, true);
  });

  it('denies when required permission is missing', () => {
    const result = authorizeClaimsForRoute({
      claims: claims(),
      expectedTenantId: tenantId,
      requiredPermissions: ['AuditLog.Read.All'],
    });
    assert.equal(result.allowed, false);
    assert.equal(result.reason, 'insufficient_permissions');
  });
});

describe('authorizeRequest', () => {
  const baseRequest = {
    headers: { authorization: 'Bearer some-token' },
    decodedClaims: claims(),
    expectedTenantId: tenantId,
    route: { requiredPermissions: ['User.Read.All'] },
  };

  it('allows authorized request', () => {
    const result = authorizeRequest(baseRequest);
    assert.equal(result.allowed, true);
    assert.equal(result.tokenPresent, true);
  });

  it('denies when bearer token is missing', () => {
    const result = authorizeRequest({ ...baseRequest, headers: {} });
    assert.equal(result.allowed, false);
    assert.equal(result.reason, 'bearer_missing');
  });

  it('denies tenant mismatch', () => {
    const result = authorizeRequest({
      ...baseRequest,
      expectedTenantId: 'other-tenant',
    });
    assert.equal(result.allowed, false);
    assert.equal(result.reason, 'tenant_id_mismatch');
  });
});

describe('withAuthGuard', () => {
  const handler = withAuthGuard(() => ({ status: 'success', data: { ok: true } }));

  it('passes through when authorized', () => {
    const response = handler({
      headers: { authorization: 'Bearer x' },
      decodedClaims: claims(),
      expectedTenantId: tenantId,
      route: { requiredPermissions: ['Reports.Read.All'] },
    });
    assert.equal(response.status, 'success');
  });

  it('returns error envelope when unauthorized', () => {
    const response = handler({
      headers: {},
      decodedClaims: claims(),
      expectedTenantId: tenantId,
      route: { requiredPermissions: ['Reports.Read.All'] },
    });
    assert.equal(response.status, 'error');
    assert.equal(response.errors[0].code, 'bearer_missing');
  });
});
