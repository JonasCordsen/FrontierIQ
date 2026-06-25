import test from "node:test";
import assert from "node:assert/strict";

import {
  buildSignalLineageGraph,
  summarizeSignalLineage,
  buildSignalLineageEvidence,
} from "../../src/observe/ingestion/signal-lineage-contract.mjs";

const signals = [
  { signalId: "s1", source: "graph", tenantId: "t1", signalType: "usage" },
  { signalId: "s2", source: "audit", tenantId: "t1", signalType: "risk" },
];
const actions = [
  { actionId: "a1", tenantId: "t1", linkedSignalIds: ["s1"] },
  { actionId: "a2", tenantId: "t1", linkedSignalIds: ["s3"] },
];

test("builds signal lineage graph with unresolved links", () => {
  const graph = buildSignalLineageGraph(signals, actions);
  assert.equal(graph.nodes.length, 4);
  assert.equal(graph.edges.length, 1);
  assert.equal(graph.unresolvedLinks.length, 1);
});

test("summarizes signal lineage status", () => {
  const summary = summarizeSignalLineage(buildSignalLineageGraph(signals, actions));
  assert.equal(summary.status, "blocked");
  assert.equal(summary.unresolvedLinks, 1);
});

test("builds signal lineage evidence", () => {
  const evidence = buildSignalLineageEvidence(buildSignalLineageGraph(signals, actions), "2026-01-01T00:00:00.000Z");
  assert.equal(evidence.artifactType, "signal-lineage");
});

