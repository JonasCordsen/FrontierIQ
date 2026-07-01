/**
 * Governance waiver audit trail contract.
 * Pillar: GOVERN
 *
 * Deterministic waiver change log and approval lineage evidence.
 */

const ALLOWED_EVENT_TYPES = new Set([
  "created",
  "submitted",
  "approved",
  "extended",
  "expired",
  "revoked",
]);

/**
 * Append deterministic waiver audit event.
 * @param {object[]} trail
 * @param {{ waiverId:string, eventType:string, actor:string, at:string, reason?:string }} event
 * @returns {{ ok:true, trail:object[] } | { ok:false, errors:string[] }}
 */
export function appendWaiverAuditEvent(trail, event) {
  const errors = [];
  if (!event?.waiverId) errors.push("waiverId is required");
  if (!ALLOWED_EVENT_TYPES.has(event?.eventType)) errors.push("eventType is invalid");
  if (!event?.actor) errors.push("actor is required");
  if (!isIsoDate(event?.at)) errors.push("at must be valid ISO date");
  if (errors.length > 0) return { ok: false, errors };

  const list = Array.isArray(trail) ? [...trail] : [];
  list.push({
    waiverId: event.waiverId,
    eventType: event.eventType,
    actor: event.actor,
    at: event.at,
    reason: event.reason ?? null,
  });
  list.sort((left, right) => Date.parse(left.at) - Date.parse(right.at));
  return { ok: true, trail: list };
}

/**
 * Build approver lineage for one waiver.
 * @param {object[]} trail
 * @param {string} waiverId
 * @returns {{ waiverId:string, events:object[], approvers:string[] }}
 */
export function buildWaiverApprovalLineage(trail, waiverId) {
  const events = (Array.isArray(trail) ? trail : [])
    .filter((item) => item?.waiverId === waiverId)
    .sort((left, right) => Date.parse(left.at) - Date.parse(right.at));
  const approvers = [...new Set(events.filter((item) => item.eventType === "approved").map((item) => item.actor))];
  return { waiverId, events, approvers };
}

/**
 * Summarize waiver trail status.
 * @param {object[]} trail
 * @returns {object}
 */
export function summarizeWaiverAuditTrail(trail) {
  const list = Array.isArray(trail) ? trail : [];
  const uniqueWaivers = [...new Set(list.map((item) => item.waiverId))];
  return {
    totalEvents: list.length,
    totalWaivers: uniqueWaivers.length,
    approvedEvents: list.filter((item) => item.eventType === "approved").length,
    revokedEvents: list.filter((item) => item.eventType === "revoked").length,
    expiredEvents: list.filter((item) => item.eventType === "expired").length,
    status: uniqueWaivers.length > 0 ? "ready" : "blocked",
  };
}

function isIsoDate(value) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

