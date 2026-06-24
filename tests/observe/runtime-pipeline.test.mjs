import test from "node:test";
import assert from "node:assert/strict";

import {
  buildFoundryHandoffBatch,
  createIngestionScope,
  createRawStagedArtifact,
  createWebhookReceiver,
  planRawStorageTarget,
  runGraphDeltaReconciliation,
  summarizeIngestionRuntime,
} from "../../src/observe/ingestion/runtime-pipeline.mjs";

const scope = createIngestionScope({
  tenantId: "tenant-a",
  businessUnit: "it",
  environment: "prod",
  sourceSystem: "microsoft-graph",
  connectionId: "conn-1",
});

test("webhook receiver handles validation and produces tenant-scoped triggers", () => {
  const receiver = createWebhookReceiver({
    sourceSystem: "microsoft-graph",
    validateClientState: (clientState) => clientState === "expected-client-state",
    mapNotificationToScope: () => scope,
  });

  const validation = receiver.handleRequest({
    method: "GET",
    query: { validationToken: "abc123" },
  });
  assert.equal(validation.status, 200);
  assert.equal(validation.body, "abc123");

  const accepted = receiver.handleRequest({
    method: "POST",
    receivedAt: "2026-06-24T10:00:00Z",
    body: {
      value: [
        {
          id: "event-1",
          subscriptionId: "sub-1",
          clientState: "expected-client-state",
          resource: "users/delta",
        },
        {
          id: "event-2",
          subscriptionId: "sub-1",
          clientState: "invalid-state",
        },
      ],
    },
  });

  assert.equal(accepted.status, 202);
  assert.equal(accepted.triggers.length, 1);
  assert.equal(accepted.invalidNotifications.length, 1);
  assert.match(accepted.triggers[0].idempotencyKey, /tenant-a\|conn-1\|sub-1\|event-1/);
});

test("delta reconciliation advances checkpoint and captures page metrics", async () => {
  const pages = [
    {
      items: [{ id: "r1" }, { id: "r2" }],
      nextCursor: "next-1",
      pageId: "page-1",
    },
    {
      items: [{ id: "r3" }],
      deltaCursor: "delta-2",
      pageId: "page-2",
    },
  ];
  const result = await runGraphDeltaReconciliation({
    scope,
    checkpoint: null,
    client: {
      async fetchDeltaPage({ cursor }) {
        if (!cursor) return pages[0];
        return pages[1];
      },
    },
    nowIso: "2026-06-24T11:00:00Z",
  });

  assert.equal(result.items.length, 3);
  assert.equal(result.metrics.apiCalls, 2);
  assert.equal(result.checkpoint.cursorValue, "delta-2");
});

test("raw staging, foundry handoff, and telemetry summarize runtime cost and latency", () => {
  const storageTarget = planRawStorageTarget({
    scope,
    provider: "blob",
    accountName: "frontieriqraw",
    container: "observe",
    collectedAt: "2026-06-24T12:00:00Z",
    artifactName: "graph-delta-page",
  });
  const trigger = {
    ...scope,
    triggerType: "reconcile",
    receivedAt: "2026-06-24T12:00:00Z",
    correlationId: "corr-1",
    subscriptionId: null,
    eventId: null,
    cursorType: "deltaLink",
    cursorValue: "delta-1",
    payloadRef: null,
    idempotencyKey: "tenant-a|conn-1|deltaLink|delta-1",
  };
  const artifact = createRawStagedArtifact({
    scope,
    trigger,
    storageTarget,
    schemaKind: "graph-delta-page",
    payload: { records: [{ id: "r1" }, { id: "r2" }] },
    collectedAt: "2026-06-24T12:00:01Z",
  });
  const handoff = buildFoundryHandoffBatch({
    scope,
    target: { knowledgeBaseId: "kb-1", indexName: "frontieriq-graph" },
    stagedArtifacts: [artifact],
    processorVersion: "2026.06.1",
    documents: [{ id: "doc-1", title: "Record 1", content: "Sample content" }],
    createdAt: "2026-06-24T12:00:02Z",
  });
  const telemetry = summarizeIngestionRuntime({
    scope,
    trigger,
    startedAt: "2026-06-24T12:00:00Z",
    completedAt: "2026-06-24T12:00:03Z",
    stagedArtifacts: [artifact],
    handoffBatches: [handoff],
    apiCalls: 2,
    customMetrics: { recordsObserved: 2 },
  });

  assert.match(storageTarget.artifactUri, /blob\.core\.windows\.net/);
  assert.equal(artifact.recordCount, 2);
  assert.equal(handoff.documentCount, 1);
  assert.equal(telemetry.latency.endToEndMs, 3000);
  assert.equal(telemetry.counters.documentsIndexed, 1);
  assert.ok(telemetry.costs.totalEstimatedCost >= 0);
});

