/**
 * Canonical solution identifiers and metadata for cross-solution coverage.
 * This is the single source of truth used by adapters and documentation.
 */
export const SOLUTION_IDS = Object.freeze({
  M365_COPILOT: "m365-copilot",
  COPILOT_STUDIO: "copilot-studio",
  SECURITY_COPILOT: "security-copilot",
  AZURE_AI_FOUNDRY: "azure-ai-foundry",
  AZURE_OPENAI: "azure-openai",
  AZURE_AI_SEARCH: "azure-ai-search",
  AZURE_DOCUMENT_INTELLIGENCE: "azure-document-intelligence",
  AZURE_SPEECH: "azure-speech",
  FABRIC: "fabric",
  POWER_PLATFORM: "power-platform",
  DYNAMICS_365: "dynamics-365",
  GITHUB_COPILOT: "github-copilot",
});

export const MVP_PHASE1_SOLUTIONS = Object.freeze([
  SOLUTION_IDS.M365_COPILOT,
  SOLUTION_IDS.COPILOT_STUDIO,
  SOLUTION_IDS.AZURE_AI_FOUNDRY,
  SOLUTION_IDS.FABRIC,
]);

/**
 * @typedef {{
 *   id: string;
 *   name: string;
 *   category: "m365"|"azure"|"power-platform"|"dynamics"|"github";
 *   primaryApis: string[];
 *   supportsSingleTenant: boolean;
 *   supportsMultiTenant: boolean;
 *   mvpPhase1Implemented: boolean;
 * }} SolutionDefinition
 */

/** @type {SolutionDefinition[]} */
export const SOLUTION_CATALOG = Object.freeze([
  {
    id: SOLUTION_IDS.M365_COPILOT,
    name: "Microsoft 365 Copilot",
    category: "m365",
    primaryApis: ["Microsoft Graph Reports API", "Microsoft Graph Audit Logs"],
    supportsSingleTenant: true,
    supportsMultiTenant: true,
    mvpPhase1Implemented: true,
  },
  {
    id: SOLUTION_IDS.COPILOT_STUDIO,
    name: "Copilot Studio",
    category: "m365",
    primaryApis: ["Copilot Studio APIs", "Microsoft Graph (agent metadata where available)"],
    supportsSingleTenant: true,
    supportsMultiTenant: true,
    mvpPhase1Implemented: true,
  },
  {
    id: SOLUTION_IDS.SECURITY_COPILOT,
    name: "Security Copilot",
    category: "m365",
    primaryApis: ["Microsoft Security APIs", "Microsoft Defender APIs"],
    supportsSingleTenant: true,
    supportsMultiTenant: true,
    mvpPhase1Implemented: false,
  },
  {
    id: SOLUTION_IDS.AZURE_AI_FOUNDRY,
    name: "Azure AI Foundry",
    category: "azure",
    primaryApis: ["Azure AI Foundry APIs", "Azure Resource Manager"],
    supportsSingleTenant: true,
    supportsMultiTenant: true,
    mvpPhase1Implemented: true,
  },
  {
    id: SOLUTION_IDS.AZURE_OPENAI,
    name: "Azure OpenAI",
    category: "azure",
    primaryApis: ["Azure OpenAI APIs", "Azure Monitor Metrics"],
    supportsSingleTenant: true,
    supportsMultiTenant: true,
    mvpPhase1Implemented: false,
  },
  {
    id: SOLUTION_IDS.AZURE_AI_SEARCH,
    name: "Azure AI Search",
    category: "azure",
    primaryApis: ["Azure AI Search APIs", "Azure Monitor Metrics"],
    supportsSingleTenant: true,
    supportsMultiTenant: true,
    mvpPhase1Implemented: false,
  },
  {
    id: SOLUTION_IDS.AZURE_DOCUMENT_INTELLIGENCE,
    name: "Azure Document Intelligence",
    category: "azure",
    primaryApis: ["Document Intelligence APIs", "Azure Monitor Metrics"],
    supportsSingleTenant: true,
    supportsMultiTenant: true,
    mvpPhase1Implemented: false,
  },
  {
    id: SOLUTION_IDS.AZURE_SPEECH,
    name: "Azure Speech",
    category: "azure",
    primaryApis: ["Speech APIs", "Azure Monitor Metrics"],
    supportsSingleTenant: true,
    supportsMultiTenant: true,
    mvpPhase1Implemented: false,
  },
  {
    id: SOLUTION_IDS.FABRIC,
    name: "Microsoft Fabric",
    category: "azure",
    primaryApis: ["Fabric APIs", "Fabric Capacity Metrics"],
    supportsSingleTenant: true,
    supportsMultiTenant: true,
    mvpPhase1Implemented: true,
  },
  {
    id: SOLUTION_IDS.POWER_PLATFORM,
    name: "Power Platform",
    category: "power-platform",
    primaryApis: ["Power Platform Admin APIs"],
    supportsSingleTenant: true,
    supportsMultiTenant: true,
    mvpPhase1Implemented: false,
  },
  {
    id: SOLUTION_IDS.DYNAMICS_365,
    name: "Dynamics 365",
    category: "dynamics",
    primaryApis: ["Dynamics 365 APIs", "Dataverse APIs"],
    supportsSingleTenant: true,
    supportsMultiTenant: true,
    mvpPhase1Implemented: false,
  },
  {
    id: SOLUTION_IDS.GITHUB_COPILOT,
    name: "GitHub Copilot",
    category: "github",
    primaryApis: ["GitHub Copilot Metrics APIs", "GitHub APIs"],
    supportsSingleTenant: true,
    supportsMultiTenant: true,
    mvpPhase1Implemented: false,
  },
]);

export function getSolutionDefinition(solutionId) {
  return SOLUTION_CATALOG.find((solution) => solution.id === solutionId);
}

export function isKnownSolution(solutionId) {
  return Boolean(getSolutionDefinition(solutionId));
}

