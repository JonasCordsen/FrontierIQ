# Fabric IQ integration

Implements issue #8 with deterministic contracts in `src/observe/integration/fabric-iq.mjs`.

## What is implemented

- `buildFabricIqToolRegistration()` models the Fabric IQ tool registration separately from agent connectivity and keeps `solutionId = fabric` while tracking `workload = fabric-iq`.
- `buildOntologyAgentContract()` and `buildDataAgentContract()` model the ontology agent and data agent as separate dependencies with independent readiness state.
- `buildFabricIqRegistryEntry()` produces a registry-compatible entry so Fabric IQ can be registered through the existing agent/skill registry layer.
- `validateNl2OntologyQuery()` validates NL2Ontology mappings against supported intents, entities, measures, confidence, and target semantic model.
- `validateSemanticModelAccess()` checks required-vs-granted permissions against workspace and semantic-model targets.
- `validateFabricIqRegionAvailability()` verifies tenant, workspace, semantic-model, and supported-region alignment.
- `summarizeFabricIqReadiness()` rolls the integration into a machine-readable ready/blocked summary.

## Contract boundaries

- **Registration** defines the Fabric IQ tool, workspace, semantic model, permissions, and supported regions.
- **Ontology agent** governs NL2Ontology translation capability.
- **Data agent** governs semantic-model connectivity and granted permissions.
- **Validation** stays split across query mapping, access, and region checks so partial failures are visible.

## Validation

- `tests/observe/fabric-iq.test.mjs`
