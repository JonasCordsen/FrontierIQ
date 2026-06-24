/**
 * Entra auth validator — JWT token claim validation and permission binding.
 * Pillar: GOVERN
 *
 * Pure/deterministic: validates pre-decoded claim objects.
 * No HTTP, no crypto verification — expects claims already decoded by middleware.
 * Fail-closed: any missing or invalid claim → rejected.
 */

const REQUIRED_CLAIM_FIELDS = ['tid', 'oid', 'iss'];
const APP_PERMISSION_TYPE = 'application';
const DELEGATED_PERMISSION_TYPE = 'delegated';

/**
 * Classify whether a token uses application or delegated permissions.
 * Application tokens have `roles` claim and no `scp`.
 * Delegated tokens have `scp` claim.
 * @param {Object} claims - Decoded JWT claims
 * @returns {'application'|'delegated'|'unknown'}
 */
export function classifyPermissionType(claims) {
  if (!claims || typeof claims !== 'object') return 'unknown';
  const hasRoles = Array.isArray(claims.roles) && claims.roles.length > 0;
  const hasScp = typeof claims.scp === 'string' && claims.scp.trim().length > 0;
  if (hasScp) return DELEGATED_PERMISSION_TYPE;
  if (hasRoles) return APP_PERMISSION_TYPE;
  return 'unknown';
}

/**
 * Validate structural integrity of decoded Entra token claims.
 * Fail-closed: returns { valid: false } for any missing or malformed field.
 * @param {Object} claims
 * @param {string} expectedTenantId - Required tenant ID binding
 * @returns {{ valid: boolean, reason?: string }}
 */
export function validateTokenClaims(claims, expectedTenantId) {
  if (!claims || typeof claims !== 'object') {
    return { valid: false, reason: 'claims_missing' };
  }

  for (const field of REQUIRED_CLAIM_FIELDS) {
    if (!claims[field] || typeof claims[field] !== 'string') {
      return { valid: false, reason: `missing_claim_${field}` };
    }
  }

  if (!expectedTenantId || typeof expectedTenantId !== 'string') {
    return { valid: false, reason: 'expected_tenant_id_missing' };
  }

  if (claims.tid !== expectedTenantId) {
    return { valid: false, reason: 'tenant_id_mismatch' };
  }

  const permType = classifyPermissionType(claims);
  if (permType === 'unknown') {
    return { valid: false, reason: 'no_permissions_found' };
  }

  const now = Math.floor(Date.now() / 1000);
  if (typeof claims.exp === 'number' && claims.exp < now) {
    return { valid: false, reason: 'token_expired' };
  }

  return { valid: true, permissionType: permType };
}

/**
 * Extract granted scopes from a delegated token's scp claim.
 * Returns empty array if scp is absent or malformed.
 * @param {Object} claims
 * @returns {string[]}
 */
export function extractGrantedScopes(claims) {
  if (!claims || typeof claims.scp !== 'string') return [];
  return claims.scp.split(' ').filter(s => s.length > 0);
}

/**
 * Extract granted app roles from an application token's roles claim.
 * Returns empty array if roles is absent or not an array.
 * @param {Object} claims
 * @returns {string[]}
 */
export function extractGrantedRoles(claims) {
  if (!claims || !Array.isArray(claims.roles)) return [];
  return claims.roles.filter(r => typeof r === 'string' && r.length > 0);
}

/**
 * Validate that a token (application or delegated) covers all required permissions.
 * @param {Object} claims
 * @param {string[]} requiredPermissions - Scope strings or role names needed
 * @returns {{ authorized: boolean, missing: string[], permissionType: string }}
 */
export function authorizeTokenPermissions(claims, requiredPermissions) {
  if (!Array.isArray(requiredPermissions) || requiredPermissions.length === 0) {
    return { authorized: true, missing: [], permissionType: 'none' };
  }

  const permType = classifyPermissionType(claims);
  const granted =
    permType === DELEGATED_PERMISSION_TYPE
      ? extractGrantedScopes(claims)
      : extractGrantedRoles(claims);

  const missing = requiredPermissions.filter(p => !granted.includes(p));
  return {
    authorized: missing.length === 0,
    missing,
    permissionType: permType,
  };
}

/**
 * Full auth gate: validate claims, tenant binding, and required permissions.
 * Single entry point for fail-closed auth enforcement.
 * @param {Object} claims
 * @param {string} expectedTenantId
 * @param {string[]} requiredPermissions
 * @returns {{ allowed: boolean, reason?: string, permissionType?: string, missing?: string[] }}
 */
export function enforceAuthGate(claims, expectedTenantId, requiredPermissions) {
  const claimResult = validateTokenClaims(claims, expectedTenantId);
  if (!claimResult.valid) {
    return { allowed: false, reason: claimResult.reason };
  }

  const authResult = authorizeTokenPermissions(claims, requiredPermissions);
  if (!authResult.authorized) {
    return {
      allowed: false,
      reason: 'insufficient_permissions',
      permissionType: authResult.permissionType,
      missing: authResult.missing,
    };
  }

  return {
    allowed: true,
    permissionType: authResult.permissionType,
    missing: [],
  };
}
