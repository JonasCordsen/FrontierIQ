import { SOLUTION_IDS } from "../foundation/solution-taxonomy.mjs";
import { adapterFailure, adapterSuccess, isBasePayload } from "./types.mjs";

/**
 * @param {unknown} payload
 */
function map(payload) {
  if (!isBasePayload(payload)) {
    return adapterFailure("invalid_payload", "Fabric payload does not match base adapter contract.");
  }

  const source = "fabric";
  const signals = payload.signals.map((signal) => ({
    tenantId: payload.tenantId,
    solutionId: SOLUTION_IDS.FABRIC,
    workload: signal.workload,
    resourceId: signal.resourceId,
    source,
    timestamp: payload.timestamp,
    signalType: signal.signalType,
    severity: signal.severity,
    confidence: signal.confidence,
    freshnessMinutes: signal.freshnessMinutes,
    dimensions: { ...signal.dimensions, adapter: "fabric" },
    evidence: { ...signal.evidence, sourceEndpoint: "fabric/capacity" },
  }));

  return adapterSuccess(signals);
}

export const fabricAdapter = Object.freeze({
  id: "adapter-fabric",
  solutionId: SOLUTION_IDS.FABRIC,
  map,
});

