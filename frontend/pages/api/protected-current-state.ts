import type { NextApiRequest, NextApiResponse } from 'next';

// Protected API endpoint that proxies the repo's current-state contract and enforces a basic OBO + role check.
// NOTE: This is a scaffold implementation. For production, validate tokens with JWKS and enforce strict verification.

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing bearer token' });
  }
  const incomingToken = auth.replace(/^Bearer\s+/i, '').trim();

  // Basic role check: decode token payload (UNVERIFIED) and inspect roles claim.
  try {
    const parts = incomingToken.split('.');
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    const roles = payload.roles || payload.role || [];
    const allowed = Array.isArray(roles) ? roles.includes('FrontierIQ.Admin') : roles === 'FrontierIQ.Admin';
    if (!allowed) {
      return res.status(403).json({ error: 'Insufficient role' });
    }
  } catch (e) {
    return res.status(400).json({ error: 'Invalid token format' });
  }

  // On-Behalf-Of: exchange incoming user token for a new token with MSAL Node (requires AZURE_CLIENT_SECRET env var)
  try {
    const { ConfidentialClientApplication } = await import('@azure/msal-node');
    const tenantId = process.env.NEXT_PUBLIC_AZURE_TENANT_ID || 'common';
    const clientId = process.env.NEXT_PUBLIC_AZURE_CLIENT_ID || '';
    const clientSecret = process.env.AZURE_CLIENT_SECRET || process.env.NEXT_PUBLIC_AZURE_CLIENT_SECRET || '';

    const cca = new ConfidentialClientApplication({
      auth: {
        clientId,
        authority: `https://login.microsoftonline.com/${tenantId}`,
        clientSecret,
      },
    });

    const oboRequest = {
      oboAssertion: incomingToken,
      scopes: ['https://graph.microsoft.com/.default'],
    };

    const tokenResponse = await cca.acquireTokenOnBehalfOf(oboRequest);
    if (!tokenResponse || !tokenResponse.accessToken) {
      // OBO failed; continue but mark as warning
      console.warn('OBO failed or returned no token');
    }
  } catch (err) {
    console.warn('OBO exchange failed', err);
    // continue — the scaffold still serves data but logs the warning; in prod, return 401/500.
  }

  // Import the current-state contract from the repo and execute it to build a snapshot.
  try {
    const mod = await import('../../../src/observe/api/current-state-view-contract.mjs');
    const result = mod.executeCurrentStateViewCommand(['--json']);
    return res.status(200).json(result.snapshot);
  } catch (err) {
    console.error('Failed to build snapshot', err);
    return res.status(500).json({ error: 'Failed to build snapshot' });
  }
}
