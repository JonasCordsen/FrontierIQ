import { prioritizeNextBestActions } from "../model/next-best-action-engine.mjs";

const STATUS = Object.freeze(["candidate", "planned", "in_progress", "adopted", "retired"]);
const SCENARIO_LEVEL_RANK = Object.freeze({
  start: 1,
  buy: 2,
  extend: 3,
  build: 4,
});

/**
 * @param {{
 *   useCaseId: string;
 *   name: string;
 *   functionArea: string;
 *   scenarioLevel: string;
 *   solutionIds: string[];
 *   hasPromptGallery: boolean;
 *   hasDemoVideo: boolean;
 *   isFrontlineWorker: boolean;
 * }[]} useCases
 * @param {{ tenantId: string; businessUnit: string }} scope
 */
export function initializeUseCaseTracker(useCases, scope) {
  if (!scope.tenantId) throw new Error("tenantId is required");
  if (!scope.businessUnit) throw new Error("businessUnit is required");
  return {
    tenantId: scope.tenantId,
    businessUnit: scope.businessUnit,
    items: useCases.map((useCase) => ({
      ...useCase,
      status: "candidate",
      selectedAt: null,
      adoptedAt: null,
      kpiName: null,
      kpiBaseline: null,
      kpiTarget: null,
    })),
  };
}

/**
 * Merges a refreshed use case catalog into tracker state so selected lifecycle/KPI data persists.
 *
 * @param {ReturnType<typeof initializeUseCaseTracker> | null | undefined} existing
 * @param {Parameters<typeof initializeUseCaseTracker>[0]} useCases
 * @param {Parameters<typeof initializeUseCaseTracker>[1]} scope
 */
export function mergeUseCaseTracker(existing, useCases, scope) {
  const baseline = initializeUseCaseTracker(useCases, scope);
  if (!existing) return baseline;

  const existingById = new Map(existing.items.map((item) => [item.useCaseId, item]));
  baseline.items = baseline.items.map((item) => {
    const previous = existingById.get(item.useCaseId);
    if (!previous) return item;
    return {
      ...item,
      status: previous.status,
      selectedAt: previous.selectedAt,
      adoptedAt: previous.adoptedAt,
      kpiName: previous.kpiName,
      kpiBaseline: previous.kpiBaseline,
      kpiTarget: previous.kpiTarget,
    };
  });
  return baseline;
}

/**
 * @param {ReturnType<typeof initializeUseCaseTracker>} tracker
 * @param {Array<{
 *   useCaseId: string;
 *   status?: "candidate"|"planned"|"in_progress"|"adopted"|"retired";
 *   kpiName?: string|null;
 *   kpiBaseline?: number|null;
 *   kpiTarget?: number|null;
 *   selectedAt?: string|null;
 *   adoptedAt?: string|null;
 * }>} updates
 */
export function updateUseCaseTracker(tracker, updates) {
  const byId = new Map(tracker.items.map((item) => [item.useCaseId, item]));
  for (const update of updates) {
    const item = byId.get(update.useCaseId);
    if (!item) {
      throw new Error(`Unknown useCaseId: ${update.useCaseId}`);
    }
    if (update.status && !STATUS.includes(update.status)) {
      throw new Error(`Invalid status: ${update.status}`);
    }
    if (update.status) item.status = update.status;
    if (update.kpiName !== undefined) item.kpiName = update.kpiName;
    if (update.kpiBaseline !== undefined) item.kpiBaseline = update.kpiBaseline;
    if (update.kpiTarget !== undefined) item.kpiTarget = update.kpiTarget;
    if (update.selectedAt !== undefined) item.selectedAt = update.selectedAt;
    if (update.adoptedAt !== undefined) item.adoptedAt = update.adoptedAt;
  }
  return tracker;
}

/**
 * @param {ReturnType<typeof initializeUseCaseTracker>} tracker
 */
export function summarizeUseCaseTracker(tracker) {
  const byStatus = Object.fromEntries(STATUS.map((value) => [value, 0]));
  let withKpi = 0;
  for (const item of tracker.items) {
    byStatus[item.status] += 1;
    if (item.kpiName && typeof item.kpiBaseline === "number" && typeof item.kpiTarget === "number") {
      withKpi += 1;
    }
  }
  return {
    totalUseCases: tracker.items.length,
    byStatus,
    withKpi,
    kpiCoverage: tracker.items.length ? Number((withKpi / tracker.items.length).toFixed(4)) : 0,
  };
}

/**
 * @param {ReturnType<typeof initializeUseCaseTracker>} tracker
 */
export function buildScenarioPortfolioSummary(tracker) {
  const summary = summarizeUseCaseTracker(tracker);
  const byScenarioLevel = /** @type {Record<string, number>} */ ({});

  for (const item of tracker.items) {
    const level = normalizeScenarioLevel(item.scenarioLevel);
    byScenarioLevel[level] = (byScenarioLevel[level] ?? 0) + 1;
  }

  return {
    tenantId: tracker.tenantId,
    businessUnit: tracker.businessUnit,
    ...summary,
    byScenarioLevel,
  };
}

/**
 * @param {ReturnType<typeof initializeUseCaseTracker>} tracker
 * @param {{ top?: number }} options
 */
export function adviseScenarioUseCases(tracker, options = {}) {
  const candidates = tracker.items
    .filter((item) => item.status === "candidate" || item.status === "planned")
    .map((item) => {
      const level = normalizeScenarioLevel(item.scenarioLevel);
      const impact = level === "build" ? 9 : level === "extend" ? 8 : level === "buy" ? 7 : 6;
      const effort = level === "build" ? 9 : level === "extend" ? 7 : level === "buy" ? 5 : 3;
      const riskReduction = mapPillar(item.functionArea) === "secure" ? 9 : 6;
      const confidence = item.hasPromptGallery || item.hasDemoVideo ? 0.9 : 0.7;
      return {
        id: item.useCaseId,
        title: `Scale use case: ${item.name}`,
        pillar: mapPillar(item.functionArea),
        impact,
        effort,
        riskReduction,
        confidence,
      };
    });

  return prioritizeNextBestActions(candidates, { top: options.top ?? 10 });
}

function normalizeScenarioLevel(value) {
  const key = (value ?? "").toLowerCase().trim();
  if (SCENARIO_LEVEL_RANK[key]) return key;
  return "buy";
}

function mapPillar(functionArea) {
  const value = (functionArea ?? "").toLowerCase();
  if (value.includes("it") || value.includes("legal")) return "govern";
  if (value.includes("security")) return "secure";
  if (value.includes("executive")) return "optimize";
  return "observe";
}
