import { copilotStudioAdapter } from "./copilot-studio.mjs";
import { fabricAdapter } from "./fabric.mjs";
import { foundryAdapter } from "./foundry.mjs";
import { m365CopilotAdapter } from "./m365-copilot.mjs";

export const MVP_ADAPTERS = Object.freeze([
  m365CopilotAdapter,
  copilotStudioAdapter,
  foundryAdapter,
  fabricAdapter,
]);

export function getAdapterBySolution(solutionId) {
  return MVP_ADAPTERS.find((adapter) => adapter.solutionId === solutionId);
}

