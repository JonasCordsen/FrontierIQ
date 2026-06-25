/**
 * Review cadence orchestrator contract.
 * Pillar: GOVERN
 *
 * Deterministic governance review schedule orchestration.
 */

/**
 * Build review schedule from cadence items.
 * @param {{ itemId:string, owner:string, cadenceDays:number, lastReviewedAt:string, riskBand?:string }[]} items
 * @param {string} asOf
 * @returns {object[]}
 */
export function buildReviewCadenceSchedule(items, asOf) {
  const asOfMs = Date.parse(asOf);
  if (Number.isNaN(asOfMs)) throw new Error("asOf must be valid ISO date");

  return (Array.isArray(items) ? items : []).map((item) => {
    const lastMs = Date.parse(item.lastReviewedAt);
    const cadenceDays = Number.isFinite(item.cadenceDays) ? item.cadenceDays : 0;
    const nextMs = Number.isNaN(lastMs) ? Number.NaN : lastMs + cadenceDays * 24 * 60 * 60 * 1000;
    const daysUntilReview = Number.isNaN(nextMs) ? null : Math.floor((nextMs - asOfMs) / (24 * 60 * 60 * 1000));
    const status = !Number.isFinite(daysUntilReview) ? "unknown" : daysUntilReview < 0 ? "overdue" : daysUntilReview <= 7 ? "upcoming" : "scheduled";

    return {
      itemId: item.itemId,
      owner: item.owner,
      riskBand: item.riskBand ?? "medium",
      cadenceDays,
      lastReviewedAt: item.lastReviewedAt,
      nextReviewAt: Number.isNaN(nextMs) ? null : new Date(nextMs).toISOString(),
      daysUntilReview,
      status,
    };
  });
}

/**
 * Summarize review cadence load.
 * @param {object[]} schedule
 * @returns {object}
 */
export function summarizeReviewCadenceLoad(schedule) {
  const list = Array.isArray(schedule) ? schedule : [];
  const countByStatus = { overdue: 0, upcoming: 0, scheduled: 0, unknown: 0 };
  for (const item of list) {
    const status = countByStatus[item.status] !== undefined ? item.status : "unknown";
    countByStatus[status] += 1;
  }
  return {
    total: list.length,
    countByStatus,
    status: countByStatus.overdue > 0 ? "blocked" : "ready",
  };
}

/**
 * Build review cadence evidence envelope.
 * @param {object[]} schedule
 * @param {string} generatedAt
 * @returns {object}
 */
export function buildReviewCadenceEvidence(schedule, generatedAt) {
  return {
    artifactType: "review-cadence-schedule",
    generatedAt: generatedAt ?? null,
    summary: summarizeReviewCadenceLoad(schedule),
    schedule: Array.isArray(schedule) ? schedule : [],
  };
}

