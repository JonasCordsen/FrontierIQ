// Core RBAC engine
// Validates tokens, maps user claims to roles, and enforces access control

import type {
  UserContext,
  AccessLevel,
  UserRole,
  RBACConfig,
  RBACDecision,
} from './types';
import { DEFAULT_RBAC_CONFIG, DEFAULT_ACCESS_LEVEL, ROLE_ACCESS_LEVELS } from './types';
import { getTenant, isUserAdminForTenant, isUserDelegatedAdmin, initializeSampleTenants } from './tenant-metadata';

// Initialize sample tenants on module load
initializeSampleTenants();

/**
 * Extract user context from JWT claims
 * Maps Entra claims to UserContext
 */
export function extractUserContext(token: { payload: Record<string, any> }, tenantId: string): UserContext | null {
  const claims = token.payload;

  // Extract basic info
  const userId = claims.oid || claims.sub; // Object ID or Subject
  const upn = claims.upn || claims.preferred_username || 'unknown';
  const groupIds = claims.groups || [];
  const exp = claims.exp || 0;

  if (!userId) {
    return null;
  }

  const tenant = getTenant(tenantId);
  if (!tenant) {
    return null;
  }

  // Determine if user is admin for this tenant
  const isAdmin = isUserAdminForTenant(userId, groupIds, tenantId);
  const isDelegatedAdmin = isUserDelegatedAdmin(groupIds);
  const accessLevel = isAdmin
    ? ROLE_ACCESS_LEVELS.admin
    : isDelegatedAdmin
      ? { ...ROLE_ACCESS_LEVELS.manager, canManageOtherTenants: true, canApproveWaivers: true }
      : ROLE_ACCESS_LEVELS.observer;

  // Determine primary role
  let primaryRole: UserRole;
  if (isAdmin) {
    primaryRole = {
      tenantId,
      userId,
      role: 'admin',
      groupIds,
      isDelegatedAdmin,
      accessLevel,
      grantedAt: new Date(),
    };
  } else {
    primaryRole = {
      tenantId,
      userId,
      role: isDelegatedAdmin ? 'manager' : 'observer',
      groupIds,
      isDelegatedAdmin,
      accessLevel,
      grantedAt: new Date(),
    };
  }

  return {
    userId,
    upn,
    tenantId,
    groupIds,
    roles: [primaryRole],
    primaryRole,
    isGlobalAdmin: claims.roles?.includes('GlobalAdmin') || false,
    isDelegatedAdmin,
    accessLevel,
    tokenExpiresAt: exp * 1000, // Convert to milliseconds
  };
}

/**
 * Validate user access to a specific tenant
 * Returns RBAC decision with reasons
 */
export function validateTenantAccess(
  userContext: UserContext | null,
  requestedTenantId: string,
  config: RBACConfig = DEFAULT_RBAC_CONFIG
): RBACDecision {
  if (!userContext) {
    return {
      allowed: false,
      reason: 'No user context (token not extracted)',
    };
  }

  const tenant = getTenant(requestedTenantId);
  if (!tenant) {
    return {
      allowed: false,
      reason: `Tenant not found: ${requestedTenantId}`,
      userContext,
      tenantId: requestedTenantId,
    };
  }

  // Global admins can access any tenant when enabled.
  if (userContext.isGlobalAdmin && config.allowGlobalAdmins) {
    return {
      allowed: true,
      reason: 'User is an Entra global admin',
      userContext,
      tenantId: requestedTenantId,
    };
  }

  // Delegated admins can manage tenant-scoped admin tasks across tenants.
  const isDelegatedAdminForTenant = tenant.delegatedAdminGroupIds.some((groupId) =>
    userContext.groupIds.includes(groupId)
  );

  if (isDelegatedAdminForTenant || userContext.isDelegatedAdmin) {
    return {
      allowed: true,
      reason: `User is a delegated admin for tenant ${requestedTenantId}`,
      userContext,
      tenantId: requestedTenantId,
    };
  }

  // Check if user is an admin for the requested tenant
  const isAdmin = isUserAdminForTenant(userContext.userId, userContext.groupIds, requestedTenantId);

  if (isAdmin) {
    return {
      allowed: true,
      reason: `User is admin for tenant ${requestedTenantId}`,
      userContext,
      tenantId: requestedTenantId,
    };
  }

  if (!config.strictIsolation) {
    return {
      allowed: true,
      reason: `Tenant isolation disabled; allowing access to tenant ${requestedTenantId}`,
      userContext,
      tenantId: requestedTenantId,
    };
  }

  // Check token expiration
  if (userContext.tokenExpiresAt && Date.now() > userContext.tokenExpiresAt) {
    return {
      allowed: false,
      reason: 'Token has expired',
      userContext,
      tenantId: requestedTenantId,
    };
  }

  return {
    allowed: false,
    reason: `User ${userContext.userId} does not have access to tenant ${requestedTenantId}`,
    userContext,
    tenantId: requestedTenantId,
  };
}

