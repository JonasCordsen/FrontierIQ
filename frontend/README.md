FrontierIQ — Web UI (Fluent UI)

This folder contains a minimal Next.js + TypeScript scaffold using Fluent UI.

Quickstart

1. cd frontend
2. npm install
3. npm run dev

Notes
- This scaffold uses @fluentui/react-components; install deps before running.
- Integrate Entra (Azure AD) authentication via MSAL. Set the following environment variables in a .env.local file:

```
NEXT_PUBLIC_AZURE_CLIENT_ID=<your-client-id>
NEXT_PUBLIC_AZURE_TENANT_ID=<your-tenant-id>
NEXT_PUBLIC_AZURE_REDIRECT_URI=http://localhost:3000
```


- The API route /api/current-state returns a sample snapshot — wire this to the backend or the CLI viewer for real data.
