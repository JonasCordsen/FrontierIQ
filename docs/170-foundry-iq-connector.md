# Foundry IQ Connector

This slice prototypes the **Foundry connector layer** that sits on top of FrontierIQ's runtime ingestion contracts.

## Implemented modules

- `src/observe/ingestion/foundry-iq-connector.mjs`
  - `validateFoundryWorkspaceConfig()` validates the Foundry project + Azure AI Search connection contract.
  - `buildKnowledgeBaseDefinition()` defines the stable knowledge base resource.
  - `buildSearchIndexDefinition()` defines the searchable index separately from the knowledge base.
  - `buildOneLakeSourceRegistration()` models the OneLake data source registration using the workspace and lakehouse identifiers documented for Azure AI Search OneLake indexing.
  - `buildIndexingJobRequest()` converts staged/handoff artifacts into an indexing job contract.
  - `buildSourceDocumentSecurityEnvelope()` and `buildIndexedDocumentEnvelope()` model the security metadata required to validate ACL sync and Purview label enforcement.
  - `validateAclSync()` checks for hash mismatches, missing source docs, and deny-precedence loss.
  - `validatePurviewLabelEnforcement()` checks label mismatches and stale label propagation.
  - `buildQueryRequest()` and `normalizeQueryResponse()` model query execution and normalized result handling.
  - `summarizeConnectorReadiness()` returns machine-readable readiness checks for gating workflows.
  - `buildSourceSecurityEnvelopesFromHandoff()` bridges existing Foundry handoff batches into the connector's security metadata model.

## Design choices

- **Knowledge base and search index are separate contracts.** The knowledge base is the stable retrieval domain; the search index and indexing job are mutable runtime resources.
- **OneLake source registration is modeled independently.** This matches the documented AI Search data source pattern for OneLake files.
- **Security metadata is explicit.** ACL and Purview validation require source-level and indexed-level hashes and timestamps; they cannot be inferred from a basic document payload.
- **Query responses are normalized now.** That keeps later UI, audit, and enforcement work from depending on vendor-specific response shapes.

## Documentation basis

This prototype is aligned to Microsoft Learn guidance for:

- OneLake files indexed through Azure AI Search
- tenant-local permissions through managed identity and workspace role assignments
- metadata-based indexing and queryable source fields

## Test coverage

- `tests/observe/foundry-iq-connector.test.mjs`
