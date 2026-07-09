FrontierIQ Web UI — Usage Guide

This guide covers running the local Fluent UI Next.js web UI scaffold and notes about authentication and deployment.

Quickstart (local)

1. cd frontend
2. npm install
3. Create .env.local with the following values:

```
NEXT_PUBLIC_AZURE_CLIENT_ID=<your-client-id>
NEXT_PUBLIC_AZURE_TENANT_ID=<your-tenant-id>
NEXT_PUBLIC_AZURE_REDIRECT_URI=http://localhost:3000
AZURE_CLIENT_SECRET=<your-client-secret>  # used only by server-side OBO flow
```

4. npm run dev
5. Visit http://localhost:3000 and sign in using the Sign in button.

Auth notes
- The client uses MSAL (msal-react) to sign in and acquire a user access token for User.Read.
- The protected API /api/protected-current-state uses an OBO exchange to obtain a backend access token (msal-node). Set AZURE_CLIENT_SECRET in environment.
- Role checking is scaffolded: tokens are decoded and must include the role 'FrontierIQ.Admin' to access the protected API. This is a scaffold — in production, validate JWTs with JWKS and enforce roles via verified claims.

Next steps
- Replace placeholders with real backend integration (Graph ingestion, telemetry store, etc.).
- Harden token validation, add server-side session management or cookie-based auth.
- Add RBAC UI, tenant onboarding flows, and a paginated Audit Log UI.

Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>
