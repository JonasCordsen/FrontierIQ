/**
 * Tenant API smoke fixture runner.
 * Pillar: OBSERVE
 *
 * Deterministic fixture runner for list/get/upsert/readiness flows.
 */

import {
  TENANT_API_ROUTES,
  handleListTenants,
  handleGetTenant,
  handleUpsertTenant,
  handleTenantReadiness,
} from './tenant-management-api.mjs';
import { dispatchApiRequest } from './api-host-adapter.mjs';
import { buildTenantRecord } from '../../govern/tenant/tenant-registry.mjs';

/**
 * Build deterministic smoke fixtures.
 * @param {string} generatedAt
 * @returns {object}
 */
export function buildSmokeFixtures(generatedAt = '1970-01-01T00:00:00.000Z') {
  const baseTenant = buildTenantRecord({
    tenantId: 'tenant-a',
    displayName: 'Tenant A',
    region: 'westeurope',
    state: 'active',
    createdAt: generatedAt,
    updatedAt: generatedAt,
  });

  return {
    generatedAt,
    userContext: { tenantId: 'tenant-a', roles: ['GlobalAdmin'] },
    grantedPermissions: ['User.Read.All', 'Reports.Read.All'],
    records: [baseTenant],
    upsertPayload: {
      tenantId: 'tenant-a',
      displayName: 'Tenant A',
      region: 'westeurope',
      state: 'active',
      createdAt: generatedAt,
      updatedAt: generatedAt,
    },
  };
}

/**
 * Build route handler map for host adapter dispatch.
 * @returns {Record<string, Function>}
 */
export function buildTenantHandlerMap() {
  return {
    'GET:/api/v1/tenants': ({ request, generatedAt }) =>
      handleListTenants(
        request.userContext,
        request.grantedPermissions,
        request.records,
        generatedAt
      ),
    'GET:/api/v1/tenants/:tenantId': ({ request, params, generatedAt }) =>
      handleGetTenant(
        request.userContext,
        request.grantedPermissions,
        request.records,
        params.tenantId,
        generatedAt
      ),
    'PUT:/api/v1/tenants/:tenantId': ({ request, generatedAt }) =>
      handleUpsertTenant(
        request.userContext,
        request.grantedPermissions,
        request.body,
        generatedAt
      ),
    'GET:/api/v1/tenants/:tenantId/readiness': ({ request, params, generatedAt }) =>
      handleTenantReadiness(
        request.userContext,
        request.grantedPermissions,
        request.records,
        params.tenantId,
        generatedAt
      ),
  };
}

/**
 * Run deterministic smoke scenarios.
 * @param {object} fixtures
 * @returns {{ list: object, get: object, upsert: object, readiness: object, allPassed: boolean }}
 */
export function runTenantApiSmoke(fixtures) {
  const handlers = buildTenantHandlerMap();
  const generatedAt = fixtures.generatedAt;

  const requestBase = {
    userContext: fixtures.userContext,
    grantedPermissions: fixtures.grantedPermissions,
    records: fixtures.records,
  };

  const list = dispatchApiRequest({
    routes: TENANT_API_ROUTES,
    handlers,
    generatedAt,
    request: {
      ...requestBase,
      method: 'GET',
      path: '/api/v1/tenants',
    },
  });

  const get = dispatchApiRequest({
    routes: TENANT_API_ROUTES,
    handlers,
    generatedAt,
    request: {
      ...requestBase,
      method: 'GET',
      path: '/api/v1/tenants/tenant-a',
    },
  });

  const upsert = dispatchApiRequest({
    routes: TENANT_API_ROUTES,
    handlers,
    generatedAt,
    request: {
      ...requestBase,
      method: 'PUT',
      path: '/api/v1/tenants/tenant-a',
      body: fixtures.upsertPayload,
    },
  });

  const readiness = dispatchApiRequest({
    routes: TENANT_API_ROUTES,
    handlers,
    generatedAt,
    request: {
      ...requestBase,
      method: 'GET',
      path: '/api/v1/tenants/tenant-a/readiness',
    },
  });

  const statuses = [list.status, get.status, upsert.status, readiness.status];
  return {
    list,
    get,
    upsert,
    readiness,
    allPassed: statuses.every(status => status === 'success'),
  };
}
