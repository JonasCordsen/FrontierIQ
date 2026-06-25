/**
 * Governance waiver registry contract.
 * Pillar: GOVERN
 *
 * Deterministic waiver catalog, ownership, and expiry enforcement.
 */

/**
 * Register governance waiver entry.
 * @param {{ waiverId:string, tenantId:string, controlId:string, owner:string, justification:string, expiresAt:string, approvedAt?:string }} waiver
 * @returns {{ ok:true, waiver:object } | { ok:false, errors:string[] }}
 */
export function registerGovernanceWaiver(waiver) {
  const errors = [];
  if (!waiver?.waiverId) errors.push("waiverId is required");
  if (!waiver?.tenantId) errors.push("tenantId is required");
  if (!waiver?.controlId) errors.push("controlId is required");
  if (!waiver?.owner) errors.push("owner is required");
  if (!waiver?.justification) errors.push("justification is required");
  if (!isIsoDate(waiver?.expiresAt)) errors.push("expiresAt must be valid ISO date");
  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    waiver: {
      ...waiver,
      approvedAt: waiver.approvedAt ?? null,
      state: "active",
    },
  };
}

/**
 * Enforce waiver expiries.
 * @param {object[]} waivers
 * @param {string} asOf
 * @returns {object[]}
 */
export function enforceWaiverExpiry(waivers, asOf) {
  const asOfMs = Date.parse(asOf);
  return (Array.isArray(waivers) ? waivers : []).map((waiver) => {
    const expired = Number.isFinite(asOfMs) && isIsoDate(waiver?.expiresAt) && Date.parse(waiver.expiresAt) < asOfMs;
    return {
      ...waiver,
      state: expired ? "expired" : waiver.state ?? "active",
    };
  });
}

/**
 * Summarize waiver registry status.
 * @param {object[]} waivers
 * @returns {object}
 */
export function summarizeWaiverRegistry(waivers) {
  const list = Array.isArray(waivers) ? waivers : [];
  const active = list.filter((item) => item.state === "active").length;
  const expired = list.filter((item) => item.state === "expired").length;
  return {
    total: list.length,
    active,
    expired,
    status: expired === 0 ? "ready" : "blocked",
  };
}

function isIsoDate(value) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

