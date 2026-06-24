import { createHash } from "node:crypto";

import { createIngestionScope } from "./runtime-pipeline.mjs";

const IDENTITY_TYPES = new Set(["systemAssigned", "userAssigned"]);
const QUERY_MODES = new Set(["keyword", "semantic", "vectorHybrid"]);
const PRINCIPAL_TYPES = new Set(["user", "group", "servicePrincipal"]);
const ACCESS_TYPES = new Set(["read", "deny"]);

/**
 * @param {Record<string, unknown>} input
 */
export function validateFoundryWorkspaceConfig(input) {
  /** @type {string[]} */
  const errors = [];

  if (typeof input.projectEndpoint !== "string" || !input.projectEndpoint.startsWith("https://")) {
    errors.push("projectEndpoint must be an https URL");
  }
  if (typeof input.searchService !== "string" || !input.searchService) {
    errors.push("searchService must be a non-empty string");
  }
  if (typeof input.defaultConnection !== "string" || !input.defaultConnection) {
    errors.push("defaultConnection must be a non-empty string");
  }
  if (!IDENTITY_TYPES.has(String(input.identityType))) {
    errors.push("identityType must be systemAssigned or userAssigned");
  }
  if (input.identityType === "userAssigned" &&
      (typeof input.identityResourceId !== "string" || !input.identityResourceId)) {
    errors.push("identityResourceId is required for userAssigned identities");
  }

  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      projectEndpoint: input.projectEndpoint,
      searchService: input.searchService,
      defaultConnection: input.defaultConnection,
      identityType: input.identityType,
      identityResourceId: input.identityResourceId ?? null,
      privateEndpointWorkspace: input.privateEndpointWorkspace ?? null,
    },
  };
}

/**
 * @param {{
 *   scope: ReturnType<typeof createIngestionScope>;
 *   workspaceConfig: ReturnType<typeof validateFoundryWorkspaceConfig> extends { ok: true; value: infer T } ? T : never;
 *   knowledgeBaseName: string;
 *   displayName?: string;
 *   description?: string;
 * }} input
 */
export function buildKnowledgeBaseDefinition(input) {
  const scope = createIngestionScope(input.scope);
  const workspaceConfig = requireWorkspaceConfig(input.workspaceConfig);
  if (!input.knowledgeBaseName) throw new Error("knowledgeBaseName is required");

  return {
    schemaVersion: "2026.06.1",
    knowledgeBaseRef: `${scope.tenantId}/${sanitizeName(input.knowledgeBaseName)}`,
    projectEndpoint: workspaceConfig.projectEndpoint,
    displayName: input.displayName ?? input.knowledgeBaseName,
    description:
      input.description ??
      `FrontierIQ knowledge base for ${scope.tenantId}/${scope.businessUnit}`,
    defaultConnection: workspaceConfig.defaultConnection,
  };
}

/**
 * @param {{
 *   scope: ReturnType<typeof createIngestionScope>;
 *   knowledgeBase: ReturnType<typeof buildKnowledgeBaseDefinition>;
 *   indexName: string;
 *   vectorProfileName?: string;
 * }} input
 */
export function buildSearchIndexDefinition(input) {
  const scope = createIngestionScope(input.scope);
  if (!input.knowledgeBase?.knowledgeBaseRef) {
    throw new Error("knowledgeBase definition is required");
  }
  if (!input.indexName) throw new Error("indexName is required");

  return {
    schemaVersion: "2026.06.1",
    indexRef: `${scope.tenantId}/${sanitizeName(input.indexName)}`,
    knowledgeBaseRef: input.knowledgeBase.knowledgeBaseRef,
    indexName: input.indexName,
    vectorProfileName: input.vectorProfileName ?? "default-vector-profile",
    fields: [
      { name: "documentId", type: "Edm.String", key: true, filterable: true },
      { name: "chunkId", type: "Edm.String", filterable: true },
      { name: "title", type: "Edm.String", searchable: true },
      { name: "content", type: "Edm.String", searchable: true },
      { name: "sourceUri", type: "Edm.String", filterable: true },
      { name: "sourceDocumentId", type: "Edm.String", filterable: true },
      { name: "purviewLabelId", type: "Edm.String", filterable: true },
      { name: "purviewLabelName", type: "Edm.String", filterable: true },
      { name: "aclHash", type: "Edm.String", filterable: true },
      { name: "contentHash", type: "Edm.String", filterable: true },
    ],
  };
}