/**
 * Validate user can perform a specific operation
 */
export function validateOperation(
  userContext: UserContext | null,
  operation: keyof AccessLevel,
  tenantId: string,
  config: RBACConfig = DEFAULT_RBAC_CONFIG
): RBACDecision {
  // First validate tenant access
  const tenantDecision = validateTenantAccess(userContext, tenantId, config);
  if (!tenantDecision.allowed) {
    return tenantDecision;
  }

  if (!userContext) {
    return {
      allowed: false,
      reason: 'No user context',
      tenantId,
    };
  }

  // Check if user's access level allows the operation
  const canPerformOperation = userContext.accessLevel[operation as keyof AccessLevel];

  if (!canPerformOperation) {
    return {
      allowed: false,
      reason: `User does not have permission for operation: ${operation}`,
      userContext,
      tenantId,
    };
  }

  return {
    allowed: true,
    reason: `User is authorized for operation: ${operation}`,
    userContext,
    tenantId,
  };
}

/**
 * Create a user role from token and tenant metadata
 */
export function createUserRole(
  userId: string,
  groupIds: string[],
  tenantId: string
): UserRole | null {
  const tenant = getTenant(tenantId);
  if (!tenant) {
    return null;
  }

  const isAdmin = isUserAdminForTenant(userId, groupIds, tenantId);
  const isDelegatedAdmin = isUserDelegatedAdmin(groupIds);

  const role: UserRole = {
    tenantId,
    userId,
    role: isAdmin ? 'admin' : 'observer',
    groupIds,
    isDelegatedAdmin,
    accessLevel: isAdmin ? ROLE_ACCESS_LEVELS.admin : ROLE_ACCESS_LEVELS.observer,
    grantedAt: new Date(),
  };

  return role;
}

/**
 * Helper: Convert role name to access level
 */
export function getAccessLevelForRole(role: string): AccessLevel {
  const accessLevel = ROLE_ACCESS_LEVELS[role as keyof typeof ROLE_ACCESS_LEVELS];
  return accessLevel || DEFAULT_ACCESS_LEVEL;
}

/**
 * Helper: Check if user is authorized for a specific scope
 * Useful for fine-grained permission checks
 */
export function isUserAuthorized(
  userContext: UserContext | null,
  scope: string,
  operation: string,
  tenantId: string
): boolean {
  if (!userContext) {
    return false;
  }

  // Check tenant access first
  const tenantDecision = validateTenantAccess(userContext, tenantId);
  if (!tenantDecision.allowed) {
    return false;
  }

  // For now, admins can do everything in their tenant
  if (userContext.primaryRole.role === 'admin') {
    return true;
  }

  // Add fine-grained scope-based checks here if needed
  // Example: userContext.accessLevel.scope[operation]

  return false;
}

/**
 * Log authorization decision (for audit trail)
 */
export function logAuthorizationDecision(
  decision: RBACDecision,
  context: {
    endpoint: string;
    method: string;
    timestamp: Date;
  }
): void {
  const logEntry = {
    timestamp: context.timestamp.toISOString(),
    endpoint: context.endpoint,
    method: context.method,
    allowed: decision.allowed,
    userId: decision.userContext?.userId,
    tenantId: decision.tenantId,
    reason: decision.reason,
  };

  if (decision.allowed) {
    console.log('[RBAC:AUTH]', JSON.stringify(logEntry));
  } else {
    console.warn('[RBAC:DENIED]', JSON.stringify(logEntry));
  }
}

/**
 * Clear RBAC cache (for testing or admin operations)
 */
export function clearRBACCache(): void {
  // In a real implementation, clear cache from tenant-metadata.ts
  console.log('[RBAC] Cache cleared');
}
