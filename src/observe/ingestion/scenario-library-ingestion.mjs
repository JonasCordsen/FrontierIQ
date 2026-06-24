import { createHash } from "node:crypto";

import {
  buildScenarioUseCaseCatalog,
  mapScenarioUseCaseToSignals,
  SCENARIO_LIBRARY_ENDPOINTS,
} from "../adapters/scenario-library.mjs";
import { mergeUseCaseTracker } from "../../optimize/planning/scenario-usecase-management.mjs";
import { SOLUTION_IDS } from "../foundation/solution-taxonomy.mjs";
import { buildPolicyCatalog, evaluateIngestionPolicies } from "../../govern/policy/policy-catalog.mjs";
import {
  buildFoundryHandoffBatch,
  createIngestionScope,
  createIngestionTrigger,
  createRawStagedArtifact,
  planRawStorageTarget,
  summarizeIngestionRuntime,
} from "./runtime-pipeline.mjs";

/**
 * @param {{ baseUrl: string; fetchFn?: typeof fetch }} config
 */
export function createScenarioLibraryClient(config) {
  const fetchFn = config.fetchFn ?? globalThis.fetch;
  if (!fetchFn) throw new Error("fetch implementation is required");
  const baseUrl = config.baseUrl.replace(/\/+$/, "");

  return {
    async fetchScenarioTable() {
      const response = await fetchFn(`${baseUrl}${SCENARIO_LIBRARY_ENDPOINTS.scenarioTable}`);
      if (!response.ok) throw new Error(`Scenario table request failed: ${response.status}`);
      const payload = await response.json();
      return Array.isArray(payload.value) ? payload.value : [];
    },
    async fetchSelectionLogic() {
      const response = await fetchFn(`${baseUrl}${SCENARIO_LIBRARY_ENDPOINTS.scenarioSelection}`);
      if (!response.ok) throw new Error(`Scenario selection request failed: ${response.status}`);
      return response.json();
    },
  };
}

/**
 * @param {{
 *  tenantId: string;
 *  businessUnit: string;
 *  currentTracker?: any;
 *  scenarioRows: Array<Record<string, unknown>>;
 *  selectionLogic?: Record<string, unknown> | null;
 *  nowIso?: string;
 * }} input
 */
export function buildScenarioIngestionSnapshot(input) {
  const timestamp = input.nowIso ?? new Date().toISOString();
  const useCases = buildScenarioUseCaseCatalog(input.scenarioRows);
  const tracker = mergeUseCaseTracker(
    input.currentTracker,
    useCases,
    { tenantId: input.tenantId, businessUnit: input.businessUnit }
  );
  const signals = useCases.flatMap((useCase) =>
    mapScenarioUseCaseToSignals(useCase, { tenantId: input.tenantId, timestamp })
  );
  const sourceChecksum = hashJson({
    rows: input.scenarioRows,
    selection: input.selectionLogic ?? null,
  });

  return {
    tenantId: input.tenantId,
    businessUnit: input.businessUnit,
    timestamp,
    sourceChecksum,
    useCases,
    signals,
    tracker,
    selectionSummary: summarizeSelectionLogic(input.selectionLogic),
  };
}

/**
 * @param {{ sourceChecksum?: string }} previous
 * @param {{ sourceChecksum: string }} next
 */
export function isDuplicateScenarioSnapshot(previous, next) {
  if (!previous?.sourceChecksum) return false;
  return previous.sourceChecksum === next.sourceChecksum;
}

/**
 * @param {{
 *   tenantId: string;
 *   businessUnit: string;
 *   client: ReturnType<typeof createScenarioLibraryClient>;
 *   currentSnapshot?: ReturnType<typeof buildScenarioIngestionSnapshot>;
 *   nowIso?: string;
 * }} input
 */
