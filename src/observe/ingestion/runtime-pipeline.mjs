import { createHash } from "node:crypto";

const ENVIRONMENTS = new Set(["prod", "nonprod"]);
const TRIGGER_TYPES = new Set(["webhook", "reconcile"]);
const STORAGE_PROVIDERS = new Set(["blob", "onelake"]);
const RETENTION_CLASSES = new Set(["ephemeral", "short-term", "compliance"]);

/**
 * @typedef {{
 *   tenantId: string;
 *   businessUnit: string;
 *   environment: "prod"|"nonprod";
 *   sourceSystem: string;
 *   connectionId: string;
 * }} IngestionScope
 */

/**
 * @param {Record<string, unknown>} input
 * @returns {IngestionScope}
 */
export function createIngestionScope(input) {
  const required = ["tenantId", "businessUnit", "sourceSystem", "connectionId"];
  for (const field of required) {
    if (typeof input[field] !== "string" || !input[field]) {
      throw new Error(`${field} must be a non-empty string`);
    }
  }
  if (!ENVIRONMENTS.has(String(input.environment))) {
    throw new Error("environment must be prod or nonprod");
  }
  return /** @type {IngestionScope} */ ({
    tenantId: input.tenantId,
    businessUnit: input.businessUnit,
    environment: input.environment,
    sourceSystem: input.sourceSystem,
    connectionId: input.connectionId,
  });
}

/**
 * @param {{
 *   scope: IngestionScope;
 *   triggerType: "webhook"|"reconcile";
 *   receivedAt: string;
 *   correlationId?: string;
 *   subscriptionId?: string;
 *   eventId?: string;
 *   cursorType?: string;
 *   cursorValue?: string;
 *   payloadRef?: string;
 * }} input
 */
export function createIngestionTrigger(input) {
  const scope = createIngestionScope(input.scope);
  if (!TRIGGER_TYPES.has(input.triggerType)) {
    throw new Error("triggerType must be webhook or reconcile");
  }
  if (Number.isNaN(Date.parse(input.receivedAt))) {
    throw new Error("receivedAt must be ISO-8601");
  }
  const correlationId =
    input.correlationId ??
    hashValue([
      scope.tenantId,
      scope.connectionId,
      input.triggerType,
      input.subscriptionId ?? "",
      input.eventId ?? "",
      input.cursorType ?? "",
      input.cursorValue ?? "",
      input.receivedAt,
    ].join("|")).slice(0, 16);

  return {
    ...scope,
    triggerType: input.triggerType,
    receivedAt: input.receivedAt,
    correlationId,
    subscriptionId: input.subscriptionId ?? null,
    eventId: input.eventId ?? null,
    cursorType: input.cursorType ?? null,
    cursorValue: input.cursorValue ?? null,
    payloadRef: input.payloadRef ?? null,
    idempotencyKey: buildTriggerIdempotencyKey({
      scope,
      triggerType: input.triggerType,
      subscriptionId: input.subscriptionId,
      eventId: input.eventId,
      cursorType: input.cursorType,
      cursorValue: input.cursorValue,
    }),
  };
}

/**
 * @param {{
 *   sourceSystem: string;
 *   validateClientState?: (clientState: string | null) => boolean;
 *   mapNotificationToScope: (notification: Record<string, unknown>) => IngestionScope;
 * }} config
 */
export function createWebhookReceiver(config) {
  return {
    /**
     * @param {{
     *   method: string;
     *   query?: Record<string, string | undefined>;
     *   headers?: Record<string, string | undefined>;
     *   body?: Record<string, unknown>;
     *   receivedAt?: string;
     * }} request
     */
    handleRequest(request) {
      const validationToken = request.query?.validationToken;
      if (typeof validationToken === "string" && validationToken) {
        return {
          ok: true,
          status: 200,
          kind: "validation",
          body: validationToken,
        };
      }

      if (request.method !== "POST") {
        return {
          ok: false,
          status: 405,
          errors: ["webhook receiver only accepts POST"],
        };
      }

      const notifications = Array.isArray(request.body?.value)
        ? request.body.value
        : [];
      const receivedAt = request.receivedAt ?? new Date().toISOString();
      const triggers = [];
      const invalidNotifications = [];

      for (const notification of notifications) {
        const typed = /** @type {Record<string, unknown>} */ (notification);
        const clientState =
          typeof typed.clientState === "string" ? typed.clientState : null;
        if (config.validateClientState && !config.validateClientState(clientState)) {
          invalidNotifications.push({
            notificationId: typed.id ?? null,
            reason: "invalid_client_state",
          });
          continue;
        }

        const scope = config.mapNotificationToScope(typed);
        triggers.push(
          createIngestionTrigger({
            scope,
            triggerType: "webhook",
            receivedAt,
            subscriptionId:
              typeof typed.subscriptionId === "string" ? typed.subscriptionId : undefined,
            eventId: typeof typed.id === "string" ? typed.id : undefined,
            payloadRef: typeof typed.resource === "string" ? typed.resource : null,
          })
        );
      }

      return {
        ok: true,
        status: 202,
        kind: "accepted",
        triggers,
        invalidNotifications,
      };
    },
  };
}

