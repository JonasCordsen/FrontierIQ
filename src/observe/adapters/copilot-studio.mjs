import { SOLUTION_IDS } from "../foundation/solution-taxonomy.mjs";
import { adapterFailure, adapterSuccess, isBasePayload } from "./types.mjs";

/**
 * @param {unknown} payload
 */
function map(payload) {
  if (!isBasePayload(payload)) {
    return adapterFailure("invalid_payload", "Copilot Studio payload does not match base adapter contract.");
  }

  const source = "copilot-studio";
  const signals = payload.signals.map((signal) => ({
    tenantId: payload.tenantId,
    solutionId: SOLUTION_IDS.COPILOT_STUDIO,
    workload: signal.workload,
    resourceId: signal.resourceId,
    source,
    timestamp: payload.timestamp,
    signalType: signal.signalType,
    severity: signal.severity,
    confidence: signal.confidence,
    freshnessMinutes: signal.freshnessMinutes,
    dimensions: { ...signal.dimensions, adapter: "copilot-studio" },
    evidence: { ...signal.evidence, sourceEndpoint: "copilot-studio/agents" },
  }));

  return adapterSuccess(signals);
}

export const copilotStudioAdapter = Object.freeze({
  id: "adapter-copilot-studio",
  solutionId: SOLUTION_IDS.COPILOT_STUDIO,
  map,
});

