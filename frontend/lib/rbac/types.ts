// RBAC type definitions for multi-tenant access control

/**
 * Tenant metadata — used to configure per-tenant access policies
 */
export interface TenantMetadata {
  tenantId: string;
  tenantName: string;
  adminGroupIds: string[]; // Entra group IDs that are admins for this tenant
  adminUserIds: string[]; // Entra user IDs that are admins for this tenant
  delegatedAdminGroupIds: string[]; // Groups allowed to manage other tenants
  dataClassification: 'public' | 'internal' | 'confidential'; // Data sensitivity
  retentionDays?: number; // Optional: data retention policy
  createdAt: Date;
  updatedAt: Date;
}

/**
 * User's role and access level within a tenant
 */
export interface UserRole {
  tenantId: string;
  userId: string;
  role: 'admin' | 'manager' | 'observer' | 'readonly';
  groupIds: string[]; // Groups the user belongs to in this tenant
  isDelegatedAdmin: boolean; // Can this user manage other tenants?
  accessLevel: AccessLevel;
  grantedAt: Date;
  expiresAt?: Date; // Optional: temporary access grant
}

/**
 * What data/operations a user can access
 */
export interface AccessLevel {
  // Data visibility
  canViewAgentActivity: boolean;
  canViewUsageMetrics: boolean;
  canViewSecurityEvents: boolean;
  canViewComplianceStatus: boolean;

  // Operations
  canManageGovernance: boolean;
  canManageSecurityPolicies: boolean;
  canManageUsers: boolean;
  canManageIntegrations: boolean;
  canExportData: boolean;

  // Delegated admin
  canManageOtherTenants: boolean;
  canApproveWaivers: boolean;
  canConfigurePolicies: boolean;
}

/**
 * User context extracted from token + RBAC lookup
 */
export interface UserContext {
  userId: string;
  upn: string; // user@tenant.onmicrosoft.com
  tenantId: string;
  groupIds: string[];
  roles: UserRole[];
  primaryRole: UserRole;
  isGlobalAdmin: boolean; // Entra global admin?
  isDelegatedAdmin: boolean; // FrontierIQ delegated admin?
  accessLevel: AccessLevel;
  tokenExpiresAt: number; // Token expiration timestamp
}

/**
 * RBAC decision result
 */
export interface RBACDecision {
  allowed: boolean;
  reason: string;
  userContext?: UserContext;
  tenantId?: string;
}

/**
 * Configuration for RBAC engine
 */
export interface RBACConfig {
  // Whether to enforce strict tenant isolation (false = allow global admins access)
  strictIsolation: boolean;

  // Whether to auto-allow Entra global admins
  allowGlobalAdmins: boolean;

  // Default role if user has no explicit role
  defaultRole: 'observer' | 'readonly';

  // Graph API settings
  graph?: {
    enabled: boolean;
    refreshIntervalMinutes: number;
  };

  // Caching
  cacheTenantMetadataMinutes: number;
  cacheUserRoleMinutes: number;
}

export const DEFAULT_RBAC_CONFIG: RBACConfig = {
  strictIsolation: true,
  allowGlobalAdmins: true,
  defaultRole: 'readonly',
  graph: {
    enabled: true,
    refreshIntervalMinutes: 60,
  },
  cacheTenantMetadataMinutes: 30,
  cacheUserRoleMinutes: 15,
};

/**
 * Default access level (minimal permissions)
 */
export const DEFAULT_ACCESS_LEVEL: AccessLevel = {
  canViewAgentActivity: false,
  canViewUsageMetrics: false,
  canViewSecurityEvents: false,
  canViewComplianceStatus: false,
  canManageGovernance: false,
  canManageSecurityPolicies: false,
  canManageUsers: false,
  canManageIntegrations: false,
  canExportData: false,
  canManageOtherTenants: false,
  canApproveWaivers: false,
  canConfigurePolicies: false,
};

/**
 * Role-based access level definitions
 */
export const ROLE_ACCESS_LEVELS: Record<string, AccessLevel> = {
  admin: {
    canViewAgentActivity: true,
    canViewUsageMetrics: true,
    canViewSecurityEvents: true,
    canViewComplianceStatus: true,
    canManageGovernance: true,
    canManageSecurityPolicies: true,
    canManageUsers: true,
    canManageIntegrations: true,
    canExportData: true,
    canManageOtherTenants: false,
    canApproveWaivers: true,
    canConfigurePolicies: true,
  },
  manager: {
    canViewAgentActivity: true,
    canViewUsageMetrics: true,
    canViewSecurityEvents: true,
    canViewComplianceStatus: true,
    canManageGovernance: true,
    canManageSecurityPolicies: false,
    canManageUsers: false,
    canManageIntegrations: false,
    canExportData: true,
    canManageOtherTenants: false,
    canApproveWaivers: false,
    canConfigurePolicies: false,
  },
  observer: {
    canViewAgentActivity: true,
    canViewUsageMetrics: true,
    canViewSecurityEvents: true,
    canViewComplianceStatus: true,
    canManageGovernance: false,
    canManageSecurityPolicies: false,
    canManageUsers: false,
    canManageIntegrations: false,
    canExportData: true,
    canManageOtherTenants: false,
    canApproveWaivers: false,
    canConfigurePolicies: false,
  },
  readonly: {
    canViewAgentActivity: false,
    canViewUsageMetrics: false,
    canViewSecurityEvents: false,
    canViewComplianceStatus: false,
    canManageGovernance: false,
    canManageSecurityPolicies: false,
    canManageUsers: false,
    canManageIntegrations: false,
    canExportData: false,
    canManageOtherTenants: false,
    canApproveWaivers: false,
    canConfigurePolicies: false,
  },
};
