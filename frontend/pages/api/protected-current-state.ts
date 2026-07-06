import type { NextApiRequest, NextApiResponse } from 'next';
import path from 'node:path';
import { access } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { jwtVerify, createRemoteJWKSet } from 'jose';
import {
  extractUserContext,
  validateTenantAccess,
  logAuthorizationDecision,
  DEFAULT_RBAC_CONFIG,
  enrichUserContextWithGraph,
} from '../../lib/rbac';

// Protected API endpoint that proxies the repo's current-state contract.
// Primary auth path is SWA Easy Auth via x-ms-client-principal.
// Bearer token validation remains as a fallback for local/dev callers.
// RBAC is enforced per tenant after identity extraction.

const TENANT_ID = process.env.NEXT_PUBLIC_AZURE_TENANT_ID || 'common';
const CLIENT_ID = process.env.NEXT_PUBLIC_AZURE_CLIENT_ID || '';

// Cache JWKS for performance (expires after 1 hour by default)
let jwksCache: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJWKS() {
  if (!jwksCache) {
    const jwksUri = `https://login.microsoftonline.com/${TENANT_ID}/discovery/v2.0/keys`;
    jwksCache = createRemoteJWKSet(new URL(jwksUri));
  }
  return jwksCache;
}

type SWAClientPrincipal = {
  userId?: string;
  userDetails?: string;
  userRoles?: string[];
  claims?: Array<{ typ?: string; val?: string }>;
};

function readHeaderValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] || '';
  }
  return value || '';
}

function parseClientPrincipal(headerValue: string): SWAClientPrincipal | null {
  if (!headerValue) {
    return null;
  }

  try {
    const decoded = Buffer.from(headerValue, 'base64').toString('utf8');
    const parsed = JSON.parse(decoded) as SWAClientPrincipal;
    return parsed;
  } catch (error) {
    const err = error as Error;
    console.warn('Failed to parse x-ms-client-principal header:', err.message);
    return null;
  }
}

function getClaimValues(principal: SWAClientPrincipal, claimType: string): string[] {
  return (principal.claims || [])
    .filter((claim) => claim.typ === claimType && claim.val)
    .map((claim) => claim.val as string);
}

function createTokenLikeFromClientPrincipal(
  principal: SWAClientPrincipal,
  fallbackTenantId: string
): { payload: Record<string, any> } {
  const oid = getClaimValues(principal, 'oid')[0] || principal.userId || '';
  const sub = getClaimValues(principal, 'sub')[0] || oid;
  const preferredUsername =
    getClaimValues(principal, 'preferred_username')[0] ||
    getClaimValues(principal, 'upn')[0] ||
    principal.userDetails ||
    'unknown';
  const tenantId = getClaimValues(principal, 'tid')[0] || fallbackTenantId;
  const groups = getClaimValues(principal, 'groups');
  const appRoles = getClaimValues(principal, 'roles');
  const exp = Number(getClaimValues(principal, 'exp')[0] || 0);
  const principalRoles = (principal.userRoles || []).filter((role) =>
    !['anonymous', 'authenticated'].includes(role)
  );

  return {
    payload: {
      oid,
      sub,
      upn: preferredUsername,
      preferred_username: preferredUsername,
      tid: tenantId,
      groups,
      roles: Array.from(new Set([...appRoles, ...principalRoles])),
      exp,
    },
  };
}