/**
 * @param {{
 *   scope: ReturnType<typeof createIngestionScope>;
 *   workspaceConfig: ReturnType<typeof validateFoundryWorkspaceConfig> extends { ok: true; value: infer T } ? T : never;
 *   sourceName: string;
 *   fabricWorkspaceId: string;
 *   lakehouseId: string;
 *   shortcutOrFolder?: string;
 *   workspaceEndpoint?: string;
 * }} input
 */
export function buildOneLakeSourceRegistration(input) {
  const scope = createIngestionScope(input.scope);
  const workspaceConfig = requireWorkspaceConfig(input.workspaceConfig);
  if (!input.sourceName || !input.fabricWorkspaceId || !input.lakehouseId) {
    throw new Error("sourceName, fabricWorkspaceId, and lakehouseId are required");
  }

  const credentials = input.workspaceEndpoint
    ? `WorkspaceEndpoint=${input.workspaceEndpoint}`
    : `ResourceId=${input.fabricWorkspaceId}`;

  return {
    schemaVersion: "2026.06.1",
    sourceRef: `${scope.tenantId}/${sanitizeName(input.sourceName)}`,
    sourceName: input.sourceName,
    type: "onelake",
    credentials: { connectionString: credentials },
    container: {
      name: input.lakehouseId,
      query: input.shortcutOrFolder ?? null,
    },
    identity: workspaceConfig.identityType === "userAssigned"
      ? {
          type: "userAssigned",
          userAssignedIdentity: workspaceConfig.identityResourceId,
        }
      : { type: "systemAssigned" },
  };
}

/**
 * @param {{
 *   scope: ReturnType<typeof createIngestionScope>;
 *   knowledgeBase: ReturnType<typeof buildKnowledgeBaseDefinition>;
 *   indexDefinition: ReturnType<typeof buildSearchIndexDefinition>;
 *   sourceRegistration: ReturnType<typeof buildOneLakeSourceRegistration>;
 *   handoffBatch: {
 *     batchId: string;
 *     documents: Array<Record<string, unknown>>;
 *     sourceArtifacts: Array<{ artifactId: string; artifactUri: string; contentHash: string }>;
 *   };
 *   sourceDocuments: Array<ReturnType<typeof buildSourceDocumentSecurityEnvelope>>;
 *   queryMode?: "keyword"|"semantic"|"vectorHybrid";
 * }} input
 */
export function buildIndexingJobRequest(input) {
  const scope = createIngestionScope(input.scope);
  if (!input.knowledgeBase?.knowledgeBaseRef) throw new Error("knowledgeBase is required");
  if (!input.indexDefinition?.indexRef) throw new Error("indexDefinition is required");
  if (!input.sourceRegistration?.sourceRef) throw new Error("sourceRegistration is required");
  if (!input.handoffBatch?.batchId) throw new Error("handoffBatch is required");
  if (!QUERY_MODES.has(input.queryMode ?? "vectorHybrid")) {
    throw new Error("queryMode must be keyword|semantic|vectorHybrid");
  }

  return {
    schemaVersion: "2026.06.1",
    jobId: hashValue(
      [
        scope.tenantId,
        input.knowledgeBase.knowledgeBaseRef,
        input.indexDefinition.indexRef,
        input.handoffBatch.batchId,
      ].join("|")
    ).slice(0, 16),
    knowledgeBaseRef: input.knowledgeBase.knowledgeBaseRef,
    indexRef: input.indexDefinition.indexRef,
    sourceRef: input.sourceRegistration.sourceRef,
    sourceArtifactIds: input.handoffBatch.sourceArtifacts.map((artifact) => artifact.artifactId),
    documentCount: input.handoffBatch.documents.length,
    queryMode: input.queryMode ?? "vectorHybrid",
    sourceDocumentIds: input.sourceDocuments.map((item) => item.sourceDocumentId),
  };
}

/**
 * @param {{
 *   sourceDocumentId: string;
 *   sourceArtifactId: string;
 *   sourceUri: string;
 *   title: string;
 *   contentHash: string;
 *   lastModifiedAt: string;
 *   aclEntries: Array<{ principalId: string; principalType: "user"|"group"|"servicePrincipal"; access: "read"|"deny"; inherited?: boolean }>;
 *   requiredPurviewLabelId: string;
 *   requiredPurviewLabelName: string;
 *   labelAppliedAt: string;
 * }} input
 */
