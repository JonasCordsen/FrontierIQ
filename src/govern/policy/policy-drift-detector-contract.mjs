/**
 * Policy drift detector contract.
 * Pillar: GOVERN
 *
 * Deterministic baseline-vs-runtime policy drift detection.
 */

/**
 * Detect policy drift between baseline and runtime controls.
 * @param {{ policyId:string, controls:string[] }[]} baselinePolicies
 * @param {{ policyId:string, controls:string[] }[]} runtimePolicies
 * @returns {object[]}
 */
export function detectPolicyDrift(baselinePolicies, runtimePolicies) {
  const baselineMap = new Map((Array.isArray(baselinePolicies) ? baselinePolicies : []).map((item) => [item.policyId, new Set(item.controls ?? [])]));
  const runtimeMap = new Map((Array.isArray(runtimePolicies) ? runtimePolicies : []).map((item) => [item.policyId, new Set(item.controls ?? [])]));

  const policyIds = [...new Set([...baselineMap.keys(), ...runtimeMap.keys()])].sort((a, b) => a.localeCompare(b));
  return policyIds.map((policyId) => {
    const baseline = baselineMap.get(policyId) ?? new Set();
    const runtime = runtimeMap.get(policyId) ?? new Set();
    const missingControls = [...baseline].filter((controlId) => !runtime.has(controlId)).sort((a, b) => a.localeCompare(b));
    const unexpectedControls = [...runtime].filter((controlId) => !baseline.has(controlId)).sort((a, b) => a.localeCompare(b));
    const drifted = missingControls.length > 0 || unexpectedControls.length > 0;

    return {
      policyId,
      drifted,
      missingControls,
      unexpectedControls,
    };
  });
}

/**
 * Summarize policy drift set.
 * @param {ReturnType<typeof detectPolicyDrift>} drifts
 * @returns {object}
 */
export function summarizePolicyDrift(drifts) {
  const list = Array.isArray(drifts) ? drifts : [];
  const driftedPolicies = list.filter((item) => item.drifted);
  return {
    totalPolicies: list.length,
    driftedPolicies: driftedPolicies.length,
    totalMissingControls: driftedPolicies.reduce((acc, item) => acc + item.missingControls.length, 0),
    totalUnexpectedControls: driftedPolicies.reduce((acc, item) => acc + item.unexpectedControls.length, 0),
    status: driftedPolicies.length === 0 ? "ready" : "blocked",
  };
}

/**
 * Build policy drift evidence envelope.
 * @param {ReturnType<typeof detectPolicyDrift>} drifts
 * @param {string} generatedAt
 * @returns {object}
 */
export function buildPolicyDriftEvidence(drifts, generatedAt) {
  return {
    artifactType: "policy-drift",
    generatedAt: generatedAt ?? null,
    summary: summarizePolicyDrift(drifts),
    drifts: Array.isArray(drifts) ? drifts : [],
  };
}

