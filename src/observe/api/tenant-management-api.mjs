/**
 * Tenant management API contract.
 * Pillar: OBSERVE (API surface for tenancy operations)
 *
 * Framework-agnostic route/handler contracts that compose existing delivery
 * modules (route builder + response formatter) with tenant governance modules.
 */

import { buildRoute } from '../../optimize/delivery/api-route-builder.mjs';
import {
  formatSuccess,
  formatError,
  formatPartial,
} from '../../optimize/delivery/api-response-formatter.mjs';
import {
  buildTenantRecord,
  validateTenantRecord,
  buildTenantRegistrySummary,
} from '../../govern/tenant/tenant-registry.mjs';
import { authorizeRouteAccess } from '../../govern/tenant/tenant-access-resolver.mjs';

export const TENANT_API_ROUTES = Object.freeze([
  buildRoute({
    pillar: 'GOVERN',
    method: 'GET',
    path: '/tenants',
    description: 'List tenants and registry summary',
    requiredPermissions: ['User.Read.All'],
  }),
  buildRoute({
    pillar: 'GOVERN',
    method: 'GET',
    path: '/tenants/:tenantId',
    description: 'Get tenant by id',
    requiredPermissions: ['User.Read.All'],
    pathParams: ['tenantId'],
  }),
  buildRoute({
    pillar: 'GOVERN',
    method: 'PUT',
    path: '/tenants/:tenantId',
    description: 'Upsert tenant record',
    requiredPermissions: ['User.Read.All'],
    pathParams: ['tenantId'],
  }),
  buildRoute({
    pillar: 'GOVERN',
    method: 'GET',
    path: '/tenants/:tenantId/readiness',
    description: 'Get tenant readiness summary',
    requiredPermissions: ['Reports.Read.All', 'User.Read.All'],
    pathParams: ['tenantId'],
  }),
]);

/**
 * List tenant records with summary.
 * @param {{ tenantId: string, roles: string[] }} userContext
 * @param {string[]} grantedPermissions
 * @param {object[]} records
 * @param {string} generatedAt
 * @returns {object}
 */
export function handleListTenants(userContext, grantedPermissions, records, generatedAt) {
  const route = TENANT_API_ROUTES[0];
  const authz = authorizeRouteAccess(userContext, userContext?.tenantId, route, grantedPermissions);
  if (!authz.allowed) {
    return formatError({
      tenantId: userContext?.tenantId ?? null,
      generatedAt,
      pillar: 'GOVERN',
      errors: { code: authz.reason, message: 'Access denied for list tenants' },
    });
  }

  const items = Array.isArray(records) ? records : [];
  const invalid = items.filter(record => !validateTenantRecord(record).valid);
  if (invalid.length > 0) {
    return formatPartial({
      tenantId: userContext?.tenantId ?? null,
      generatedAt,
      pillar: 'GOVERN',
      data: {
        tenants: items.filter(record => validateTenantRecord(record).valid),
        summary: buildTenantRegistrySummary(items),
      },
      errors: {
        code: 'invalid_records_filtered',
        message: `${invalid.length} tenant records were filtered`,
      },
    });
  }

  return formatSuccess({
    tenantId: userContext?.tenantId ?? null,
    generatedAt,
    pillar: 'GOVERN',
    data: { tenants: items, summary: buildTenantRegistrySummary(items) },
    pagination: { page: 1, pageSize: items.length || 1, totalCount: items.length },
  });
}

/**
 * Get a tenant by id.
 * @param {{ tenantId: string, roles: string[] }} userContext
 * @param {string[]} grantedPermissions
 * @param {object[]} records
 * @param {string} targetTenantId
 * @param {string} generatedAt
 * @returns {object}
 */
export function handleGetTenant(userContext, grantedPermissions, records, targetTenantId, generatedAt) {
  const route = TENANT_API_ROUTES[1];
  const authz = authorizeRouteAccess(userContext, userContext?.tenantId, route, grantedPermissions);
  if (!authz.allowed) {
    return formatError({
      tenantId: userContext?.tenantId ?? null,
      generatedAt,
      pillar: 'GOVERN',
      errors: { code: authz.reason, message: 'Access denied for get tenant' },
    });
  }

  const record = Array.isArray(records)
    ? records.find(item => item?.tenantId === targetTenantId) ?? null
    : null;
  if (!record) {
    return formatError({
      tenantId: userContext?.tenantId ?? null,
      generatedAt,
      pillar: 'GOVERN',
      errors: { code: 'tenant_not_found', message: `Tenant ${targetTenantId} not found` },
    });
  }

  return formatSuccess({
    tenantId: userContext?.tenantId ?? null,
    generatedAt,
    pillar: 'GOVERN',
    data: record,
  });
}

/**
 * Upsert a tenant record.
 * @param {{ tenantId: string, roles: string[] }} userContext
 * @param {string[]} grantedPermissions
 * @param {object} payload
 * @param {string} generatedAt
 * @returns {object}
 */
export function handleUpsertTenant(userContext, grantedPermissions, payload, generatedAt) {
  const route = TENANT_API_ROUTES[2];
  const authz = authorizeRouteAccess(userContext, userContext?.tenantId, route, grantedPermissions);
  if (!authz.allowed) {
    return formatError({
      tenantId: userContext?.tenantId ?? null,
      generatedAt,
      pillar: 'GOVERN',
      errors: { code: authz.reason, message: 'Access denied for upsert tenant' },
    });
  }

  const candidate = buildTenantRecord(payload);
  const validation = validateTenantRecord(candidate);
  if (!validation.valid) {
    return formatError({
      tenantId: userContext?.tenantId ?? null,
      generatedAt,
      pillar: 'GOVERN',
      errors: validation.errors.map(code => ({ code, message: code })),
    });
  }

  return formatSuccess({
    tenantId: userContext?.tenantId ?? null,
    generatedAt,
    pillar: 'GOVERN',
    data: candidate,
  });
}

/**
 * Build a tenant readiness view from registry data.
 * @param {{ tenantId: string, roles: string[] }} userContext
 * @param {string[]} grantedPermissions
 * @param {object[]} records
 * @param {string} targetTenantId
 * @param {string} generatedAt
 * @returns {object}
 */
export function handleTenantReadiness(
  userContext,
  grantedPermissions,
  records,
  targetTenantId,
  generatedAt
) {
  const route = TENANT_API_ROUTES[3];
  const authz = authorizeRouteAccess(userContext, userContext?.tenantId, route, grantedPermissions);
  if (!authz.allowed) {
    return formatError({
      tenantId: userContext?.tenantId ?? null,
      generatedAt,
      pillar: 'GOVERN',
      errors: { code: authz.reason, message: 'Access denied for tenant readiness' },
    });
  }

  const record = Array.isArray(records)
    ? records.find(item => item?.tenantId === targetTenantId) ?? null
    : null;
  if (!record) {
    return formatError({
      tenantId: userContext?.tenantId ?? null,
      generatedAt,
      pillar: 'GOVERN',
      errors: { code: 'tenant_not_found', message: `Tenant ${targetTenantId} not found` },
    });
  }

  const validation = validateTenantRecord(record);
  const readiness = validation.valid && record.state === 'active' ? 'ready' : 'blocked';
  return formatSuccess({
    tenantId: userContext?.tenantId ?? null,
    generatedAt,
    pillar: 'GOVERN',
    data: {
      tenantId: record.tenantId,
      state: record.state,
      readiness,
      validationErrors: validation.errors,
    },
  });
}
