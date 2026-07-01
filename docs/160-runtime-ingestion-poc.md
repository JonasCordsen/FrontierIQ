# Runtime Ingestion PoC

This slice extends FrontierIQ ingestion from an in-memory helper into a **runtime-oriented PoC contract** for webhook-driven and reconciliation-driven ingestion.

## Implemented modules

- `src/observe/ingestion/runtime-pipeline.mjs`
  - `createIngestionScope()` defines tenant, business-unit, environment, source-system, and connection boundaries.
  - `createIngestionTrigger()` creates shared idempotent envelopes for `webhook` and `reconcile` trigger modes.
  - `createWebhookReceiver()` handles Graph validation-token requests and normalizes webhook notifications into shared triggers.
  - `runGraphDeltaReconciliation()` models cursor-based delta paging and checkpoint advancement.
  - `planRawStorageTarget()` defines Blob/OneLake raw-storage destinations without coupling the repo to a hosting platform.
  - `createRawStagedArtifact()` produces the staged-artifact contract with retention, bytes, record counts, and content hashes.
  - `buildFoundryHandoffBatch()` defines the processor handoff payload for Azure AI Foundry indexing.
  - `summarizeIngestionRuntime()` measures latency, API calls, staged volume, indexed document volume, and estimated cost.

- `src/observe/ingestion/scenario-library-ingestion.mjs`
  - `buildScenarioFoundryDocuments()` converts normalized scenario use cases into Foundry-ready documents.
  - `buildScenarioRuntimeArtifacts()` stages Scenario Library snapshots into raw storage and Foundry handoff contracts.
  - `runScenarioLibraryRuntimePipeline()` wraps the existing client and snapshot builder in a runtime pipeline flow with duplicate suppression.

## Design choices

- **One shared trigger contract** for webhook and reconcile paths to avoid split logic.
- **Tenant-first partitioning** in every runtime contract.
- **Deployment-agnostic adapters** so the same core logic can later sit behind Azure Functions, Container Apps, or another runtime.
- **Short-term raw staging** with explicit retention metadata instead of indefinite storage.

## Test coverage

- `tests/observe/runtime-pipeline.test.mjs`
- updated `tests/observe/scenario-library-ingestion.test.mjs`
