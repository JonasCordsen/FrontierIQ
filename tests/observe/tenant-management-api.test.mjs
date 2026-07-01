import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  TENANT_API_ROUTES,
  handleListTenants,
  handleGetTenant,
  handleUpsertTenant,
  handleTenantReadiness,
} from '../../src/observe/api/tenant-management-api.mjs';
import { buildTenantRecord } from '../../src/govern/tenant/tenant-registry.mjs';

const TS = '2026-01-01T00:00:00.000Z';
const userContext = { tenantId: 'tenant-a', roles: ['GlobalAdmin'] };
const grantedPermissions = ['User.Read.All', 'Reports.Read.All'];

function tenant(tenantId, state = 'active') {
  return buildTenantRecord({
    tenantId,
    displayName: `Display ${tenantId}`,
    region: 'westeurope',
    state,
    createdAt: TS,
    updatedAt: TS,
  });
}

describe('TENANT_API_ROUTES', () => {
  it('defines four route contracts', () => {
    assert.equal(TENANT_API_ROUTES.length, 4);
    assert.ok(TENANT_API_ROUTES.every(route => route.path.startsWith('/api/v1/tenants')));
  });
});

describe('handleListTenants', () => {
  it('returns success for authorized context', () => {
    const response = handleListTenants(userContext, grantedPermissions, [tenant('tenant-a')], TS);
    assert.equal(response.status, 'success');
    assert.equal(response.data.tenants.length, 1);
    assert.equal(response.data.summary.total, 1);
  });

  it('returns partial when invalid records are filtered', () => {
    const invalid = { tenantId: 'tenant-b', state: 'active' };
    const response = handleListTenants(userContext, grantedPermissions, [tenant('tenant-a'), invalid], TS);
    assert.equal(response.status, 'partial');
    assert.equal(response.errors.length, 1);
  });
});

describe('handleGetTenant', () => {
  it('returns tenant when found', () => {
    const response = handleGetTenant(userContext, grantedPermissions, [tenant('tenant-a')], 'tenant-a', TS);
    assert.equal(response.status, 'success');
    assert.equal(response.data.tenantId, 'tenant-a');
  });

  it('returns tenant_not_found for missing tenant', () => {
    const response = handleGetTenant(userContext, grantedPermissions, [tenant('tenant-a')], 'tenant-b', TS);
    assert.equal(response.status, 'error');
    assert.equal(response.errors[0].code, 'tenant_not_found');
  });
});

describe('handleUpsertTenant', () => {
  it('returns success for valid payload', () => {
    const response = handleUpsertTenant(
      userContext,
      grantedPermissions,
      {
        tenantId: 'tenant-a',
        displayName: 'Tenant A',
        region: 'westeurope',
        state: 'active',
        createdAt: TS,
        updatedAt: TS,
      },
      TS
    );
    assert.equal(response.status, 'success');
    assert.equal(response.data.tenantId, 'tenant-a');
  });

  it('returns error for invalid payload', () => {
    const response = handleUpsertTenant(userContext, grantedPermissions, { tenantId: 'x' }, TS);
    assert.equal(response.status, 'error');
    assert.ok(response.errors.length > 0);
  });
});

describe('handleTenantReadiness', () => {
  it('returns ready for valid active tenant', () => {
    const response = handleTenantReadiness(
      userContext,
      grantedPermissions,
      [tenant('tenant-a', 'active')],
      'tenant-a',
      TS
    );
    assert.equal(response.status, 'success');
    assert.equal(response.data.readiness, 'ready');
  });

  it('returns blocked for non-active tenant', () => {
    const response = handleTenantReadiness(
      userContext,
      grantedPermissions,
      [tenant('tenant-a', 'onboarding')],
      'tenant-a',
      TS
    );
    assert.equal(response.status, 'success');
    assert.equal(response.data.readiness, 'blocked');
  });

  it('returns tenant_not_found for unknown tenant', () => {
    const response = handleTenantReadiness(
      userContext,
      grantedPermissions,
      [tenant('tenant-a')],
      'tenant-z',
      TS
    );
    assert.equal(response.status, 'error');
    assert.equal(response.errors[0].code, 'tenant_not_found');
  });
});