/**
 * @param {{
 *   scope: IngestionScope;
 *   checkpoint?: { cursorType: string; cursorValue: string; checkpointedAt: string } | null;
 *   client: {
 *     fetchDeltaPage: (input: { cursor: string | null }) => Promise<{
 *       items: Array<Record<string, unknown>>;
 *       nextCursor?: string | null;
 *       deltaCursor?: string | null;
 *       pageId?: string | null;
 *     }>;
 *   };
 *   nowIso?: string;
 * }} input
 */
export async function runGraphDeltaReconciliation(input) {
  const scope = createIngestionScope(input.scope);
  const receivedAt = input.nowIso ?? new Date().toISOString();
  const trigger = createIngestionTrigger({
    scope,
    triggerType: "reconcile",
    receivedAt,
    cursorType: input.checkpoint?.cursorType ?? "deltaLink",
    cursorValue: input.checkpoint?.cursorValue ?? "initial",
  });

  /** @type {Array<Record<string, unknown>>} */
  const items = [];
  /** @type {string[]} */
  const pageKeys = [];
  let cursor = input.checkpoint?.cursorValue ?? null;
  let nextCursor = null;
  let deltaCursor = input.checkpoint?.cursorValue ?? null;
  let apiCalls = 0;

  do {
    const page = await input.client.fetchDeltaPage({ cursor });
    apiCalls += 1;
    items.push(...(Array.isArray(page.items) ? page.items : []));
    const pageKey = hashValue(
      [
        scope.tenantId,
        scope.connectionId,
        page.pageId ?? "",
        page.nextCursor ?? "",
        page.deltaCursor ?? "",
      ].join("|")
    );
    pageKeys.push(pageKey);
    nextCursor = page.nextCursor ?? null;
    if (page.deltaCursor) {
      deltaCursor = page.deltaCursor;
    }
    cursor = nextCursor;
  } while (cursor);

  return {
    trigger,
    items,
    checkpoint: {
      tenantId: scope.tenantId,
      connectionId: scope.connectionId,
      cursorType: "deltaLink",
      cursorValue: deltaCursor ?? "initial",
      checkpointedAt: receivedAt,
    },
    metrics: {
      apiCalls,
      pageCount: pageKeys.length,
      recordCount: items.length,
      duplicatePageCount: pageKeys.length - new Set(pageKeys).size,
    },
  };
}

/**
 * @param {{
 *   scope: IngestionScope;
 *   provider: "blob"|"onelake";
 *   rootPath?: string;
 *   accountName?: string;
 *   container?: string;
 *   workspaceName?: string;
 *   lakehouseName?: string;
 *   collectedAt?: string;
 *   artifactName: string;
 *   extension?: string;
 * }} input
 */
export function planRawStorageTarget(input) {
  const scope = createIngestionScope(input.scope);
  if (!STORAGE_PROVIDERS.has(input.provider)) {
    throw new Error("provider must be blob or onelake");
  }
  const collectedAt = input.collectedAt ?? new Date().toISOString();
  if (Number.isNaN(Date.parse(collectedAt))) {
    throw new Error("collectedAt must be ISO-8601");
  }
  const timestampPath = collectedAt.replace(/[:.]/g, "-");
  const extension = input.extension ?? "json";
  const rootPath = (input.rootPath ?? "raw").replace(/^\/+|\/+$/g, "");
  const artifactPath =
    `${rootPath}/${scope.tenantId}/${scope.environment}/${scope.connectionId}/${timestampPath}-${sanitizePathSegment(input.artifactName)}.${extension}`;

  if (input.provider === "blob") {
    if (!input.accountName || !input.container) {
      throw new Error("blob storage requires accountName and container");
    }
    return {
      provider: "blob",
      artifactPath,
      artifactUri: `https://${input.accountName}.blob.core.windows.net/${input.container}/${artifactPath}`,
    };
  }

  if (!input.workspaceName || !input.lakehouseName) {
    throw new Error("onelake storage requires workspaceName and lakehouseName");
  }
  return {
    provider: "onelake",
    artifactPath,
    artifactUri: `onelake://${input.workspaceName}/${input.lakehouseName}/Files/${artifactPath}`,
  };
}

