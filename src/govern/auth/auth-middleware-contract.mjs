/**
 * Auth middleware contract.
 * Pillar: GOVERN
 *
 * Bearer extraction and route-level authorization wrapper for host handlers.
 */

import { enforceAuthGate } from './entra-auth-validator.mjs';

/**
 * Extract bearer token from Authorization header.
 * @param {string|undefined|null} authorizationHeader
 * @returns {string|null}
 */
export function extractBearerToken(authorizationHeader) {
  if (typeof authorizationHeader !== 'string') return null;
  const trimmed = authorizationHeader.trim();
  if (!trimmed.toLowerCase().startsWith('bearer ')) return null;
  const token = trimmed.slice(7).trim();
  return token.length > 0 ? token : null;
}

/**
 * Authorize claims against expected tenant and route permissions.
 * @param {{ claims: object, expectedTenantId: string, requiredPermissions?: string[] }} input
 * @returns {{ allowed: boolean, reason?: string, missing?: string[] }}
 */
export function authorizeClaimsForRoute(input) {
  const requiredPermissions = Array.isArray(input?.requiredPermissions)
    ? input.requiredPermissions
    : [];
  return enforceAuthGate(input?.claims, input?.expectedTenantId, requiredPermissions);
}

/**
 * Build auth middleware decision payload from request contract.
 * @param {{ headers?: object, decodedClaims?: object, expectedTenantId?: string, route?: object }} request
 * @returns {{ allowed: boolean, reason?: string, tokenPresent: boolean, missing?: string[] }}
 */
export function authorizeRequest(request) {
  const authHeader = request?.headers?.authorization ?? request?.headers?.Authorization;
  const token = extractBearerToken(authHeader);
  if (!token) {
    return { allowed: false, reason: 'bearer_missing', tokenPresent: false };
  }

  const decision = authorizeClaimsForRoute({
    claims: request?.decodedClaims,
    expectedTenantId: request?.expectedTenantId,
    requiredPermissions: request?.route?.requiredPermissions ?? [],
  });
  if (!decision.allowed) {
    return {
      allowed: false,
      reason: decision.reason,
      tokenPresent: true,
      missing: decision.missing ?? [],
    };
  }
  return { allowed: true, tokenPresent: true };
}

/**
 * Wrap a route handler with auth guard.
 * @param {(input: object) => object} handler
 * @returns {(request: object) => object}
 */
export function withAuthGuard(handler) {
  return function guardedHandler(request) {
    const decision = authorizeRequest(request);
    if (!decision.allowed) {
      return {
        status: 'error',
        errors: [
          {
            code: decision.reason ?? 'unauthorized',
            message: 'Authorization failed',
          },
        ],
      };
    }
    return handler(request);
  };
}