export function buildSourceDocumentSecurityEnvelope(input) {
  validateAclEntries(input.aclEntries);
  validateIsoDate(input.lastModifiedAt, "lastModifiedAt");
  validateIsoDate(input.labelAppliedAt, "labelAppliedAt");
  if (!input.sourceDocumentId || !input.sourceArtifactId || !input.sourceUri) {
    throw new Error("sourceDocumentId, sourceArtifactId, and sourceUri are required");
  }
  if (!input.requiredPurviewLabelId || !input.requiredPurviewLabelName) {
    throw new Error("requiredPurviewLabelId and requiredPurviewLabelName are required");
  }

  const aclHash = hashAclEntries(input.aclEntries);
  return {
    ...input,
    aclHash,
    aclVersion: aclHash.slice(0, 12),
  };
}

/**
 * @param {{
 *   documentId: string;
 *   chunkId: string;
 *   sourceDocumentId: string;
 *   sourceArtifactId: string;
 *   sourceUri: string;
 *   title: string;
 *   snippet: string;
 *   indexedAt: string;
 *   indexedContentHash: string;
 *   aclEntries: Array<{ principalId: string; principalType: "user"|"group"|"servicePrincipal"; access: "read"|"deny"; inherited?: boolean }>;
 *   indexedLabelId: string;
 *   indexedLabelName: string;
 *   securityTrimMode?: string;
 * }} input
 */
export function buildIndexedDocumentEnvelope(input) {
  validateAclEntries(input.aclEntries);
  validateIsoDate(input.indexedAt, "indexedAt");
  if (!input.documentId || !input.chunkId || !input.sourceDocumentId || !input.sourceArtifactId) {
    throw new Error("documentId, chunkId, sourceDocumentId, and sourceArtifactId are required");
  }
  if (!input.indexedLabelId || !input.indexedLabelName) {
    throw new Error("indexedLabelId and indexedLabelName are required");
  }
  return {
    ...input,
    indexedAclHash: hashAclEntries(input.aclEntries),
    securityTrimMode: input.securityTrimMode ?? "sourceAcl",
  };
}

/**
 * @param {Array<ReturnType<typeof buildSourceDocumentSecurityEnvelope>>} sourceDocuments
 * @param {Array<ReturnType<typeof buildIndexedDocumentEnvelope>>} indexedDocuments
 */
export function validateAclSync(sourceDocuments, indexedDocuments) {
  const sourceById = new Map(sourceDocuments.map((item) => [item.sourceDocumentId, item]));
  const mismatches = [];

  for (const indexed of indexedDocuments) {
    const source = sourceById.get(indexed.sourceDocumentId);
    if (!source) {
      mismatches.push({
        sourceDocumentId: indexed.sourceDocumentId,
        code: "missing_source_document",
      });
      continue;
    }
    if (source.aclHash !== indexed.indexedAclHash) {
      mismatches.push({
        sourceDocumentId: indexed.sourceDocumentId,
        code: "acl_hash_mismatch",
      });
    }
    const sourceDeny = source.aclEntries.some((entry) => entry.access === "deny");
    const indexedDeny = indexed.aclEntries.some((entry) => entry.access === "deny");
    if (sourceDeny && !indexedDeny) {
      mismatches.push({
        sourceDocumentId: indexed.sourceDocumentId,
        code: "deny_precedence_lost",
      });
    }
  }

  return {
    ok: mismatches.length === 0,
    mismatches,
  };
}

/**
 * @param {Array<ReturnType<typeof buildSourceDocumentSecurityEnvelope>>} sourceDocuments
 * @param {Array<ReturnType<typeof buildIndexedDocumentEnvelope>>} indexedDocuments
 */
export function validatePurviewLabelEnforcement(sourceDocuments, indexedDocuments) {
  const sourceById = new Map(sourceDocuments.map((item) => [item.sourceDocumentId, item]));
  const mismatches = [];

  for (const indexed of indexedDocuments) {
    const source = sourceById.get(indexed.sourceDocumentId);
    if (!source) continue;
    if (source.requiredPurviewLabelId !== indexed.indexedLabelId) {
      mismatches.push({
        sourceDocumentId: indexed.sourceDocumentId,
        code: "label_mismatch",
      });
    }
    if (Date.parse(indexed.indexedAt) < Date.parse(source.labelAppliedAt)) {
      mismatches.push({
        sourceDocumentId: indexed.sourceDocumentId,
        code: "stale_label_sync",
      });
    }
  }

  return {
    ok: mismatches.length === 0,
    mismatches,
  };
}

