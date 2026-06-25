/**
 * Multi-tenant fairness guard contract.
 * Pillar: OBSERVE
 *
 * Deterministic cross-tenant prioritization fairness checks.
 */

/**
 * Evaluate fairness across tenant queue plan.
 * @param {{ tenantId:string, priority:string, estimatedCost:number }[]} queue
 * @returns {object}
 */
export function evaluateMultiTenantFairness(queue) {
  const list = Array.isArray(queue) ? queue : [];
  const total = list.length;
  const counts = { urgent: 0, standard: 0, low: 0 };
  const byTenant = {};

  for (const entry of list) {
    const priority = counts[entry?.priority] !== undefined ? entry.priority : "standard";
    counts[priority] += 1;
    byTenant[entry.tenantId] = {
      priority,
      estimatedCost: Number.isFinite(entry?.estimatedCost) ? entry.estimatedCost : 0,
    };
  }

  const urgentShare = total > 0 ? Number((counts.urgent / total).toFixed(4)) : 0;
  const lowShare = total > 0 ? Number((counts.low / total).toFixed(4)) : 0;
  const fairnessIndex = Number((1 - Math.abs(urgentShare - lowShare)).toFixed(4));

  return {
    totalTenants: total,
    counts,
    urgentShare,
    lowShare,
    fairnessIndex,
    status: fairnessIndex >= 0.5 ? "ready" : "blocked",
    byTenant,
  };
}

/**
 * Explain fairness blockers.
 * @param {ReturnType<typeof evaluateMultiTenantFairness>} fairness
 * @returns {string[]}
 */
export function listFairnessBlockers(fairness) {
  const blockers = [];
  if ((fairness?.totalTenants ?? 0) === 0) blockers.push("no-tenants-in-queue");
  if ((fairness?.fairnessIndex ?? 0) < 0.5) blockers.push("priority-distribution-imbalance");
  return blockers;
}

/**
 * Build fairness evidence envelope.
 * @param {ReturnType<typeof evaluateMultiTenantFairness>} fairness
 * @param {string} generatedAt
 * @returns {object}
 */
export function buildMultiTenantFairnessEvidence(fairness, generatedAt) {
  return {
    artifactType: "multi-tenant-fairness",
    generatedAt: generatedAt ?? null,
    fairness,
    blockers: listFairnessBlockers(fairness),
  };
}

