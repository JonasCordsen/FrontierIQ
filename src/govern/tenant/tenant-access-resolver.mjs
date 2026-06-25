/**
 * Tenant access resolver.
 * Pillar: GOVERN
 *
 * Deterministic authorization checks per tenant context.
 */

export const PLATFORM_ROLES = Object.freeze([
  'GlobalAdmin',
  'SecurityAdmin',
  'ComplianceAdmin',
  'OperationsAdmin',
  'Reader',
]);

export const ROLE_TO_PILLAR_ACCESS = Object.freeze({
  GlobalAdmin: ['OBSERVE', 'GOVERN', 'SECURE', 'OPTIMIZE'],
  SecurityAdmin: ['OBSERVE', 'SECURE'],
  ComplianceAdmin: ['OBSERVE', 'GOVERN'],
  OperationsAdmin: ['OBSERVE', 'OPTIMIZE'],
  Reader: ['OBSERVE'],
});

/**
 * Resolve the effective pillar access for a user context.
 * @param {{roles?: string[]}} userContext
 * @returns {{ pillars: string[], unknownRoles: string[] }}
 */
export function resolvePillarAccess(userContext) {
  const roles = Array.isArray(userContext?.roles) ? userContext.roles : [];
  const unknownRoles = roles.filter(role => !PLATFORM_ROLES.includes(role));
  const pillars = [...new Set(roles.flatMap(role => ROLE_TO_PILLAR_ACCESS[role] ?? []))];
  return { pillars, unknownRoles };
}

/**
 * Check whether user can access a pillar for a specific tenant.
 * Fail-closed: missing tenant or roles returns allowed=false.
 * @param {{tenantId?: string, roles?: string[]}} userContext
 * @param {string} tenantId
 * @param {'OBSERVE'|'GOVERN'|'SECURE'|'OPTIMIZE'} pillar
 * @returns {{ allowed: boolean, reason?: string, grantedPillars?: string[] }}
 */
export function authorizeTenantPillar(userContext, tenantId, pillar) {
  if (!tenantId || typeof tenantId !== 'string') return { allowed: false, reason: 'tenant_missing' };
  if (!pillar || typeof pillar !== 'string') return { allowed: false, reason: 'pillar_missing' };
  if (!userContext || userContext.tenantId !== tenantId) {
    return { allowed: false, reason: 'tenant_mismatch' };
  }
  const { pillars, unknownRoles } = resolvePillarAccess(userContext);
  if (unknownRoles.length > 0) return { allowed: false, reason: 'unknown_roles' };
  if (!pillars.includes(pillar)) {
    return { allowed: false, reason: 'insufficient_role_access', grantedPillars: pillars };
  }
  return { allowed: true, grantedPillars: pillars };
}

/**
 * Determine route-level access decision.
 * @param {{tenantId?:string,roles?:string[]}} userContext
 * @param {string} tenantId
 * @param {{pillar?: string, requiredPermissions?: string[]}} route
 * @param {string[]} grantedPermissions
 * @returns {{ allowed: boolean, reason?: string }}
 */
export function authorizeRouteAccess(userContext, tenantId, route, grantedPermissions) {
  if (!route || typeof route !== 'object') return { allowed: false, reason: 'route_missing' };
  const pillarDecision = authorizeTenantPillar(userContext, tenantId, route.pillar);
  if (!pillarDecision.allowed) return pillarDecision;

  const required = Array.isArray(route.requiredPermissions) ? route.requiredPermissions : [];
  const granted = Array.isArray(grantedPermissions) ? grantedPermissions : [];
  const missing = required.filter(permission => !granted.includes(permission));
  if (missing.length > 0) return { allowed: false, reason: 'missing_permissions' };
  return { allowed: true };
}

/**
 * Build authorization summary for observability/audit output.
 * @param {object[]} decisions
 * @returns {{ total:number, allowed:number, denied:number, denialReasons: Record<string, number> }}
 */
export function buildAccessSummary(decisions) {
  if (!Array.isArray(decisions)) {
    return { total: 0, allowed: 0, denied: 0, denialReasons: {} };
  }

  const summary = {
    total: decisions.length,
    allowed: decisions.filter(d => d?.allowed).length,
    denied: decisions.filter(d => !d?.allowed).length,
    denialReasons: {},
  };
  for (const decision of decisions) {
    if (decision?.allowed) continue;
    const reason = decision?.reason ?? 'unknown';
    summary.denialReasons[reason] = (summary.denialReasons[reason] ?? 0) + 1;
  }
  return summary;
}
