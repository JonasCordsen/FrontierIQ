# 1010-cosmos-tenant-repository — Cosmos Tenant Repository Contract

## Purpose

Define the deterministic mapping layer between FrontierIQ tenant repository
records and Azure Cosmos DB document operations.

## Pillar: GOVERN

## Module

`src/govern/tenant/cosmos-tenant-repository.mjs`

## Scope

This module does **not** bind directly to the Cosmos SDK. It provides pure
mapping and query builders so the persistence boundary remains testable and
fail-closed.

## API

| Function | Description |
| --- | --- |
| `validateCosmosRepositoryConfig(config)` | Validates endpoint, database, container, and `/tenantId` partition strategy |
| `buildCosmosContainerLayout(prefix)` | Returns the recommended FrontierIQ control-plane container layout |
| `mapTenantRecordToCosmosDocument(record)` | Converts a validated tenant record to a Cosmos document |
| `mapCosmosDocumentToTenantRecord(document)` | Restores a tenant record from a Cosmos document |
| `buildUpsertTenantOperation(config, record)` | Builds a deterministic upsert descriptor |
| `buildListTenantDocumentsQuery(config, options)` | Builds a tenant-scoped or all-tenants query descriptor |
| `hydrateRepositoryFromCosmosDocuments(documents)` | Reconstructs an in-memory repository from persisted documents |

## Document shape

- `id` = `tenant:<tenantId>`
- `tenantId` = partition key
- `type` = `tenant-registry-record`
- `schemaVersion`
- `updatedAt`
- `record`

## Container posture

Recommended control-plane containers:

1. `tenant-registry`
2. `tenant-access`
3. `governance-waivers`
4. `evidence-summaries`
5. `refresh-checkpoints`

All tenant-owned documents use `/tenantId` as the partition key path.

## Notes

- Fails closed on invalid records or document shapes.
- Keeps raw tenant-source payloads out of the operational store.
- Keeps the Cosmos persistence boundary aligned with the existing in-memory
  tenant repository and snapshot adapter contracts.

## Tests

`tests/govern/cosmos-tenant-repository.test.mjs`
