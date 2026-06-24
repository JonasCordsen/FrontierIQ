# Observe

Purpose: implement usage visibility, agent activity ingestion, and performance signal processing.

Implemented foundation (Phase 1 MVP):

- canonical Microsoft AI solution taxonomy (`foundation/solution-taxonomy.mjs`)
- normalized signal contract, runtime validation, and freshness rollups (`foundation/normalized-signal.mjs`)
- adapter contract and strict mapping results (`adapters/types.mjs`)
- focused adapters:
  - M365 Copilot
  - Copilot Studio
  - Azure AI Foundry
  - Fabric
- adapter registry (`adapters/index.mjs`)
- agent/skill registry builder, query helpers, and invocation rollups (`registry/agent-skill-registry.mjs`)
- scenario library adapter for use-case ingestion and signal projection (`adapters/scenario-library.mjs`)
- scenario library ingestion client/cycle/scheduler (`ingestion/scenario-library-ingestion.mjs`)
- Fabric IQ registration, ontology/data agent contracts, NL2Ontology validation, semantic-model access checks, and region readiness summary (`integration/fabric-iq.mjs`)
- Work IQ registration, OBO/delegated user-context access contracts, `WorkIQAgent.Ask` validation, and mail/calendar/Teams readiness checks (`integration/work-iq.mjs`)
- runtime ingestion pipeline contracts for webhook, delta reconciliation, Blob/OneLake staging, Foundry handoff, and telemetry (`ingestion/runtime-pipeline.mjs`)
- Foundry IQ connector contracts for knowledge base/index/source/query flows with ACL and Purview validation (`ingestion/foundry-iq-connector.mjs`)

Run unit tests:

```bash
node --test tests/observe/*.test.mjs
```
