// Tenant metadata registry
// In production, replace this with a database lookup

import type { TenantMetadata } from './types';

/**
 * In-memory tenant registry
 * In production, this should be replaced with a database (Cosmos DB, PostgreSQL, etc.)
 * 
 * Key structure:
 *   tenantId -> TenantMetadata
 */
const tenantRegistry = new Map<string, TenantMetadata>();

// Cache for quick lookups (key: tenantId, value: { data, cachedAt })
const tenantCache = new Map<string, { data: TenantMetadata; cachedAt: number }>();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Register a tenant in the system
 * Used during onboarding or when adding a new tenant
 */
export function registerTenant(tenant: TenantMetadata): void {
  tenantRegistry.set(tenant.tenantId, tenant);
  tenantCache.delete(tenant.tenantId); // Invalidate cache
  console.log(`[RBAC] Registered tenant: ${tenant.tenantId} (${tenant.tenantName})`);
}

/**
 * Get tenant metadata by ID
 * Uses cache for performance
 */
export function getTenant(tenantId: string): TenantMetadata | null {
  // Check cache first
  const cached = tenantCache.get(tenantId);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return cached.data;
  }

  // Fall back to registry
  const tenant = tenantRegistry.get(tenantId);
  if (tenant) {
    tenantCache.set(tenantId, { data: tenant, cachedAt: Date.now() });
    return tenant;
  }

  return null;
}

/**
 * Update tenant metadata
 */
export function updateTenant(tenantId: string, updates: Partial<TenantMetadata>): TenantMetadata | null {
  const existing = tenantRegistry.get(tenantId);
  if (!existing) {
    return null;
  }

  const updated: TenantMetadata = {
    ...existing,
    ...updates,
    tenantId: existing.tenantId, // Don't allow changing ID
    createdAt: existing.createdAt, // Don't allow changing creation time
    updatedAt: new Date(),
  };

  tenantRegistry.set(tenantId, updated);
  tenantCache.delete(tenantId); // Invalidate cache
  console.log(`[RBAC] Updated tenant: ${tenantId}`);

  return updated;
}

/**
 * List all registered tenants
 */
export function listTenants(): TenantMetadata[] {
  return Array.from(tenantRegistry.values());
}

/**
 * Check if a user is an admin for a specific tenant
 */
export function isUserAdminForTenant(userId: string, groupIds: string[], tenantId: string): boolean {
  const tenant = getTenant(tenantId);
  if (!tenant) {
    return false;
  }

  // Check if user is in admin list
  if (tenant.adminUserIds.includes(userId)) {
    return true;
  }

  // Check if user is in any admin group
  return tenant.adminGroupIds.some((groupId) => groupIds.includes(groupId));
}

/**
 * Check if a user is a delegated admin
 * Delegated admins can manage other tenants
 */
export function isUserDelegatedAdmin(groupIds: string[]): boolean {
  // Get all tenants' delegated admin groups
  for (const tenant of listTenants()) {
    if (tenant.delegatedAdminGroupIds.some((groupId) => groupIds.includes(groupId))) {
      return true;
    }
  }
  return false;
}

/**
 * Get all tenants a user can access
 */
export function getTenantsByUser(userId: string, groupIds: string[]): TenantMetadata[] {
  const accessible: TenantMetadata[] = [];

  for (const tenant of listTenants()) {
    // Check if user is admin
    if (isUserAdminForTenant(userId, groupIds, tenant.tenantId)) {
      accessible.push(tenant);
    }
  }

  return accessible;
}

/**
 * Add a user to an admin group for a tenant
 */
export function addUserToAdminGroup(tenantId: string, userId: string): TenantMetadata | null {
  const tenant = getTenant(tenantId);
  if (!tenant) {
    return null;
  }

  if (!tenant.adminUserIds.includes(userId)) {
    tenant.adminUserIds.push(userId);
    updateTenant(tenantId, { adminUserIds: tenant.adminUserIds });
  }

  return tenant;
}

/**
 * Remove a user from an admin group for a tenant
 */
export function removeUserFromAdminGroup(tenantId: string, userId: string): TenantMetadata | null {
  const tenant = getTenant(tenantId);
  if (!tenant) {
    return null;
  }

  tenant.adminUserIds = tenant.adminUserIds.filter((id) => id !== userId);
  updateTenant(tenantId, { adminUserIds: tenant.adminUserIds });

  return tenant;
}

/**
 * Initialize with sample tenants for testing
 * Remove or modify this for production
 */
export function initializeSampleTenants(): void {
  const sampleTenants: TenantMetadata[] = [
    {
      tenantId: process.env.NEXT_PUBLIC_AZURE_TENANT_ID || 'common',
      tenantName: 'Default Tenant',
      adminGroupIds: [], // Will be populated from Entra groups
      adminUserIds: [], // Will be populated on first admin login
      delegatedAdminGroupIds: [],
      dataClassification: 'internal',
      retentionDays: 90,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  for (const tenant of sampleTenants) {
    if (!getTenant(tenant.tenantId)) {
      registerTenant(tenant);
    }
  }
}

// Export registry and cache for testing
export { tenantRegistry, tenantCache };
