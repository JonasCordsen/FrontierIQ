# 890-signal-lineage-contract — Signal Lineage Contract

## Purpose

Deterministic source-to-action lineage graph for traceability from ingested
signals to generated actions.

## Pillar: OBSERVE

## Module

`src/observe/ingestion/signal-lineage-contract.mjs`

## API

| Function | Description |
| --- | --- |
| `buildSignalLineageGraph(signals, actions)` | Builds lineage nodes, edges, and unresolved links |
| `summarizeSignalLineage(graph)` | Summarizes lineage coverage and unresolved status |
| `buildSignalLineageEvidence(graph, generatedAt)` | Builds lineage evidence envelope |

## Tests

`tests/observe/signal-lineage-contract.test.mjs`

