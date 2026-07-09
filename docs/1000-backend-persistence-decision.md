# 1000-backend-persistence-decision — Backend Persistence Direction

## Purpose

Choose the first production persistence direction for FrontierIQ web and API
surfaces, aligned to the existing tenant repository contracts and the Azure-first
deployment path.

## Decision

Use **Azure Cosmos DB (NoSQL API, serverless to start)** as the primary
operational store for FrontierIQ control-plane metadata.

Do **not** persist raw Microsoft Graph payloads, prompt bodies, or other
customer-source records by default. Persist only FrontierIQ-owned metadata and
derived evidence that the platform needs to operate across sessions and tenants.

## Why Cosmos DB

### Stronger fit for the current product shape

FrontierIQ is already converging on:

- Azure Static Web Apps for hosting (`docs/DEPLOYMENT-AZURE-STATICWEB.md`)
- Entra-backed authentication and RBAC in the web/API layer
- tenant-scoped contracts in `src/govern/tenant/`
- future Azure-native integration points across Foundry, Graph, and policy
  operations

Cosmos DB keeps the control plane inside the same Azure governance, identity,
networking, and compliance boundary.

### Better match for multi-tenant operational metadata

The first persistence workload is not a relational business application with
heavy joins. It is primarily tenant-scoped operational state:

- tenant registry and onboarding status
- RBAC tenant metadata and delegated admin mappings
- policy baseline overrides and governance waivers
- audit traces and evidence summaries
- cached snapshot metadata and refresh bookkeeping

This data naturally partitions by `tenantId`, which maps well to a Cosmos DB
partition-key strategy.

### Enterprise posture over developer convenience

Supabase offers excellent developer velocity and first-class Postgres row-level
security, but it introduces a second control plane beside Azure. For FrontierIQ,
the stronger requirement is enterprise alignment:

- Azure-native identity, RBAC, and private networking options
- region and residency choices aligned to the rest of the solution
- straightforward path to multi-region scale later
- simpler story for Azure-first procurement and operations

## Why not Supabase as the primary store

Supabase remains a strong option for a fast MVP, especially when:

- direct browser-to-database access is desired
- Postgres RLS is the main authorization mechanism
- relational joins dominate the model
- vector search should live directly beside product data

However, for FrontierIQ today it has three downsides:

1. **Control-plane split** — auth and hosting are Azure-centric, while data
   governance would move elsewhere.
2. **Authorization duplication** — the app already enforces server-side tenant
   authorization, so database-level RLS is helpful but not the main control.
3. **Future Azure integration bias** — downstream integrations already point
   toward Azure-native operational boundaries.

## Scope of persisted data

### Persist now

- `tenantId`-partitioned tenant records
- onboarding lifecycle state
- FrontierIQ role/group mapping metadata
- policy exceptions, waiver lineage, and attestation state
- summary-level evidence references
- refresh checkpoints and correlation metadata

### Do not persist by default

- raw Graph API payloads
- full audit-event mirrors from source systems
- prompt bodies or user-generated free text unless explicitly approved later
- long-lived copies of access tokens

## Recommended data layout

### Container model

Start with separate logical containers, all partitioned by `tenantId`:

1. `tenant-registry`
2. `tenant-access`
3. `governance-waivers`
4. `evidence-summaries`
5. `refresh-checkpoints`

### Document conventions

- `id`: stable deterministic identifier per record
- `tenantId`: required partition key on all tenant-owned documents
- `type`: explicit record discriminator
- `updatedAt`: ISO timestamp
- `schemaVersion`: for forward-compatible evolution

## Application architecture recommendation

### Near-term

Keep persistence behind the existing repository/adapter pattern:

- current local contract: `src/govern/tenant/inmemory-tenant-repository.mjs`
- current snapshot contract:
  `src/govern/tenant/tenant-repository-persistence-adapter.mjs`

Add a Cosmos-backed adapter that maps the same validated repository record shape
to persisted documents.

### Execution path

- Keep Next.js API routes for the immediate web control plane
- Add a server-only Cosmos access layer from the API routes
- Introduce Azure Functions only when background jobs, scheduled refresh work,
  or long-running ingestion paths need to scale independently

## Vector and search posture

Do **not** choose the primary database based on vector support alone.

For FrontierIQ, vector or semantic retrieval should remain a later, separate
decision:

- use Cosmos DB only for operational metadata and checkpoints
- use Azure AI Search / Foundry-connected indexing later if tenant-safe semantic
  retrieval becomes a product requirement

This avoids overloading the operational store with a search concern that is not
yet proven in the current product surface.

## Recommendation summary

| Option | Verdict | Why |
| --- | --- | --- |
| Supabase | Good MVP alternative | Better developer speed and RLS, but weaker Azure control-plane alignment |
| Cosmos DB serverless | **Recommended now** | Stronger Azure-native multi-tenant operational fit, better enterprise posture, cleaner future Azure integration |

## Next implementation step

Create a Cosmos-backed tenant persistence slice that:

1. persists tenant registry records
2. persists RBAC tenant metadata
3. persists governance waiver and attestation metadata
4. keeps raw source payloads out of storage
5. preserves deterministic validation before write

## References

- Supabase Row Level Security:
  https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase vector columns / pgvector:
  https://supabase.com/docs/guides/ai/vector-columns
- Microsoft Learn — Multitenancy for vector search in Azure Cosmos DB
- Microsoft Learn — Azure Cosmos DB documentation for multitenancy, serverless,
  and global distribution guidance
