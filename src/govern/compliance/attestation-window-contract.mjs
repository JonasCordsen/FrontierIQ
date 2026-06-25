/**
 * Attestation window contract.
 * Pillar: GOVERN
 *
 * Deterministic attestation scheduling and overdue classification contract.
 */

/**
 * Build attestation windows from records.
 * @param {{ itemId:string, owner:string, lastAttestedAt:string, cadenceDays:number, riskBand?:string }[]} records
 * @param {string} asOf
 * @returns {object[]}
 */
export function buildAttestationWindows(records, asOf) {
  const asOfMs = Date.parse(asOf);
  if (Number.isNaN(asOfMs)) {
    throw new Error("asOf must be a valid ISO date");
  }

  return (Array.isArray(records) ? records : []).map((record) => {
    const lastMs = Date.parse(record.lastAttestedAt);
    const cadenceDays = Number.isFinite(record.cadenceDays) ? record.cadenceDays : 0;
    const dueMs = Number.isNaN(lastMs) ? Number.NaN : lastMs + cadenceDays * 24 * 60 * 60 * 1000;
    const daysUntilDue = Number.isNaN(dueMs) ? null : Math.floor((dueMs - asOfMs) / (24 * 60 * 60 * 1000));
    const status = classifyWindowStatus(daysUntilDue);

    return {
      itemId: record.itemId,
      owner: record.owner,
      riskBand: record.riskBand ?? "medium",
      lastAttestedAt: record.lastAttestedAt,
      cadenceDays,
      dueAt: Number.isNaN(dueMs) ? null : new Date(dueMs).toISOString(),
      daysUntilDue,
      status,
    };
  });
}

/**
 * Summarize attestation windows.
 * @param {object[]} windows
 * @returns {object}
 */
export function summarizeAttestationWindows(windows) {
  const list = Array.isArray(windows) ? windows : [];
  const countByStatus = { overdue: 0, due_now: 0, upcoming: 0, unknown: 0 };
  for (const window of list) {
    const status = countByStatus[window.status] !== undefined ? window.status : "unknown";
    countByStatus[status] += 1;
  }

  return {
    total: list.length,
    overdue: countByStatus.overdue,
    dueNow: countByStatus.due_now,
    upcoming: countByStatus.upcoming,
    unknown: countByStatus.unknown,
    status: countByStatus.overdue > 0 ? "blocked" : "ready",
    countByStatus,
  };
}

/**
 * Build evidence envelope for attestation windows.
 * @param {object[]} records
 * @param {string} asOf
 * @param {string} generatedAt
 * @returns {object}
 */
export function buildAttestationWindowEvidence(records, asOf, generatedAt) {
  const windows = buildAttestationWindows(records, asOf);
  return {
    artifactType: "attestation-windows",
    generatedAt: generatedAt ?? null,
    asOf,
    summary: summarizeAttestationWindows(windows),
    windows,
  };
}

function classifyWindowStatus(daysUntilDue) {
  if (!Number.isFinite(daysUntilDue)) return "unknown";
  if (daysUntilDue < 0) return "overdue";
  if (daysUntilDue === 0) return "due_now";
  return "upcoming";
}