/**
 * @param {{
 *   knowledgeBase: ReturnType<typeof buildKnowledgeBaseDefinition>;
 *   indexDefinition: ReturnType<typeof buildSearchIndexDefinition>;
 *   queryText: string;
 *   principalIds?: string[];
 *   labelFilterIds?: string[];
 *   topK?: number;
 *   queryMode?: "keyword"|"semantic"|"vectorHybrid";
 * }} input
 */
export function buildQueryRequest(input) {
  if (!input.knowledgeBase?.knowledgeBaseRef || !input.indexDefinition?.indexRef) {
    throw new Error("knowledgeBase and indexDefinition are required");
  }
  if (!input.queryText) throw new Error("queryText is required");
  if (!QUERY_MODES.has(input.queryMode ?? "vectorHybrid")) {
    throw new Error("queryMode must be keyword|semantic|vectorHybrid");
  }

  return {
    queryId: hashValue(
      [
        input.knowledgeBase.knowledgeBaseRef,
        input.indexDefinition.indexRef,
        input.queryText,
        (input.principalIds ?? []).join(","),
        (input.labelFilterIds ?? []).join(","),
      ].join("|")
    ).slice(0, 16),
    knowledgeBaseRef: input.knowledgeBase.knowledgeBaseRef,
    indexRef: input.indexDefinition.indexRef,
    queryText: input.queryText,
    queryMode: input.queryMode ?? "vectorHybrid",
    filtersApplied: {
      principalIds: input.principalIds ?? [],
      labelFilterIds: input.labelFilterIds ?? [],
    },
    topK: input.topK ?? 5,
  };
}

/**
 * @param {{
 *   request: ReturnType<typeof buildQueryRequest>;
 *   rawResponse: {
 *     answer?: string;
 *     latencyMs?: number;
 *     warnings?: string[];
 *     hits?: Array<{
 *       documentId: string;
 *       chunkId: string;
 *       title: string;
 *       snippet: string;
 *       score: number;
 *       sourceDocumentId: string;
 *       sourceArtifactId: string;
 *       sourceUri: string;
 *       citations?: string[];
 *       blocked?: boolean;
 *       redacted?: boolean;
 *       labelStatus?: string;
 *       enforcementReason?: string;
 *     }>;
 *   };
 * }} input
 */
export function normalizeQueryResponse(input) {
  const hits = (input.rawResponse.hits ?? []).map((hit) => ({
    documentId: hit.documentId,
    chunkId: hit.chunkId,
    title: hit.title,
    snippet: hit.snippet,
    score: hit.score,
    sourceDocumentId: hit.sourceDocumentId,
    sourceArtifactId: hit.sourceArtifactId,
    sourceUri: hit.sourceUri,
    citations: hit.citations ?? [],
    blocked: hit.blocked ?? false,
    redacted: hit.redacted ?? false,
    labelStatus: hit.labelStatus ?? "unknown",
    enforcementReason: hit.enforcementReason ?? null,
  }));
  const blockedHitCount = (input.rawResponse.hits ?? []).filter((hit) => hit.blocked).length;
  const redactedHitCount = (input.rawResponse.hits ?? []).filter((hit) => hit.redacted).length;

  return {
    queryId: input.request.queryId,
    knowledgeBaseRef: input.request.knowledgeBaseRef,
    indexRef: input.request.indexRef,
    queryText: input.request.queryText,
    filtersApplied: input.request.filtersApplied,
    answer: input.rawResponse.answer ?? null,
    hits,
    diagnostics: {
      latencyMs: input.rawResponse.latencyMs ?? 0,
      blockedHitCount,
      redactedHitCount,
      warnings: input.rawResponse.warnings ?? [],
    },
  };
}

/**
 * @param {{
 *   workspaceConfig: ReturnType<typeof validateFoundryWorkspaceConfig>;
 *   knowledgeBase?: ReturnType<typeof buildKnowledgeBaseDefinition> | null;
 *   indexDefinition?: ReturnType<typeof buildSearchIndexDefinition> | null;
 *   sourceRegistration?: ReturnType<typeof buildOneLakeSourceRegistration> | null;
 *   indexingJob?: ReturnType<typeof buildIndexingJobRequest> | null;
 *   aclValidation?: ReturnType<typeof validateAclSync> | null;
 *   purviewValidation?: ReturnType<typeof validatePurviewLabelEnforcement> | null;
 *   queryRequest?: ReturnType<typeof buildQueryRequest> | null;
 * }} input
 */
