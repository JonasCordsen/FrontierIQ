import type { NextApiRequest, NextApiResponse } from 'next';
import { jwtVerify, createRemoteJWKSet } from 'jose';

// Protected API endpoint that proxies the repo's current-state contract and enforces strict JWKS + role checks.
// Validates token signature, issuer, audience, and required role claim.

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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing bearer token' });
  }
  const incomingToken = auth.replace(/^Bearer\s+/i, '').trim();

  // Verify token signature and claims using JWKS
  try {
    const jwks = getJWKS();
    const verified = await jwtVerify(incomingToken, jwks, {
      issuer: `https://login.microsoftonline.com/${TENANT_ID}/v2.0`,
      audience: CLIENT_ID,
    });

    // Check for required role claim
    const claims = verified.payload as Record<string, any>;
    const roles = claims.roles || claims.role || [];
    const allowed = Array.isArray(roles) ? roles.includes('FrontierIQ.Admin') : roles === 'FrontierIQ.Admin';
    if (!allowed) {
      return res.status(403).json({ error: 'Insufficient role: FrontierIQ.Admin required' });
    }
  } catch (e) {
    const error = e as Error;
    console.error('Token verification failed:', error.message);
    return res.status(401).json({ error: 'Invalid or expired token' });
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

  // Import the current-state contract from the repo and execute it to build a snapshot.
  try {
    // @ts-ignore - dynamic import of .mjs file without type declarations
    const mod = await import('../../../src/observe/api/current-state-view-contract.mjs');
    const result = mod.executeCurrentStateViewCommand(['--json']);
    return res.status(200).json(result.snapshot);
  } catch (err) {
    const error = err as Error;
    console.error('Failed to build snapshot:', error.message);
    return res.status(500).json({ error: 'Failed to build snapshot' });
  }
}
