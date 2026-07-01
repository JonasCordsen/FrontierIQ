import test from "node:test";
import assert from "node:assert/strict";

import { createIngestionScope } from "../../src/observe/ingestion/runtime-pipeline.mjs";
import {
  buildIndexedDocumentEnvelope,
  buildQueryRequest,
  buildSourceDocumentSecurityEnvelope,
  buildKnowledgeBaseDefinition,
  buildSearchIndexDefinition,
  normalizeQueryResponse,
} from "../../src/observe/ingestion/foundry-iq-connector.mjs";
import {
  buildIngestionOvershareAssessment,
  buildOvershareDetectorCatalog,
  buildQueryOvershareAssessment,
  evaluateOvershareEnforcement,
} from "../../src/secure/overshare/overshare-detection.mjs";

const scope = createIngestionScope({
  tenantId: "tenant-a",
  businessUnit: "it",
  environment: "prod",
  sourceSystem: "microsoft-graph",
  connectionId: "overshare-1",
});

const sourceDocuments = [
  buildSourceDocumentSecurityEnvelope({
    sourceDocumentId: "doc-1",
    sourceArtifactId: "artifact-1",
    sourceUri: "onelake://frontieriq/raw/doc-1.json",
    title: "Customer contacts",
    contentHash: "hash-doc-1",
    lastModifiedAt: "2026-06-24T12:00:00Z",
    aclEntries: [
      { principalId: "group-it", principalType: "group", access: "read" },
      { principalId: "user-blocked", principalType: "user", access: "deny" },
    ],
    requiredPurviewLabelId: "purview/confidential",
    requiredPurviewLabelName: "Confidential",
    labelAppliedAt: "2026-06-24T12:00:00Z",
  }),
  buildSourceDocumentSecurityEnvelope({
    sourceDocumentId: "doc-2",
    sourceArtifactId: "artifact-2",
    sourceUri: "onelake://frontieriq/raw/doc-2.json",
    title: "Operations summary",
    contentHash: "hash-doc-2",
    lastModifiedAt: "2026-06-24T12:00:00Z",
    aclEntries: [{ principalId: "group-it", principalType: "group", access: "read" }],
    requiredPurviewLabelId: "purview/internal",
    requiredPurviewLabelName: "Internal",
    labelAppliedAt: "2026-06-24T12:00:00Z",
  }),
];

const indexedDocuments = [
  buildIndexedDocumentEnvelope({
    documentId: "doc-1",
    chunkId: "doc-1#0",
    sourceDocumentId: "doc-1",
    sourceArtifactId: "artifact-1",
    sourceUri: "onelake://frontieriq/raw/doc-1.json",
    title: "Customer contacts",
    snippet: "Reach jane@contoso.com or jane@contoso.com for escalation",
    indexedAt: "2026-06-24T11:59:00Z",
    indexedContentHash: "idx-doc-1",
    aclEntries: [{ principalId: "group-it", principalType: "group", access: "read" }],
    indexedLabelId: "purview/public",
    indexedLabelName: "Public",
  }),
  buildIndexedDocumentEnvelope({
    documentId: "doc-2",
    chunkId: "doc-2#0",
    sourceDocumentId: "doc-2",
    sourceArtifactId: "artifact-2",
    sourceUri: "onelake://frontieriq/raw/doc-2.json",
    title: "Operations summary",
    snippet: "No customer data included",
    indexedAt: "2026-06-24T12:01:00Z",
    indexedContentHash: "idx-doc-2",
    aclEntries: [{ principalId: "group-it", principalType: "group", access: "read" }],
    indexedLabelId: "purview/internal",
    indexedLabelName: "Internal",
  }),
];

test("detector catalog exposes ingestion and query sample detectors", () => {
  const catalog = buildOvershareDetectorCatalog();

  assert.ok(catalog.some((detector) => detector.detectorId === "pii-source-content"));
  assert.ok(catalog.some((detector) => detector.detectorId === "query-hit-exposure"));
  assert.ok(catalog.every((detector) => detector.controls.length >= 1));
});

test("ingestion assessment deduplicates repeated pii and surfaces access and label drift", () => {
  const assessment = buildIngestionOvershareAssessment({
    scope,
    documents: [
      {
        id: "doc-1",
        title: "Customer contacts",
        content: "Reach jane@contoso.com or jane@contoso.com for escalation",
      },
      {
        id: "doc-2",
        title: "Operations summary",
        content: "No customer data included",
      },
    ],
    sourceDocuments,
    indexedDocuments,
    generatedAt: "2026-06-24T12:05:00Z",
  });

  assert.equal(assessment.sourcePiiFindings.length, 1);
  assert.equal(assessment.indexedPiiFindings.length, 1);
  assert.equal(assessment.summary.aclMismatchCount, 1);
  assert.equal(assessment.summary.denyPrecedenceLostCount, 1);
  assert.equal(assessment.summary.labelMismatchCount, 1);
  assert.equal(assessment.summary.staleLabelSyncCount, 1);
  assert.equal(assessment.documentFindings[0].sourceDocumentId, "doc-1");
  assert.equal(assessment.documentFindings[0].hasAclMismatch, true);
  assert.equal(assessment.documentFindings[0].hasLabelMismatch, true);
  assert.ok(assessment.controlIds.includes("access.least-privilege"));
  assert.ok(assessment.evidenceArtifacts.includes("evidence/overshare-incidents.ndjson"));
  assert.equal(assessment.severity, "high");
});

