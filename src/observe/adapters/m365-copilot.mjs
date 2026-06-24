import { SOLUTION_IDS } from "../foundation/solution-taxonomy.mjs";
import { adapterFailure, adapterSuccess, isBasePayload } from "./types.mjs";

/**
 * @param {unknown} payload
 */
function map(payload) {
  if (!isBasePayload(payload)) {
    return adapterFailure("invalid_payload", "M365 Copilot payload does not match base adapter contract.");
  }

  const source = "m365-graph";
  const signals = payload.signals.map((signal) => ({
    tenantId: payload.tenantId,
    solutionId: SOLUTION_IDS.M365_COPILOT,
    workload: signal.workload,
    resourceId: signal.resourceId,
    source,
    timestamp: payload.timestamp,
    signalType: signal.signalType,
    severity: signal.severity,
    confidence: signal.confidence,
    freshnessMinutes: signal.freshnessMinutes,
    dimensions: { ...signal.dimensions, adapter: "m365-copilot" },
    evidence: { ...signal.evidence, sourceEndpoint: "graph/reports" },
  }));

  return adapterSuccess(signals);
}

export const m365CopilotAdapter = Object.freeze({
  id: "adapter-m365-copilot",
  solutionId: SOLUTION_IDS.M365_COPILOT,
  map,
});

