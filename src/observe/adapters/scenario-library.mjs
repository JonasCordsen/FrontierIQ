import { createNormalizedSignal } from "../foundation/normalized-signal.mjs";
import { SOLUTION_IDS } from "../foundation/solution-taxonomy.mjs";

export const SCENARIO_LIBRARY_ENDPOINTS = Object.freeze({
  scenarioSelection: "/ScenarioIndustryRoleLogic",
  scenarioTable: "/_api/cr974_copilotscenarios",
});

const FEATURE_TO_SOLUTION = Object.freeze({
  "Azure AI Foundry": SOLUTION_IDS.AZURE_AI_FOUNDRY,
  "Copilot in Dynamics 365": SOLUTION_IDS.DYNAMICS_365,
  Agents: SOLUTION_IDS.COPILOT_STUDIO,
  "M365 Copilot": SOLUTION_IDS.M365_COPILOT,
  "Power Platform": SOLUTION_IDS.POWER_PLATFORM,
  "Security Copilot": SOLUTION_IDS.SECURITY_COPILOT,
  "Github Copilot": SOLUTION_IDS.GITHUB_COPILOT,
});

const PRODUCT_FIELDS = Object.freeze({
  "Azure AI Foundry": "cr974_azureaistudio",
  "Copilot for Finance": "cr974_copilotforfinance",
  "Copilot for Sales": "cr974_copilotforsales",
  "Copilot for Service": "cr974_copilotforservice",
  "Copilot in Dynamics 365": "cr974_copilotindynamics365",
  Agents: "cr974_copilotstudioagents",
  "M365 Copilot": "cr974_microsoft365copilot",
  "M365 Copilot Chat": "cr974_microsoftcopilotwebonly",
  "Power Platform": "cr974_powerautomatepowerapps",
  "Security Copilot": "cr974_securitycopilot",
  "Github Copilot": "cr974_githubcopilot",
});

/**
 * @param {Array<Record<string, unknown>>} rows
 */
export function buildScenarioUseCaseCatalog(rows) {
  return rows.map((row) => normalizeScenarioRow(row));
}

/**
 * @param {Record<string, unknown>} row
 */
export function normalizeScenarioRow(row) {
  const name = toText(row.cr974_name);
  const functionArea = toText(row.cr974_functionalareas);
  const scenarioLevel = toText(row.cr974_scenarioleveleffortrating);
  const assetType = toText(row.cr974_assettype);
  const products = extractProducts(row);
  const solutionIds = products
    .map((product) => FEATURE_TO_SOLUTION[product])
    .filter((value) => typeof value === "string");

  return {
    useCaseId: buildUseCaseId(name, functionArea),
    name,
    functionArea,
    scenarioLevel,
    assetType,
    products,
    solutionIds,
    hasPromptGallery: isYes(row.cr974_promptsavailableincopilotlab),
    hasDemoVideo: Boolean(toText(row.cr974_demolink)),
    isFrontlineWorker: isYes(row.cr974_flw),
    downloadUrl: toText(row.cr974_link),
    demoUrl: toText(row.cr974_demolink),
  };
}

/**
 * @param {ReturnType<typeof normalizeScenarioRow>} useCase
 * @param {{ tenantId: string; timestamp?: string }} context
 */
export function mapScenarioUseCaseToSignals(useCase, context) {
  if (!context.tenantId) throw new Error("tenantId is required");
  const timestamp = context.timestamp ?? new Date().toISOString();
  const resourceId = `scenario:${useCase.useCaseId}`;

  return useCase.solutionIds.map((solutionId) =>
    createNormalizedSignal({
      tenantId: context.tenantId,
      solutionId,
      workload: "scenario-library",
      resourceId,
      source: "microsoft-scenario-library",
      timestamp,
      signalType: "scenario_use_case",
      severity: "info",
      confidence: 0.8,
      freshnessMinutes: 24 * 60,
      dimensions: {
        functionArea: useCase.functionArea,
        scenarioLevel: useCase.scenarioLevel,
        assetType: useCase.assetType,
        isFrontlineWorker: useCase.isFrontlineWorker,
      },
      evidence: {
        useCaseName: useCase.name,
        hasPromptGallery: useCase.hasPromptGallery,
        hasDemoVideo: useCase.hasDemoVideo,
      },
    })
  );
}

function extractProducts(row) {
  return Object.entries(PRODUCT_FIELDS)
    .filter(([, field]) => isYes(row[field]))
    .map(([name]) => name)
    .sort((a, b) => a.localeCompare(b));
}

function isYes(value) {
  return toText(value).toUpperCase() === "Y";
}

function toText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function buildUseCaseId(name, functionArea) {
  const base = `${functionArea}-${name}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "unknown-use-case";
}

