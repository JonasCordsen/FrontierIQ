/**
 * Overshare incident priority contract.
 * Pillar: SECURE
 *
 * Deterministic severity/impact priority scoring for overshare incident triage.
 */

const SEVERITY_WEIGHT = Object.freeze({
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
});

const DATA_SENSITIVITY_WEIGHT = Object.freeze({
  confidential: 3,
  restricted: 2,
  internal: 1,
  public: 0,
});

/**
 * Calculate incident priority score.
 * @param {{ severity:string, affectedUsers:number, dataClassifications?:string[], exposureType?:string }} incident
 * @returns {{ priorityScore:number, priorityBand:string }}
 */
export function calculateOversharePriority(incident) {
  const severityWeight = SEVERITY_WEIGHT[incident?.severity] ?? 1;
  const affectedUsers = Number.isFinite(incident?.affectedUsers) ? incident.affectedUsers : 0;
  const impactPoints = Math.min(40, Math.floor(affectedUsers / 5));
  const classificationPoints = (incident?.dataClassifications ?? [])
    .map((item) => DATA_SENSITIVITY_WEIGHT[item] ?? 0)
    .reduce((acc, value) => acc + value, 0);
  const exposurePoints = incident?.exposureType === "external_share" ? 12 : incident?.exposureType === "broad_internal" ? 6 : 0;
  const priorityScore = Math.min(100, severityWeight * 12 + impactPoints + classificationPoints * 3 + exposurePoints);

  return {
    priorityScore,
    priorityBand: classifyPriorityBand(priorityScore),
  };
}

/**
 * Rank incidents by descending priority.
 * @param {object[]} incidents
 * @returns {object[]}
 */
export function rankOvershareIncidents(incidents) {
  const list = Array.isArray(incidents) ? incidents : [];
  return list
    .map((incident) => ({
      ...incident,
      ...calculateOversharePriority(incident),
    }))
    .sort((left, right) => right.priorityScore - left.priorityScore);
}

/**
 * Summarize triage queue.
 * @param {object[]} incidents
 * @returns {object}
 */
export function summarizeOversharePriorityQueue(incidents) {
  const ranked = rankOvershareIncidents(incidents);
  const countByBand = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const incident of ranked) {
    countByBand[incident.priorityBand] += 1;
  }

  return {
    total: ranked.length,
    topIncident: ranked[0] ?? null,
    avgPriorityScore: ranked.length > 0
      ? Number((ranked.reduce((acc, incident) => acc + incident.priorityScore, 0) / ranked.length).toFixed(2))
      : 0,
    countByBand,
  };
}

function classifyPriorityBand(score) {
  if (score >= 75) return "critical";
  if (score >= 55) return "high";
  if (score >= 30) return "medium";
  return "low";
}

