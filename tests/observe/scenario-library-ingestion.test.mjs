import test from "node:test";
import assert from "node:assert/strict";

import {
  buildScenarioIngestionSnapshot,
  buildScenarioRuntimeArtifacts,
  createScenarioLibraryClient,
  isDuplicateScenarioSnapshot,
  runScenarioLibraryRuntimePipeline,
  runScenarioLibraryIngestionCycle,
} from "../../src/observe/ingestion/scenario-library-ingestion.mjs";

const baseRows = [
  {
    cr974_name: "Reduce incident triage time",
    cr974_functionalareas: "Information Technology (IT)",
    cr974_scenarioleveleffortrating: "Build",
    cr974_assettype: "Scenario Slide",
    cr974_securitycopilot: "Y",
    cr974_microsoft365copilot: "Y",
    cr974_link: "https://example/download",
    cr974_demolink: "https://example/demo",
    cr974_promptsavailableincopilotlab: "Y",
    cr974_flw: "N",
  },
];

test("client uses expected endpoints", async () => {
  /** @type {string[]} */
  const urls = [];
  const client = createScenarioLibraryClient({
    baseUrl: "https://copilotscenarios.microsoft.com",
    fetchFn: async (url) => {
      urls.push(String(url));
      return {
        ok: true,
        json: async () => ({ value: [] }),
      };
    },
  });

  await client.fetchScenarioTable();
  assert.equal(
    urls[0],
    "https://copilotscenarios.microsoft.com/_api/cr974_copilotscenarios"
  );
});

test("snapshot builds tracker, signals, and selection summary", () => {
  const snapshot = buildScenarioIngestionSnapshot({
    tenantId: "tenant-a",
    businessUnit: "it",
    scenarioRows: baseRows,
    selectionLogic: {
      ScenarioOptions: [{ Options: [{ Name: "itArea" }, { Name: "securityArea" }] }],
    },
    nowIso: "2026-06-24T00:00:00Z",
  });

  assert.equal(snapshot.useCases.length, 1);
  assert.equal(snapshot.signals.length, 2);
  assert.equal(snapshot.selectionSummary.optionGroups, 1);
  assert.equal(snapshot.selectionSummary.totalOptions, 2);
  assert.equal(snapshot.tracker.items[0].status, "candidate");
});

test("dedupe detects unchanged snapshot", () => {
  const first = buildScenarioIngestionSnapshot({
    tenantId: "tenant-a",
    businessUnit: "it",
    scenarioRows: baseRows,
    selectionLogic: { ScenarioOptions: [] },
    nowIso: "2026-06-24T00:00:00Z",
  });
  const second = buildScenarioIngestionSnapshot({
    tenantId: "tenant-a",
    businessUnit: "it",
    scenarioRows: baseRows,
    selectionLogic: { ScenarioOptions: [] },
    nowIso: "2026-06-24T00:10:00Z",
  });
  assert.equal(isDuplicateScenarioSnapshot(first, second), true);
});

test("ingestion cycle reports duplicate against current snapshot", async () => {
  const client = createScenarioLibraryClient({
    baseUrl: "https://copilotscenarios.microsoft.com",
    fetchFn: async (url) => {
      if (String(url).includes("/_api/cr974_copilotscenarios")) {
        return { ok: true, json: async () => ({ value: baseRows }) };
      }
      return { ok: true, json: async () => ({ ScenarioOptions: [] }) };
    },
  });

  const first = await runScenarioLibraryIngestionCycle({
    tenantId: "tenant-a",
    businessUnit: "it",
    client,
    nowIso: "2026-06-24T00:00:00Z",
  });
  const second = await runScenarioLibraryIngestionCycle({
    tenantId: "tenant-a",
    businessUnit: "it",
    client,
    currentSnapshot: first.snapshot,
    nowIso: "2026-06-24T00:30:00Z",
  });
  assert.equal(first.duplicate, false);
  assert.equal(second.duplicate, true);
});

test("runtime artifacts stage raw snapshot and build Foundry handoff", () => {
  const result = buildScenarioRuntimeArtifacts({
    tenantId: "tenant-a",
    businessUnit: "it",
    environment: "prod",
    connectionId: "scenario-library-prod",
    scenarioRows: baseRows,
    selectionLogic: { ScenarioOptions: [] },
    storageConfig: {
      provider: "onelake",
      workspaceName: "frontieriq",
      lakehouseName: "observe",
    },
    foundryTarget: {
      knowledgeBaseId: "kb-scenarios",
      indexName: "frontieriq-scenario-library",
    },
    nowIso: "2026-06-24T02:00:00Z",
  });

  assert.equal(result.duplicate, false);
  assert.equal(result.rawArtifacts.length, 1);
  assert.equal(result.handoffBatch?.documentCount, 1);
  assert.equal(result.policyEvaluation.ok, true);
  assert.ok(result.policyEvaluation.matchedPolicyIds.includes("ingestion.approved-sources"));
  assert.equal(result.telemetry.counters.stagedArtifacts, 1);
  assert.equal(result.telemetry.customMetrics.generatedSignals, 2);
});

test("runtime pipeline suppresses duplicate writes while keeping telemetry", async () => {
  const client = createScenarioLibraryClient({
    baseUrl: "https://copilotscenarios.microsoft.com",
    fetchFn: async (url) => {
      if (String(url).includes("/_api/cr974_copilotscenarios")) {
        return { ok: true, json: async () => ({ value: baseRows }) };
      }
      return { ok: true, json: async () => ({ ScenarioOptions: [] }) };
    },
  });

  const first = await runScenarioLibraryRuntimePipeline({
    tenantId: "tenant-a",
    businessUnit: "it",
    environment: "prod",
    connectionId: "scenario-library-prod",
    client,
    storageConfig: {
      provider: "blob",
      accountName: "frontieriqraw",
      container: "observe",
    },
    foundryTarget: {
      knowledgeBaseId: "kb-scenarios",
      indexName: "frontieriq-scenario-library",
    },
    nowIso: "2026-06-24T03:00:00Z",
  });

  const second = await runScenarioLibraryRuntimePipeline({
    tenantId: "tenant-a",
    businessUnit: "it",
    environment: "prod",
    connectionId: "scenario-library-prod",
    client,
    currentSnapshot: first.snapshot,
    storageConfig: {
      provider: "blob",
      accountName: "frontieriqraw",
      container: "observe",
    },
    foundryTarget: {
      knowledgeBaseId: "kb-scenarios",
      indexName: "frontieriq-scenario-library",
    },
    nowIso: "2026-06-24T03:05:00Z",
  });

  assert.equal(first.rawArtifacts.length, 1);
  assert.equal(second.duplicate, true);
  assert.equal(second.rawArtifacts.length, 0);
  assert.equal(second.handoffBatch, null);
  assert.equal(second.policyEvaluation.ok, true);
  assert.equal(second.telemetry.counters.duplicateCount, 1);
});
