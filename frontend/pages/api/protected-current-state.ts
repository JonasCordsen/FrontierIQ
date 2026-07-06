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

// Protected API endpoint that proxies the repo's current-state contract
// Enforces strict JWKS token validation + server-side RBAC
// Validates token signature, issuer, audience, and role claims
// Enforces per-tenant access control

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
  if (!auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing bearer token' });
  }
  const incomingToken = auth.replace(/^Bearer\s+/i, '').trim();

  // Extract requested tenant from query parameter (defaults to TENANT_ID from env)
  const requestedTenantId = (req.query.tenantId as string) || TENANT_ID;

  // Verify token signature and claims using JWKS
  let verified: any;
  try {
    const jwks = getJWKS();
    verified = await jwtVerify(incomingToken, jwks, {
      issuer: `https://login.microsoftonline.com/${TENANT_ID}/v2.0`,
      audience: CLIENT_ID,
    });
  } catch (e) {
    const error = e as Error;
    console.error('Token verification failed:', error.message);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  // Extract user context from token claims
  const userContext = extractUserContext(verified, requestedTenantId);
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
  let backendToken: string | null = null;
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