test("query assessment distinguishes blocked, redacted, and exposed hits", () => {
  const assessment = buildIngestionOvershareAssessment({
    scope,
    documents: [
      {
        id: "doc-1",
        title: "Customer contacts",
        content: "Reach jane@contoso.com for escalation",
      },
    ],
    sourceDocuments: [sourceDocuments[0]],
    indexedDocuments: [indexedDocuments[0]],
    generatedAt: "2026-06-24T12:05:00Z",
  });
  const knowledgeBase = buildKnowledgeBaseDefinition({
    scope,
    workspaceConfig: {
      ok: true,
      value: {
        projectEndpoint: "https://frontieriq.services.ai.azure.com/api/projects/frontieriq",
        searchService: "frontieriq-search",
        defaultConnection: "frontieriq-default",
        identityType: "systemAssigned",
        identityResourceId: null,
        privateEndpointWorkspace: null,
      },
    },
    knowledgeBaseName: "frontieriq-knowledge",
  });
  const indexDefinition = buildSearchIndexDefinition({
    scope,
    knowledgeBase,
    indexName: "frontieriq-index",
  });
  const queryRequest = buildQueryRequest({
    knowledgeBase,
    indexDefinition,
    queryText: "Show customer contacts",
    principalIds: ["group-it"],
    labelFilterIds: ["purview/confidential"],
  });
  const queryResponse = normalizeQueryResponse({
    request: queryRequest,
    rawResponse: {
      answer: "Contact jane@contoso.com for escalation",
      latencyMs: 350,
      warnings: ["partial_result"],
      hits: [
        {
          documentId: "doc-1",
          chunkId: "doc-1#0",
          title: "Customer contacts",
          snippet: "Reach jane@contoso.com for escalation",
          score: 0.92,
          sourceDocumentId: "doc-1",
          sourceArtifactId: "artifact-1",
          sourceUri: "onelake://frontieriq/raw/doc-1.json",
          blocked: false,
          redacted: false,
          labelStatus: "mismatch",
          enforcementReason: "acl_drift",
        },
        {
          documentId: "doc-1",
          chunkId: "doc-1#1",
          title: "Customer contacts",
          snippet: "Reach [REDACTED_EMAIL] for escalation",
          score: 0.88,
          sourceDocumentId: "doc-1",
          sourceArtifactId: "artifact-1",
          sourceUri: "onelake://frontieriq/raw/doc-1.json",
          blocked: false,
          redacted: true,
          labelStatus: "enforced",
        },
        {
          documentId: "doc-1",
          chunkId: "doc-1#2",
          title: "Customer contacts",
          snippet: "Reach jane@contoso.com for escalation",
          score: 0.83,
          sourceDocumentId: "doc-1",
          sourceArtifactId: "artifact-1",
          sourceUri: "onelake://frontieriq/raw/doc-1.json",
          blocked: true,
          redacted: false,
          labelStatus: "enforced",
        },
      ],
    },
  });
  const queryAssessment = buildQueryOvershareAssessment({
    queryRequest,
    queryResponse,
    sourceAssessment: assessment,
    generatedAt: "2026-06-24T12:06:00Z",
  });

  assert.equal(queryResponse.hits[0].blocked, false);
  assert.equal(queryResponse.hits[0].enforcementReason, "acl_drift");
  assert.equal(queryAssessment.summary.answerFindingCount, 1);
  assert.equal(queryAssessment.summary.exposedHitCount, 1);
  assert.equal(queryAssessment.summary.redactedHitCount, 1);
  assert.equal(queryAssessment.summary.blockedHitCount, 1);
  assert.equal(queryAssessment.summary.labelGapHitCount, 1);
  assert.equal(queryAssessment.actualExposure, true);
  assert.ok(queryAssessment.reasonCodes.includes("source_acl_drift_exposed"));
  assert.ok(queryAssessment.reasonCodes.includes("query_hit_pii_exposed"));
  assert.equal(queryAssessment.severity, "critical");
});

test("enforcement escalates from warning to throttle and suspend deterministically", () => {
  const warnDecision = evaluateOvershareEnforcement({
    incident: {
      assessmentId: "incident-low",
      stage: "ingestion",
      severity: "low",
      riskScore: 12,
      reasonCodes: ["pii_detected"],
      controlIds: ["data.pii-detection-redaction"],
      evidenceArtifacts: ["evidence/pii-detection-findings.ndjson"],
      actualExposure: false,
    },
  });
  const throttleDecision = evaluateOvershareEnforcement({
    incident: {
      assessmentId: "incident-high",
      stage: "query",
      severity: "high",
      riskScore: 72,
      reasonCodes: ["query_hit_pii_exposed", "source_acl_drift_exposed"],
      controlIds: ["data.pii-detection-redaction", "access.least-privilege"],
      evidenceArtifacts: ["evidence/overshare-incidents.ndjson"],
      actualExposure: true,
    },
    priorState: "warned",
    recurrenceCount: 0,
  });
  const suspendDecision = evaluateOvershareEnforcement({
    incident: {
      assessmentId: "incident-critical",
      stage: "query",
      severity: "critical",
      riskScore: 92,
      reasonCodes: ["query_hit_pii_exposed", "deny_precedence_lost"],
      controlIds: ["data.pii-detection-redaction", "access.least-privilege"],
      evidenceArtifacts: ["evidence/overshare-incidents.ndjson"],
      actualExposure: true,
    },
    priorState: "throttled",
    recurrenceCount: 2,
  });

  assert.equal(warnDecision.recommendedAction, "warn");
  assert.equal(warnDecision.nextState, "warned");
  assert.equal(throttleDecision.recommendedAction, "throttle");
  assert.equal(throttleDecision.automation.shouldThrottleQueries, true);
  assert.equal(suspendDecision.recommendedAction, "suspend");
  assert.equal(suspendDecision.automation.shouldSuspendConnector, true);
  assert.ok(suspendDecision.evidenceArtifacts.includes("evidence/overshare-enforcement-decisions.ndjson"));
});