export async function runScenarioLibraryIngestionCycle(input) {
  const [scenarioRows, selectionLogic] = await Promise.all([
    input.client.fetchScenarioTable(),
    input.client.fetchSelectionLogic(),
  ]);

  const snapshot = buildScenarioIngestionSnapshot({
    tenantId: input.tenantId,
    businessUnit: input.businessUnit,
    currentTracker: input.currentSnapshot?.tracker,
    scenarioRows,
    selectionLogic,
    nowIso: input.nowIso,
  });

  const duplicate = isDuplicateScenarioSnapshot(input.currentSnapshot, snapshot);
  return {
    duplicate,
    snapshot,
  };
}

/**
 * @param {ReturnType<typeof buildScenarioIngestionSnapshot>} snapshot
 */
export function buildScenarioFoundryDocuments(snapshot) {
  return snapshot.useCases.map((useCase) => ({
    id: useCase.useCaseId,
    title: useCase.name,
    content: [
      `Function area: ${useCase.functionArea}`,
      `Scenario level: ${useCase.scenarioLevel}`,
      `Asset type: ${useCase.assetType}`,
      `Products: ${useCase.products.join(", ")}`,
    ].join("\n"),
    metadata: {
      tenantId: snapshot.tenantId,
      businessUnit: snapshot.businessUnit,
      source: "microsoft-scenario-library",
      scenarioLevel: useCase.scenarioLevel,
      solutionIds: useCase.solutionIds.join(","),
      hasPromptGallery: useCase.hasPromptGallery,
      hasDemoVideo: useCase.hasDemoVideo,
    },
  }));
}

/**
 * @param {{
 *   tenantId: string;
 *   businessUnit: string;
 *   environment: "prod"|"nonprod";
 *   connectionId: string;
 *   storageConfig: Parameters<typeof planRawStorageTarget>[0];
 *   foundryTarget: Parameters<typeof buildFoundryHandoffBatch>[0]["target"];
 *   currentSnapshot?: ReturnType<typeof buildScenarioIngestionSnapshot>;
 *   scenarioRows: Array<Record<string, unknown>>;
 *   selectionLogic?: Record<string, unknown> | null;
 *   nowIso?: string;
 * }} input
 */
export function buildScenarioRuntimeArtifacts(input) {
  const startedAt = input.nowIso ?? new Date().toISOString();
  const snapshot = buildScenarioIngestionSnapshot({
    tenantId: input.tenantId,
    businessUnit: input.businessUnit,
    currentTracker: input.currentSnapshot?.tracker,
    scenarioRows: input.scenarioRows,
    selectionLogic: input.selectionLogic,
    nowIso: startedAt,
  });
  const duplicate = isDuplicateScenarioSnapshot(input.currentSnapshot, snapshot);
  const scope = createIngestionScope({
    tenantId: input.tenantId,
    businessUnit: input.businessUnit,
    environment: input.environment,
    sourceSystem: "microsoft-scenario-library",
    connectionId: input.connectionId,
  });
  const trigger = createIngestionTrigger({
    scope,
    triggerType: "reconcile",
    receivedAt: startedAt,
    cursorType: "snapshot-checksum",
    cursorValue: snapshot.sourceChecksum,
    payloadRef: "scenario-library-snapshot",
  });

  const customMetrics = {
    sourceRows: input.scenarioRows.length,
    normalizedUseCases: snapshot.useCases.length,
    generatedSignals: snapshot.signals.length,
    selectionOptionGroups: snapshot.selectionSummary.optionGroups,
  };
  const policyCatalog = buildPolicyCatalog(SOLUTION_IDS.M365_COPILOT);
  const policyEvaluation = evaluateIngestionPolicies({
    solutionId: SOLUTION_IDS.M365_COPILOT,
    sourceSystem: scope.sourceSystem,
    storageProvider: input.storageConfig.provider,
    retentionClass: "short-term",
    retentionDays: 14,
  }, policyCatalog);

  if (duplicate) {
    return {
      duplicate,
      snapshot,
      rawArtifacts: [],
      handoffBatch: null,
      policyEvaluation,
      telemetry: summarizeIngestionRuntime({
        scope,
        trigger,
        startedAt,
        completedAt: startedAt,
        apiCalls: 2,
        duplicateCount: 1,
        customMetrics,
      }),
    };
  }

  const storageTarget = planRawStorageTarget({
    ...input.storageConfig,
    scope,
    collectedAt: snapshot.timestamp,
    artifactName: "scenario-library-snapshot",
    extension: "json",
  });
  const rawArtifact = createRawStagedArtifact({
    scope,
    trigger,
    storageTarget,
    schemaKind: "scenario-library-snapshot",
    collectedAt: snapshot.timestamp,
    payload: {
      scenarioRows: input.scenarioRows,
      selectionLogic: input.selectionLogic ?? null,
      useCases: snapshot.useCases,
      signals: snapshot.signals,
    },
    retentionClass: "short-term",
    retentionDays: 14,
  });
  const handoffBatch = buildFoundryHandoffBatch({
    scope,
    target: input.foundryTarget,
    stagedArtifacts: [rawArtifact],
    processorVersion: "2026.06.1",
    documents: buildScenarioFoundryDocuments(snapshot),
    createdAt: snapshot.timestamp,
  });
  const telemetry = summarizeIngestionRuntime({
    scope,
    trigger,
    startedAt,
    completedAt: snapshot.timestamp,
    stagedArtifacts: [rawArtifact],
    handoffBatches: [handoffBatch],
    apiCalls: 2,
    customMetrics,
  });

  return {
    duplicate,
    snapshot,
    rawArtifacts: [rawArtifact],
    handoffBatch,
    policyEvaluation,
    telemetry,
  };
}

