import test from "node:test";
import assert from "node:assert/strict";

import { createIngestionScope } from "../../src/observe/ingestion/runtime-pipeline.mjs";
import {
  buildFoundryHandoffBatch,
} from "../../src/observe/ingestion/runtime-pipeline.mjs";
import {
  buildIndexingJobRequest,
  buildIndexedDocumentEnvelope,
  buildKnowledgeBaseDefinition,
  buildOneLakeSourceRegistration,
  buildQueryRequest,
  buildSearchIndexDefinition,
  buildSourceSecurityEnvelopesFromHandoff,
  normalizeQueryResponse,
  summarizeConnectorReadiness,
  validateAclSync,
  validateFoundryWorkspaceConfig,
  validatePurviewLabelEnforcement,
} from "../../src/observe/ingestion/foundry-iq-connector.mjs";

const scope = createIngestionScope({
  tenantId: "tenant-a",
  businessUnit: "it",
  environment: "prod",
  sourceSystem: "azure-ai-foundry",
  connectionId: "foundry-iq-prod",
});

const workspaceConfig = validateFoundryWorkspaceConfig({
  projectEndpoint: "https://frontieriq.services.ai.azure.com/api/projects/frontieriq",
  searchService: "frontieriq-search",
  defaultConnection: "frontieriq-default",
  identityType: "systemAssigned",
});

test("builds separate knowledge base, index, and OneLake source contracts", () => {
  const knowledgeBase = buildKnowledgeBaseDefinition({
    scope,
    workspaceConfig,
    knowledgeBaseName: "frontieriq-knowledge",
  });
  const indexDefinition = buildSearchIndexDefinition({
    scope,
    knowledgeBase,
    indexName: "frontieriq-index",
  });
  const source = buildOneLakeSourceRegistration({
    scope,
    workspaceConfig,
    sourceName: "onelake-files",
    fabricWorkspaceId: "00000000-0000-0000-0000-000000000000",
    lakehouseId: "11111111-1111-1111-1111-111111111111",
    shortcutOrFolder: "Files/frontieriq",
  });

  assert.equal(knowledgeBase.knowledgeBaseRef, "tenant-a/frontieriq-knowledge");
  assert.equal(indexDefinition.knowledgeBaseRef, knowledgeBase.knowledgeBaseRef);
  assert.equal(source.type, "onelake");
  assert.match(source.credentials.connectionString, /ResourceId=/);
});

test("builds indexing job from handoff batch and source security metadata", () => {
  const knowledgeBase = buildKnowledgeBaseDefinition({
    scope,
    workspaceConfig,
    knowledgeBaseName: "frontieriq-knowledge",
  });
  const indexDefinition = buildSearchIndexDefinition({
    scope,
    knowledgeBase,
    indexName: "frontieriq-index",
  });
  const source = buildOneLakeSourceRegistration({
    scope,
    workspaceConfig,
    sourceName: "onelake-files",
    fabricWorkspaceId: "00000000-0000-0000-0000-000000000000",
    lakehouseId: "11111111-1111-1111-1111-111111111111",
  });
  const handoff = buildFoundryHandoffBatch({
    scope,
    target: { knowledgeBaseId: "kb-1", indexName: "frontieriq-index" },
    stagedArtifacts: [
      {
        artifactId: "artifact-1",
        artifactUri: "onelake://frontieriq/observe/file.json",
        contentHash: "abc123",
      },
    ],
    processorVersion: "2026.06.1",
    createdAt: "2026-06-24T12:00:00Z",
    documents: [
      { id: "doc-1", title: "Doc 1", content: "content one" },
      { id: "doc-2", title: "Doc 2", content: "content two" },
    ],
  });
  const sourceDocuments = buildSourceSecurityEnvelopesFromHandoff({
    handoffBatch: handoff,
    sourceDefaults: {
      aclEntries: [
        { principalId: "group-1", principalType: "group", access: "read" },
        { principalId: "user-2", principalType: "user", access: "deny" },
      ],
      requiredPurviewLabelId: "purview/confidential",
      requiredPurviewLabelName: "Confidential",
      labelAppliedAt: "2026-06-24T12:00:00Z",
      lastModifiedAt: "2026-06-24T11:59:00Z",
    },
  });
  const job = buildIndexingJobRequest({
    scope,
    knowledgeBase,
    indexDefinition,
    sourceRegistration: source,
    handoffBatch: handoff,
    sourceDocuments,
  });

  assert.equal(job.documentCount, 2);
  assert.equal(job.sourceDocumentIds.length, 2);
  assert.equal(job.queryMode, "vectorHybrid");
});

