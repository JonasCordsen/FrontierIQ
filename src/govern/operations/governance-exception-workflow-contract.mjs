/**
 * Governance exception workflow contract.
 * Pillar: GOVERN
 *
 * Deterministic lifecycle, approval, and expiry handling for governance
 * exceptions.
 */

const EXCEPTION_STATES = Object.freeze([
  "requested",
  "under_review",
  "approved",
  "implemented",
  "rejected",
  "expired",
  "closed",
]);

const ALLOWED_TRANSITIONS = Object.freeze({
  requested: ["under_review", "rejected", "expired"],
  under_review: ["approved", "rejected", "expired"],
  approved: ["implemented", "expired", "closed"],
  implemented: ["closed", "expired"],
  rejected: ["closed"],
  expired: ["closed"],
  closed: [],
});

/**
 * Create governance exception request.
 * @param {{ id:string, tenantId:string, controlId:string, requestedBy:string, justification:string, expiresAt:string, requestedAt?:string }} input
 * @returns {{ ok:true, request:object } | { ok:false, errors:string[] }}
 */
export function createExceptionRequest(input) {
  const errors = [];
  if (!input?.id) errors.push("id is required");
  if (!input?.tenantId) errors.push("tenantId is required");
  if (!input?.controlId) errors.push("controlId is required");
  if (!input?.requestedBy) errors.push("requestedBy is required");
  if (!input?.justification) errors.push("justification is required");
  if (!isIsoDate(input?.expiresAt)) errors.push("expiresAt must be valid ISO date");
  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    request: {
      id: input.id,
      tenantId: input.tenantId,
      controlId: input.controlId,
      requestedBy: input.requestedBy,
      justification: input.justification,
      expiresAt: input.expiresAt,
      requestedAt: input.requestedAt ?? null,
      state: "requested",
      history: [],
    },
  };
}

/**
 * Advance exception state with transition checks.
 * @param {object} request
 * @param {{ to:string, actor:string, reason:string, at:string }} event
 * @returns {{ ok:true, request:object } | { ok:false, errors:string[] }}
 */
export function advanceExceptionState(request, event) {
  const errors = [];
  if (!request?.id) errors.push("request is required");
  if (!ALLOWED_TRANSITIONS[request?.state]) errors.push("request state is invalid");
  if (!EXCEPTION_STATES.includes(event?.to)) errors.push("target state is invalid");
  if (!event?.actor) errors.push("actor is required");
  if (!event?.reason) errors.push("reason is required");
  if (!isIsoDate(event?.at)) errors.push("event.at must be valid ISO date");
  if (errors.length > 0) return { ok: false, errors };

  const allowed = ALLOWED_TRANSITIONS[request.state];
  if (!allowed.includes(event.to)) {
    return { ok: false, errors: [`transition ${request.state} -> ${event.to} is not allowed`] };
  }

  const isExpired = isIsoDate(request.expiresAt) && Date.parse(event.at) > Date.parse(request.expiresAt);
  if (isExpired && event.to !== "expired" && event.to !== "closed") {
    return { ok: false, errors: ["exception has expired"] };
  }

  return {
    ok: true,
    request: {
      ...request,
      state: event.to,
      history: [
        ...(Array.isArray(request.history) ? request.history : []),
        {
          from: request.state,
          to: event.to,
          actor: event.actor,
          reason: event.reason,
          at: event.at,
        },
      ],
    },
  };
}

/**
 * Summarize exception portfolio health.
 * @param {object[]} requests
 * @param {string} asOf
 * @returns {object}
 */
export function summarizeExceptionPortfolio(requests, asOf) {
  const list = Array.isArray(requests) ? requests : [];
  const asOfMs = isIsoDate(asOf) ? Date.parse(asOf) : Number.NaN;
  const countByState = Object.fromEntries(EXCEPTION_STATES.map((state) => [state, 0]));
  let overdue = 0;

  for (const request of list) {
    const state = EXCEPTION_STATES.includes(request?.state) ? request.state : "requested";
    countByState[state] += 1;
    const expired = isIsoDate(request?.expiresAt) && !Number.isNaN(asOfMs) && Date.parse(request.expiresAt) < asOfMs;
    if (expired && !["closed", "expired", "rejected"].includes(state)) overdue += 1;
  }

  return {
    total: list.length,
    asOf: isIsoDate(asOf) ? asOf : null,
    overdue,
    countByState,
    status: overdue === 0 ? "ready" : "blocked",
  };
}

function isIsoDate(value) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

