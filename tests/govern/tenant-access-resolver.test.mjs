import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  PLATFORM_ROLES,
  resolvePillarAccess,
  authorizeTenantPillar,
  authorizeRouteAccess,
  buildAccessSummary,
} from '../../src/govern/tenant/tenant-access-resolver.mjs';

const tenantId = 'tenant-1';

describe('tenant-access-resolver constants', () => {
  it('contains known platform roles', () => {
    assert.ok(PLATFORM_ROLES.includes('GlobalAdmin'));
    assert.ok(PLATFORM_ROLES.includes('Reader'));
  });
});

describe('resolvePillarAccess', () => {
  it('resolves all pillars for GlobalAdmin', () => {
    const result = resolvePillarAccess({ roles: ['GlobalAdmin'] });
    assert.deepEqual(result.pillars.sort(), ['GOVERN', 'OBSERVE', 'OPTIMIZE', 'SECURE']);
    assert.deepEqual(result.unknownRoles, []);
  });

  it('returns unknown roles when provided', () => {
    const result = resolvePillarAccess({ roles: ['NopeRole'] });
    assert.deepEqual(result.pillars, []);
    assert.deepEqual(result.unknownRoles, ['NopeRole']);
  });
});

describe('authorizeTenantPillar', () => {
  it('allows SecurityAdmin access to SECURE', () => {
    const result = authorizeTenantPillar({ tenantId, roles: ['SecurityAdmin'] }, tenantId, 'SECURE');
    assert.equal(result.allowed, true);
  });

  it('denies Reader access to GOVERN', () => {
    const result = authorizeTenantPillar({ tenantId, roles: ['Reader'] }, tenantId, 'GOVERN');
    assert.equal(result.allowed, false);
    assert.equal(result.reason, 'insufficient_role_access');
  });

  it('denies tenant mismatch fail-closed', () => {
    const result = authorizeTenantPillar({ tenantId: 'tenant-2', roles: ['GlobalAdmin'] }, tenantId, 'OBSERVE');
    assert.equal(result.allowed, false);
    assert.equal(result.reason, 'tenant_mismatch');
  });

  it('denies unknown roles', () => {
    const result = authorizeTenantPillar({ tenantId, roles: ['BadRole'] }, tenantId, 'OBSERVE');
    assert.equal(result.allowed, false);
    assert.equal(result.reason, 'unknown_roles');
  });
});

describe('authorizeRouteAccess', () => {
  const route = { pillar: 'OBSERVE', requiredPermissions: ['Reports.Read.All'] };

  it('allows when role and permission checks pass', () => {
    const result = authorizeRouteAccess(
      { tenantId, roles: ['GlobalAdmin'] },
      tenantId,
      route,
      ['Reports.Read.All', 'User.Read.All']
    );
    assert.equal(result.allowed, true);
  });

  it('denies when required permission is missing', () => {
    const result = authorizeRouteAccess(
      { tenantId, roles: ['GlobalAdmin'] },
      tenantId,
      route,
      ['User.Read.All']
    );
    assert.equal(result.allowed, false);
    assert.equal(result.reason, 'missing_permissions');
  });

  it('denies when route is missing', () => {
    const result = authorizeRouteAccess({ tenantId, roles: ['GlobalAdmin'] }, tenantId, null, []);
    assert.equal(result.allowed, false);
    assert.equal(result.reason, 'route_missing');
  });
});

describe('buildAccessSummary', () => {
  it('aggregates allow/deny counts and reasons', () => {
    const summary = buildAccessSummary([
      { allowed: true },
      { allowed: false, reason: 'tenant_mismatch' },
      { allowed: false, reason: 'tenant_mismatch' },
      { allowed: false, reason: 'missing_permissions' },
    ]);
    assert.equal(summary.total, 4);
    assert.equal(summary.allowed, 1);
    assert.equal(summary.denied, 3);
    assert.equal(summary.denialReasons.tenant_mismatch, 2);
    assert.equal(summary.denialReasons.missing_permissions, 1);
  });

  it('returns empty summary for non-array input', () => {
    assert.deepEqual(buildAccessSummary(null), {
      total: 0,
      allowed: 0,
      denied: 0,
      denialReasons: {},
    });
  });
});