test("acl and purview validation detect drift and stale label sync", () => {
  const sourceDocuments = buildSourceSecurityEnvelopesFromHandoff({
    handoffBatch: {
      sourceArtifacts: [{ artifactId: "artifact-1", artifactUri: "onelake://frontieriq/observe/file.json" }],
      documents: [{ id: "doc-1", title: "Doc 1", content: "content one" }],
    },
    sourceDefaults: {
      aclEntries: [
        { principalId: "group-1", principalType: "group", access: "read" },
        { principalId: "user-2", principalType: "user", access: "deny" },
      ],
      requiredPurviewLabelId: "purview/confidential",
      requiredPurviewLabelName: "Confidential",
      labelAppliedAt: "2026-06-24T12:00:00Z",
      lastModifiedAt: "2026-06-24T11:59:00Z",
    },
  });
  const indexedDocs = [
    buildIndexedDocumentEnvelope({
      documentId: "doc-1",
      chunkId: "doc-1#0",
      sourceDocumentId: "doc-1",
      sourceArtifactId: "artifact-1",
      sourceUri: "onelake://frontieriq/observe/file.json",
      title: "Doc 1",
      snippet: "content one",
      indexedAt: "2026-06-24T11:58:00Z",
      indexedContentHash: "other-hash",
      aclEntries: [{ principalId: "group-1", principalType: "group", access: "read" }],
      indexedLabelId: "purview/internal",
      indexedLabelName: "Internal",
    }),
  ];

  const acl = validateAclSync(sourceDocuments, indexedDocs);
  const purview = validatePurviewLabelEnforcement(sourceDocuments, indexedDocs);

  assert.equal(acl.ok, false);
  assert.ok(acl.mismatches.some((item) => item.code === "acl_hash_mismatch"));
  assert.ok(acl.mismatches.some((item) => item.code === "deny_precedence_lost"));
  assert.equal(purview.ok, false);
  assert.ok(purview.mismatches.some((item) => item.code === "label_mismatch"));
  assert.ok(purview.mismatches.some((item) => item.code === "stale_label_sync"));
});

test("query request and normalized query response preserve source refs and diagnostics", () => {
  const knowledgeBase = buildKnowledgeBaseDefinition({
    scope,
    workspaceConfig,
    knowledgeBaseName: "frontieriq-knowledge",
  });
  const indexDefinition = buildSearchIndexDefinition({
    scope,
    knowledgeBase,
    indexName: "frontieriq-index",
  });
  const request = buildQueryRequest({
    knowledgeBase,
    indexDefinition,
    queryText: "What scenarios apply to IT incident response?",
    principalIds: ["group-1"],
    labelFilterIds: ["purview/confidential"],
  });
  const response = normalizeQueryResponse({
    request,
    rawResponse: {
      answer: "Use the incident triage scenario.",
      latencyMs: 412,
      warnings: ["partial_result"],
      hits: [
        {
          documentId: "doc-1",
          chunkId: "doc-1#0",
          title: "Incident triage",
          snippet: "Reduce incident triage time",
          score: 0.93,
          sourceDocumentId: "doc-1",
          sourceArtifactId: "artifact-1",
          sourceUri: "onelake://frontieriq/observe/file.json",
          citations: ["https://example/scenario/1"],
          blocked: false,
          redacted: true,
          labelStatus: "enforced",
          enforcementReason: "purview_redaction",
        },
      ],
    },
  });

  assert.equal(response.queryId, request.queryId);
  assert.equal(response.hits[0].sourceDocumentId, "doc-1");
  assert.equal(response.hits[0].blocked, false);
  assert.equal(response.hits[0].redacted, true);
  assert.equal(response.hits[0].enforcementReason, "purview_redaction");
  assert.equal(response.diagnostics.redactedHitCount, 1);
  assert.equal(response.diagnostics.warnings[0], "partial_result");
});

test("connector readiness summarizes blocked and ready checks", () => {
  const readiness = summarizeConnectorReadiness({
    workspaceConfig,
    knowledgeBase: null,
    indexDefinition: null,
    sourceRegistration: null,
    indexingJob: null,
    aclValidation: { ok: false, mismatches: [{ code: "acl_hash_mismatch" }] },
    purviewValidation: { ok: true, mismatches: [] },
    queryRequest: null,
  });

  assert.equal(readiness.workspaceConfigValid.status, "ready");
  assert.equal(readiness.knowledgeBaseDefined.status, "blocked");
  assert.equal(readiness.aclSyncReady.reasonCodes[0], "acl_hash_mismatch");
  assert.equal(readiness.purviewEnforcementReady.status, "ready");
});