/**
 * @param {{
 *   scope: IngestionScope;
 *   trigger: ReturnType<typeof createIngestionTrigger>;
 *   storageTarget: ReturnType<typeof planRawStorageTarget>;
 *   schemaKind: string;
 *   payload: Record<string, unknown>;
 *   collectedAt?: string;
 *   retentionDays?: number;
 *   retentionClass?: "ephemeral"|"short-term"|"compliance";
 * }} input
 */
export function createRawStagedArtifact(input) {
  const scope = createIngestionScope(input.scope);
  const collectedAt = input.collectedAt ?? new Date().toISOString();
  if (Number.isNaN(Date.parse(collectedAt))) {
    throw new Error("collectedAt must be ISO-8601");
  }
  if (!RETENTION_CLASSES.has(input.retentionClass ?? "ephemeral")) {
    throw new Error("retentionClass must be ephemeral|short-term|compliance");
  }
  const serialized = JSON.stringify(input.payload);
  const byteCount = Buffer.byteLength(serialized);
  const contentHash = hashValue(serialized);
  const retentionDays = input.retentionDays ?? 7;
  const expiresAt = new Date(Date.parse(collectedAt) + retentionDays * 24 * 60 * 60 * 1000)
    .toISOString();

  return {
    schemaVersion: "2026.06.1",
    artifactId: `${scope.connectionId}-${contentHash.slice(0, 12)}`,
    tenantId: scope.tenantId,
    businessUnit: scope.businessUnit,
    environment: scope.environment,
    sourceSystem: scope.sourceSystem,
    connectionId: scope.connectionId,
    triggerType: input.trigger.triggerType,
    triggerIdempotencyKey: input.trigger.idempotencyKey,
    schemaKind: input.schemaKind,
    collectedAt,
    retentionClass: input.retentionClass ?? "ephemeral",
    expiresAt,
    byteCount,
    contentHash,
    recordCount: countRecords(input.payload),
    artifactPath: input.storageTarget.artifactPath,
    artifactUri: input.storageTarget.artifactUri,
  };
}

/**
 * @param {{
 *   scope: IngestionScope;
 *   target: { knowledgeBaseId: string; indexName: string };
 *   stagedArtifacts: Array<ReturnType<typeof createRawStagedArtifact>>;
 *   processorVersion: string;
 *   documents: Array<Record<string, unknown>>;
 *   createdAt?: string;
 * }} input
 */
export function buildFoundryHandoffBatch(input) {
  const scope = createIngestionScope(input.scope);
  if (!input.target?.knowledgeBaseId || !input.target?.indexName) {
    throw new Error("Foundry target requires knowledgeBaseId and indexName");
  }
  const createdAt = input.createdAt ?? new Date().toISOString();
  if (Number.isNaN(Date.parse(createdAt))) {
    throw new Error("createdAt must be ISO-8601");
  }
  const serialized = JSON.stringify(input.documents);
  const byteCount = Buffer.byteLength(serialized);
  const contentHash = hashValue(serialized);

  return {
    schemaVersion: "2026.06.1",
    batchId: `${scope.connectionId}-${contentHash.slice(0, 12)}`,
    tenantId: scope.tenantId,
    businessUnit: scope.businessUnit,
    environment: scope.environment,
    sourceSystem: scope.sourceSystem,
    connectionId: scope.connectionId,
    knowledgeBaseId: input.target.knowledgeBaseId,
    indexName: input.target.indexName,
    processorVersion: input.processorVersion,
    createdAt,
    sourceArtifacts: input.stagedArtifacts.map((artifact) => ({
      artifactId: artifact.artifactId,
      artifactUri: artifact.artifactUri,
      contentHash: artifact.contentHash,
    })),
    documentCount: input.documents.length,
    byteCount,
    contentHash,
    documents: input.documents,
  };
}

