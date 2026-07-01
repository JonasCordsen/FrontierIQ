/**
 * Access anomaly triage contract.
 * Pillar: SECURE
 *
 * Deterministic identity anomaly severity scoring and response playbook mapping.
 */

const ANOMALY_TYPE_WEIGHT = Object.freeze({
  impossible_travel: 3,
  token_reuse: 3,
  privilege_escalation: 4,
  suspicious_app_consent: 4,
  excessive_failures: 2,
});

/**
 * Score one access anomaly.
 * @param {{ id:string, tenantId:string, anomalyType:string, riskSignals?:string[], blastRadiusUsers?:number, privilegedContext?:boolean, repeatedCount?:number }} anomaly
 * @returns {{ id:string|null, tenantId:string|null, anomalyType:string|null, severityScore:number, severityBand:'critical'|'high'|'medium'|'low' }}
 */
export function scoreAccessAnomaly(anomaly) {
  const typeWeight = ANOMALY_TYPE_WEIGHT[anomaly?.anomalyType] ?? 1;
  const signalPoints = Math.min(25, (Array.isArray(anomaly?.riskSignals) ? anomaly.riskSignals.length : 0) * 5);
  const blastRadius = Number.isFinite(anomaly?.blastRadiusUsers) ? Math.max(0, anomaly.blastRadiusUsers) : 0;
  const blastRadiusPoints = Math.min(30, Math.floor(blastRadius / 5));
  const repeatCount = Number.isFinite(anomaly?.repeatedCount) ? Math.max(0, anomaly.repeatedCount) : 0;
  const repeatPoints = Math.min(15, repeatCount * 3);
  const privilegedPoints = anomaly?.privilegedContext ? 10 : 0;

  const severityScore = Math.min(100, typeWeight * 10 + signalPoints + blastRadiusPoints + repeatPoints + privilegedPoints);
  return {
    id: anomaly?.id ?? null,
    tenantId: anomaly?.tenantId ?? null,
    anomalyType: anomaly?.anomalyType ?? null,
    severityScore,
    severityBand: classifyAccessAnomalyBand(severityScore),
  };
}

/**
 * Map scored anomaly to deterministic response playbook.
 * @param {ReturnType<typeof scoreAccessAnomaly>} scored
 * @returns {{ action:'monitor'|'investigate'|'contain'|'revoke', playbookId:string, targetSlaMinutes:number }}
 */
export function mapAccessAnomalyResponse(scored) {
  const band = scored?.severityBand ?? "low";
  if (band === "critical") {
    return { action: "revoke", playbookId: "PB-SEC-REVOKE-001", targetSlaMinutes: 15 };
  }
  if (band === "high") {
    return { action: "contain", playbookId: "PB-SEC-CONTAIN-001", targetSlaMinutes: 30 };
  }
  if (band === "medium") {
    return { action: "investigate", playbookId: "PB-SEC-INVESTIGATE-001", targetSlaMinutes: 120 };
  }
  return { action: "monitor", playbookId: "PB-SEC-MONITOR-001", targetSlaMinutes: 1440 };
}

/**
 * Summarize anomaly triage portfolio.
 * @param {object[]} anomalies
 * @returns {object}
 */
export function summarizeAccessAnomalyTriage(anomalies) {
  const scored = (Array.isArray(anomalies) ? anomalies : []).map(scoreAccessAnomaly)
    .map((item) => ({ ...item, response: mapAccessAnomalyResponse(item) }))
    .sort((left, right) => right.severityScore - left.severityScore);
  const total = scored.length;
  return {
    total,
    critical: scored.filter((item) => item.severityBand === "critical").length,
    high: scored.filter((item) => item.severityBand === "high").length,
    medium: scored.filter((item) => item.severityBand === "medium").length,
    low: scored.filter((item) => item.severityBand === "low").length,
    topAnomalyId: scored[0]?.id ?? null,
    status: total > 0 ? "ready" : "blocked",
    anomalies: scored,
  };
}

function classifyAccessAnomalyBand(score) {
  if (score >= 75) return "critical";
  if (score >= 55) return "high";
  if (score >= 30) return "medium";
  return "low";
}

