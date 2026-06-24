import { SOLUTION_IDS } from "../foundation/solution-taxonomy.mjs";
import { adapterFailure, adapterSuccess, isBasePayload } from "./types.mjs";

/**
 * @param {unknown} payload
 */
function map(payload) {
  if (!isBasePayload(payload)) {
    return adapterFailure("invalid_payload", "Foundry payload does not match base adapter contract.");
  }

  const source = "azure-ai-foundry";
  const signals = payload.signals.map((signal) => ({
    tenantId: payload.tenantId,
    solutionId: SOLUTION_IDS.AZURE_AI_FOUNDRY,
    workload: signal.workload,
    resourceId: signal.resourceId,
    source,
    timestamp: payload.timestamp,
    signalType: signal.signalType,
    severity: signal.severity,
    confidence: signal.confidence,
    freshnessMinutes: signal.freshnessMinutes,
    dimensions: { ...signal.dimensions, adapter: "foundry" },
    evidence: { ...signal.evidence, sourceEndpoint: "foundry/agents" },
  }));

  return adapterSuccess(signals);
}

export const foundryAdapter = Object.freeze({
  id: "adapter-foundry",
  solutionId: SOLUTION_IDS.AZURE_AI_FOUNDRY,
  map,
});