/**
 * @param {{
 *   scope: IngestionScope;
 *   trigger: ReturnType<typeof createIngestionTrigger>;
 *   startedAt: string;
 *   completedAt: string;
 *   stagedArtifacts?: Array<ReturnType<typeof createRawStagedArtifact>>;
 *   handoffBatches?: Array<ReturnType<typeof buildFoundryHandoffBatch>>;
 *   apiCalls?: number;
 *   duplicateCount?: number;
 *   failureCount?: number;
 *   customMetrics?: Record<string, number | boolean | string>;
 *   pricing?: {
 *     storagePerGbMonth?: number;
 *     storageWriteOperation?: number;
 *     foundryDocumentsPerThousand?: number;
 *     graphApiCall?: number;
 *   };
 * }} input
 */
export function summarizeIngestionRuntime(input) {
  const scope = createIngestionScope(input.scope);
  const stagedArtifacts = input.stagedArtifacts ?? [];
  const handoffBatches = input.handoffBatches ?? [];
  const totalStagedBytes = stagedArtifacts.reduce((sum, artifact) => sum + artifact.byteCount, 0);
  const totalHandoffBytes = handoffBatches.reduce((sum, batch) => sum + batch.byteCount, 0);
  const totalDocuments = handoffBatches.reduce((sum, batch) => sum + batch.documentCount, 0);
  const startedAtMs = Date.parse(input.startedAt);
  const completedAtMs = Date.parse(input.completedAt);
  const receivedAtMs = Date.parse(input.trigger.receivedAt);
  if ([startedAtMs, completedAtMs, receivedAtMs].some((value) => Number.isNaN(value))) {
    throw new Error("runtime timestamps must be ISO-8601");
  }

  const pricing = {
    storagePerGbMonth: input.pricing?.storagePerGbMonth ?? 0.0184,
    storageWriteOperation: input.pricing?.storageWriteOperation ?? 0.000005,
    foundryDocumentsPerThousand: input.pricing?.foundryDocumentsPerThousand ?? 0.12,
    graphApiCall: input.pricing?.graphApiCall ?? 0,
  };
  const stagedGigabytes = totalStagedBytes / (1024 * 1024 * 1024);
  const storageMonthlyCost = Number((stagedGigabytes * pricing.storagePerGbMonth).toFixed(6));
  const storageOperationCost = Number(
    (stagedArtifacts.length * pricing.storageWriteOperation).toFixed(6)
  );
  const foundryIndexingCost = Number(
    ((totalDocuments / 1000) * pricing.foundryDocumentsPerThousand).toFixed(6)
  );
  const graphApiCost = Number(((input.apiCalls ?? 0) * pricing.graphApiCall).toFixed(6));

  return {
    schemaVersion: "2026.06.1",
    tenantId: scope.tenantId,
    businessUnit: scope.businessUnit,
    environment: scope.environment,
    sourceSystem: scope.sourceSystem,
    connectionId: scope.connectionId,
    latency: {
      triggerToStartMs: Math.max(startedAtMs - receivedAtMs, 0),
      processingMs: Math.max(completedAtMs - startedAtMs, 0),
      endToEndMs: Math.max(completedAtMs - receivedAtMs, 0),
    },
    counters: {
      apiCalls: input.apiCalls ?? 0,
      duplicateCount: input.duplicateCount ?? 0,
      failureCount: input.failureCount ?? 0,
      stagedArtifacts: stagedArtifacts.length,
      handoffBatches: handoffBatches.length,
      documentsIndexed: totalDocuments,
    },
    volumes: {
      stagedBytes: totalStagedBytes,
      handoffBytes: totalHandoffBytes,
    },
    costs: {
      storageMonthlyCost,
      storageOperationCost,
      foundryIndexingCost,
      graphApiCost,
      totalEstimatedCost: Number(
        (storageMonthlyCost + storageOperationCost + foundryIndexingCost + graphApiCost).toFixed(6)
      ),
    },
    customMetrics: input.customMetrics ?? {},
  };
}

function buildTriggerIdempotencyKey(input) {
  if (input.triggerType === "webhook") {
    return [
      input.scope.tenantId,
      input.scope.connectionId,
      input.subscriptionId ?? "subscription",
      input.eventId ?? "event",
    ].join("|");
  }
  return [
    input.scope.tenantId,
    input.scope.connectionId,
    input.cursorType ?? "cursorType",
    input.cursorValue ?? "cursorValue",
  ].join("|");
}

function hashValue(value) {
  return createHash("sha256").update(value).digest("hex");
}

function sanitizePathSegment(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "artifact";
}

function countRecords(payload) {
  const collections = Object.values(payload).filter(Array.isArray);
  return collections.reduce((sum, items) => sum + items.length, 0);
}