async function loadCurrentStateContractModule() {
  const candidatePaths = [
    path.resolve(process.cwd(), '..', 'src', 'observe', 'api', 'current-state-view-contract.mjs'),
    path.resolve(process.cwd(), 'src', 'observe', 'api', 'current-state-view-contract.mjs'),
  ];

  for (const candidatePath of candidatePaths) {
    try {
      await access(candidatePath);
      return await import(pathToFileURL(candidatePath).href);
    } catch (err) {
      const error = err as NodeJS.ErrnoException;
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  throw new Error(
    `Current-state contract module not found in expected locations: ${candidatePaths.join(', ')}`
  );
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = req.headers.authorization || '';
  const clientPrincipal = parseClientPrincipal(readHeaderValue(req.headers['x-ms-client-principal']));
  let incomingToken = '';
  let verified: { payload: Record<string, any> } | null = null;
  let requestedTenantId = (req.query.tenantId as string) || TENANT_ID;

  // Prefer SWA Easy Auth principal when available.
  if (clientPrincipal) {
    const tokenLike = createTokenLikeFromClientPrincipal(clientPrincipal, requestedTenantId);
    requestedTenantId = tokenLike.payload.tid || requestedTenantId;
    verified = tokenLike;
  } else {
    // Fallback for local/dev callers using bearer tokens directly.
    if (!auth.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing authentication context' });
    }
    incomingToken = auth.replace(/^Bearer\s+/i, '').trim();

    try {
      const jwks = getJWKS();
      const verifiedJwt = await jwtVerify(incomingToken, jwks, {
        issuer: `https://login.microsoftonline.com/${TENANT_ID}/v2.0`,
        audience: CLIENT_ID,
      });
      verified = { payload: verifiedJwt.payload as Record<string, any> };
    } catch (e) {
      const error = e as Error;
      console.error('Token verification failed:', error.message);
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  }

  // Extract user context from token claims
  const userContext = verified ? extractUserContext(verified, requestedTenantId) : null;
  if (!userContext) {
    logAuthorizationDecision(
      {
        allowed: false,
        reason: 'Failed to extract user context from token',
        tenantId: requestedTenantId,
      },
      {
        endpoint: req.url || '/api/protected-current-state',
        method: 'GET',
        timestamp: new Date(),
      }
    );
    return res.status(401).json({ error: 'Failed to extract user information' });
  }

  // On-Behalf-Of: exchange incoming user token for a new token with MSAL Node (requires AZURE_CLIENT_SECRET env var)
  // This allows the backend to call Microsoft Graph APIs with the user's delegated permissions.
  let backendToken = readHeaderValue(req.headers['x-ms-token-aad-access-token']);
  if (!backendToken && incomingToken) {
    try {
      const { ConfidentialClientApplication } = await import('@azure/msal-node');
      const clientSecret = process.env.AZURE_CLIENT_SECRET || process.env.NEXT_PUBLIC_AZURE_CLIENT_SECRET || '';

      if (!clientSecret) {
        console.warn('AZURE_CLIENT_SECRET not configured; OBO exchange skipped');
      } else {
        const cca = new ConfidentialClientApplication({
          auth: {
            clientId: CLIENT_ID,
            authority: `https://login.microsoftonline.com/${TENANT_ID}`,
            clientSecret,
          },
        });

        const oboRequest = {
          oboAssertion: incomingToken,
          scopes: ['https://graph.microsoft.com/.default'],
        };

        const tokenResponse = await cca.acquireTokenOnBehalfOf(oboRequest);
        if (tokenResponse?.accessToken) {
          backendToken = tokenResponse.accessToken;
        } else {
          console.warn('OBO exchange succeeded but returned no access token');
        }
      }
    } catch (err) {
      const error = err as Error;
      console.warn('OBO exchange failed:', error.message);
      // Continue — the snapshot can still be built without a backend token.
      // In a production system with Graph API calls, you may want to return 500 or 401 here.
    }
  }

  // Enrich user context with Graph lookups when we have an OBO token.
  const effectiveUserContext = backendToken
    ? await enrichUserContextWithGraph(userContext, backendToken)
    : userContext;

  // Validate tenant access using RBAC engine.
  const rbacDecision = validateTenantAccess(effectiveUserContext, requestedTenantId, DEFAULT_RBAC_CONFIG);
  logAuthorizationDecision(rbacDecision, {
    endpoint: req.url || '/api/protected-current-state',
    method: 'GET',
    timestamp: new Date(),
  });

  if (!rbacDecision.allowed) {
    return res.status(403).json({
      error: 'Access denied',
      reason: rbacDecision.reason,
    });
  }

  // Build snapshot with tenant context
  // Pass user context and tenant info to the contract executor
  try {
    const mod = await loadCurrentStateContractModule();

    // Build snapshot with tenant-specific context
    const result = mod.executeCurrentStateViewCommand(['--json'], {
      tenantId: requestedTenantId,
      userId: effectiveUserContext.userId,
      userRole: effectiveUserContext.primaryRole.role,
      accessLevel: effectiveUserContext.accessLevel,
    });

    return res.status(200).json(result.snapshot);
  } catch (err) {
    const error = err as Error;
    console.error('Failed to build snapshot:', error.message);
    return res.status(500).json({ error: 'Failed to build snapshot' });
  }
}
