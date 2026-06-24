import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyPermissionType,
  validateTokenClaims,
  extractGrantedScopes,
  extractGrantedRoles,
  authorizeTokenPermissions,
  enforceAuthGate,
} from '../../src/govern/auth/entra-auth-validator.mjs';

const TENANT = 'tenant-abc';
const NOW_SECS = Math.floor(Date.now() / 1000);
const FUTURE = NOW_SECS + 3600;
const PAST = NOW_SECS - 1;

function appClaims(overrides = {}) {
  return {
    tid: TENANT,
    oid: 'oid-1',
    iss: 'https://login.microsoftonline.com/tenant-abc/v2.0',
    roles: ['Reports.Read.All'],
    exp: FUTURE,
    ...overrides,
  };
}

function delegatedClaims(overrides = {}) {
  return {
    tid: TENANT,
    oid: 'oid-2',
    iss: 'https://login.microsoftonline.com/tenant-abc/v2.0',
    scp: 'Reports.Read.All User.Read.All',
    exp: FUTURE,
    ...overrides,
  };
}

describe('classifyPermissionType', () => {
  it('classifies application token by roles', () => {
    assert.equal(classifyPermissionType(appClaims()), 'application');
  });
  it('classifies delegated token by scp', () => {
    assert.equal(classifyPermissionType(delegatedClaims()), 'delegated');
  });
  it('returns unknown for empty claims', () => {
    assert.equal(classifyPermissionType({}), 'unknown');
  });
  it('returns unknown for null', () => {
    assert.equal(classifyPermissionType(null), 'unknown');
  });
  it('scp takes precedence over roles if both present', () => {
    assert.equal(classifyPermissionType({ scp: 'Foo', roles: ['Bar'] }), 'delegated');
  });
});

describe('validateTokenClaims', () => {
  it('accepts valid application claims', () => {
    const r = validateTokenClaims(appClaims(), TENANT);
    assert.equal(r.valid, true);
    assert.equal(r.permissionType, 'application');
  });
  it('accepts valid delegated claims', () => {
    const r = validateTokenClaims(delegatedClaims(), TENANT);
    assert.equal(r.valid, true);
    assert.equal(r.permissionType, 'delegated');
  });
  it('rejects null claims', () => {
    assert.equal(validateTokenClaims(null, TENANT).valid, false);
  });
  it('rejects missing tid', () => {
    const c = appClaims({ tid: undefined });
    assert.equal(validateTokenClaims(c, TENANT).reason, 'missing_claim_tid');
  });
  it('rejects tenant mismatch', () => {
    const r = validateTokenClaims(appClaims(), 'other-tenant');
    assert.equal(r.valid, false);
    assert.equal(r.reason, 'tenant_id_mismatch');
  });
  it('rejects expired token', () => {
    const r = validateTokenClaims(appClaims({ exp: PAST }), TENANT);
    assert.equal(r.valid, false);
    assert.equal(r.reason, 'token_expired');
  });
  it('rejects claims with no permissions', () => {
    const c = { tid: TENANT, oid: 'x', iss: 'y', exp: FUTURE };
    assert.equal(validateTokenClaims(c, TENANT).reason, 'no_permissions_found');
  });
  it('rejects missing expectedTenantId', () => {
    assert.equal(validateTokenClaims(appClaims(), null).valid, false);
  });
});

describe('extractGrantedScopes', () => {
  it('splits scp by space', () => {
    assert.deepEqual(extractGrantedScopes(delegatedClaims()), ['Reports.Read.All', 'User.Read.All']);
  });
  it('returns empty array when scp missing', () => {
    assert.deepEqual(extractGrantedScopes(appClaims()), []);
  });
});

describe('extractGrantedRoles', () => {
  it('returns roles array', () => {
    assert.deepEqual(extractGrantedRoles(appClaims()), ['Reports.Read.All']);
  });
  it('returns empty array when roles missing', () => {
    assert.deepEqual(extractGrantedRoles(delegatedClaims()), []);
  });
});

describe('authorizeTokenPermissions', () => {
  it('authorizes application token covering all required roles', () => {
    const r = authorizeTokenPermissions(appClaims({ roles: ['A', 'B'] }), ['A', 'B']);
    assert.equal(r.authorized, true);
    assert.deepEqual(r.missing, []);
  });
  it('reports missing roles for application token', () => {
    const r = authorizeTokenPermissions(appClaims({ roles: ['A'] }), ['A', 'B']);
    assert.equal(r.authorized, false);
    assert.deepEqual(r.missing, ['B']);
  });
  it('authorizes delegated token covering all required scopes', () => {
    const r = authorizeTokenPermissions(delegatedClaims(), ['Reports.Read.All', 'User.Read.All']);
    assert.equal(r.authorized, true);
  });
  it('reports missing scopes for delegated token', () => {
    const r = authorizeTokenPermissions(delegatedClaims(), ['AuditLog.Read.All']);
    assert.equal(r.authorized, false);
    assert.deepEqual(r.missing, ['AuditLog.Read.All']);
  });
  it('authorizes when required list is empty', () => {
    assert.equal(authorizeTokenPermissions(appClaims(), []).authorized, true);
  });
});

describe('enforceAuthGate', () => {
  it('allows valid application token with correct permissions', () => {
    const r = enforceAuthGate(appClaims(), TENANT, ['Reports.Read.All']);
    assert.equal(r.allowed, true);
    assert.equal(r.permissionType, 'application');
  });
  it('allows valid delegated token with correct scopes', () => {
    const r = enforceAuthGate(delegatedClaims(), TENANT, ['User.Read.All']);
    assert.equal(r.allowed, true);
  });
  it('blocks on claim validation failure (tenant mismatch)', () => {
    const r = enforceAuthGate(appClaims(), 'wrong-tenant', ['Reports.Read.All']);
    assert.equal(r.allowed, false);
    assert.equal(r.reason, 'tenant_id_mismatch');
  });
  it('blocks on insufficient permissions', () => {
    const r = enforceAuthGate(appClaims(), TENANT, ['AuditLog.Read.All']);
    assert.equal(r.allowed, false);
    assert.equal(r.reason, 'insufficient_permissions');
    assert.deepEqual(r.missing, ['AuditLog.Read.All']);
  });
  it('blocks expired token', () => {
    const r = enforceAuthGate(appClaims({ exp: PAST }), TENANT, ['Reports.Read.All']);
    assert.equal(r.allowed, false);
    assert.equal(r.reason, 'token_expired');
  });
});