/**
 * @param {{
 *   tenantId: string;
 *   businessUnit: string;
 *   environment: "prod"|"nonprod";
 *   connectionId: string;
 *   client: ReturnType<typeof createScenarioLibraryClient>;
 *   storageConfig: Parameters<typeof planRawStorageTarget>[0];
 *   foundryTarget: Parameters<typeof buildFoundryHandoffBatch>[0]["target"];
 *   currentSnapshot?: ReturnType<typeof buildScenarioIngestionSnapshot>;
 *   nowIso?: string;
 * }} input
 */
export async function runScenarioLibraryRuntimePipeline(input) {
  const [scenarioRows, selectionLogic] = await Promise.all([
    input.client.fetchScenarioTable(),
    input.client.fetchSelectionLogic(),
  ]);

  return buildScenarioRuntimeArtifacts({
    tenantId: input.tenantId,
    businessUnit: input.businessUnit,
    environment: input.environment,
    connectionId: input.connectionId,
    currentSnapshot: input.currentSnapshot,
    scenarioRows,
    selectionLogic,
    storageConfig: input.storageConfig,
    foundryTarget: input.foundryTarget,
    nowIso: input.nowIso,
  });
}

/**
 * @param {{ run: () => Promise<void>; intervalMs: number }} config
 */
export function createScenarioIngestionScheduler(config) {
  if (!Number.isFinite(config.intervalMs) || config.intervalMs <= 0) {
    throw new Error("intervalMs must be a positive number");
  }
  /** @type {NodeJS.Timeout | null} */
  let timer = null;
  return {
    async start() {
      if (timer) return;
      await config.run();
      timer = setInterval(() => {
        void config.run();
      }, config.intervalMs);
    },
    stop() {
      if (!timer) return;
      clearInterval(timer);
      timer = null;
    },
    isRunning() {
      return Boolean(timer);
    },
  };
}

function summarizeSelectionLogic(selectionLogic) {
  const scenarioOptions = Array.isArray(selectionLogic?.ScenarioOptions)
    ? selectionLogic.ScenarioOptions
    : [];
  const optionGroups = scenarioOptions.length;
  const totalOptions = scenarioOptions.reduce((sum, group) => {
    const options = Array.isArray(group?.Options) ? group.Options.length : 0;
    return sum + options;
  }, 0);

  return {
    optionGroups,
    totalOptions,
  };
}

function hashJson(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