export function summarizeConnectorReadiness(input) {
  return {
    workspaceConfigValid: makeCheck(input.workspaceConfig.ok, input.workspaceConfig.ok ? [] : input.workspaceConfig.errors),
    knowledgeBaseDefined: makeCheck(Boolean(input.knowledgeBase?.knowledgeBaseRef)),
    indexDefinitionReady: makeCheck(Boolean(input.indexDefinition?.indexRef)),
    sourceRegistrationValid: makeCheck(Boolean(input.sourceRegistration?.sourceRef)),
    indexingRequestReady: makeCheck(Boolean(input.indexingJob?.jobId)),
    aclSyncReady: makeCheck(input.aclValidation?.ok === true, input.aclValidation?.mismatches.map((item) => item.code) ?? []),
    purviewEnforcementReady: makeCheck(input.purviewValidation?.ok === true, input.purviewValidation?.mismatches.map((item) => item.code) ?? []),
    queryReady: makeCheck(Boolean(input.queryRequest?.queryId)),
  };
}

/**
 * @param {{
 *   handoffBatch: {
 *     documents: Array<Record<string, unknown>>;
 *     sourceArtifacts: Array<{ artifactId: string; artifactUri: string }>;
 *   };
 *   sourceDefaults: {
 *     aclEntries: Array<{ principalId: string; principalType: "user"|"group"|"servicePrincipal"; access: "read"|"deny"; inherited?: boolean }>;
 *     requiredPurviewLabelId: string;
 *     requiredPurviewLabelName: string;
 *     labelAppliedAt: string;
 *     lastModifiedAt: string;
 *   };
 * }} input
 */
export function buildSourceSecurityEnvelopesFromHandoff(input) {
  const primaryArtifact = input.handoffBatch.sourceArtifacts[0];
  return input.handoffBatch.documents.map((document) =>
    buildSourceDocumentSecurityEnvelope({
      sourceDocumentId: String(document.id),
      sourceArtifactId: primaryArtifact.artifactId,
      sourceUri: primaryArtifact.artifactUri,
      title: String(document.title ?? document.id),
      contentHash: hashValue(JSON.stringify(document)),
      lastModifiedAt: input.sourceDefaults.lastModifiedAt,
      aclEntries: input.sourceDefaults.aclEntries,
      requiredPurviewLabelId: input.sourceDefaults.requiredPurviewLabelId,
      requiredPurviewLabelName: input.sourceDefaults.requiredPurviewLabelName,
      labelAppliedAt: input.sourceDefaults.labelAppliedAt,
    })
  );
}

function requireWorkspaceConfig(config) {
  if (!config?.ok) {
    throw new Error(`invalid workspaceConfig: ${(config?.errors ?? []).join("; ")}`);
  }
  return config.value;
}

function validateAclEntries(entries) {
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error("aclEntries must be a non-empty array");
  }
  for (const entry of entries) {
    if (!entry.principalId) throw new Error("aclEntries principalId is required");
    if (!PRINCIPAL_TYPES.has(entry.principalType)) {
      throw new Error("aclEntries principalType is invalid");
    }
    if (!ACCESS_TYPES.has(entry.access)) {
      throw new Error("aclEntries access is invalid");
    }
  }
}

function validateIsoDate(value, fieldName) {
  if (Number.isNaN(Date.parse(value))) {
    throw new Error(`${fieldName} must be ISO-8601`);
  }
}

function hashAclEntries(entries) {
  const normalized = [...entries]
    .map((entry) => ({
      principalId: entry.principalId,
      principalType: entry.principalType,
      access: entry.access,
      inherited: entry.inherited ?? false,
    }))
    .sort((left, right) =>
      `${left.principalType}:${left.principalId}:${left.access}`.localeCompare(
        `${right.principalType}:${right.principalId}:${right.access}`
      )
    );
  return hashValue(JSON.stringify(normalized));
}

function hashValue(value) {
  return createHash("sha256").update(value).digest("hex");
}

function sanitizeName(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function makeCheck(ok, reasonCodes = []) {
  return {
    status: ok ? "ready" : "blocked",
    reasonCodes,
  };
}
