/**
 * Ingestion replay recovery contract.
 * Pillar: OBSERVE
 *
 * Deterministic replay windows, dedupe validation, and backlog-clearance evidence.
 */

/**
 * Build replay windows from failed ingestion points.
 * @param {{ sourceId:string, failedAt:string, resumedAt?:string, reason?:string }[]} failures
 * @param {number} maxWindowMinutes
 * @returns {object[]}
 */
export function planReplayWindows(failures, maxWindowMinutes = 60) {
  const capMinutes = Number.isFinite(maxWindowMinutes) ? Math.max(5, maxWindowMinutes) : 60;
  return (Array.isArray(failures) ? failures : []).map((failure) => {
    const failedAtMs = Date.parse(failure?.failedAt);
    const resumedAtMs = Date.parse(failure?.resumedAt);
    const fallbackEndMs = Number.isFinite(failedAtMs) ? failedAtMs + capMinutes * 60_000 : Number.NaN;
    const endMs = Number.isFinite(resumedAtMs)
      ? Math.min(resumedAtMs, fallbackEndMs)
      : fallbackEndMs;
    return {
      sourceId: failure?.sourceId ?? null,
      startAt: Number.isFinite(failedAtMs) ? new Date(failedAtMs).toISOString() : null,
      endAt: Number.isFinite(endMs) ? new Date(endMs).toISOString() : null,
      reason: failure?.reason ?? "unknown",
      plannedWindowMinutes: Number.isFinite(failedAtMs) && Number.isFinite(endMs)
        ? Math.max(0, Math.round((endMs - failedAtMs) / 60_000))
        : 0,
    };
  });
}

/**
 * Evaluate dedupe safety for replay batch.
 * @param {{ sourceId:string, signalId:string, fingerprint:string }[]} replayItems
 * @returns {{ total:number, unique:number, duplicates:number, duplicateRatio:number, status:'ready'|'blocked' }}
 */
export function evaluateReplayDedupSafety(replayItems) {
  const list = Array.isArray(replayItems) ? replayItems : [];
  const seen = new Set();
  let duplicates = 0;

  for (const item of list) {
    const key = `${item?.sourceId ?? ""}|${item?.signalId ?? ""}|${item?.fingerprint ?? ""}`;
    if (seen.has(key)) {
      duplicates += 1;
    } else {
      seen.add(key);
    }
  }

  const total = list.length;
  const unique = seen.size;
  const duplicateRatio = total > 0 ? Number((duplicates / total).toFixed(4)) : 0;
  return {
    total,
    unique,
    duplicates,
    duplicateRatio,
    status: duplicateRatio <= 0.05 ? "ready" : "blocked",
  };
}

/**
 * Build replay recovery evidence envelope.
 * @param {object[]} windows
 * @param {ReturnType<typeof evaluateReplayDedupSafety>} dedupe
 * @param {string} generatedAt
 * @returns {object}
 */
export function buildReplayRecoveryEvidence(windows, dedupe, generatedAt) {
  const planned = Array.isArray(windows) ? windows : [];
  const backlogMinutes = planned.reduce((acc, item) => acc + (item.plannedWindowMinutes ?? 0), 0);
  return {
    artifactType: "ingestion-replay-recovery",
    generatedAt: generatedAt ?? null,
    summary: {
      replayWindows: planned.length,
      backlogMinutes,
      dedupeStatus: dedupe?.status ?? "blocked",
      duplicateRatio: dedupe?.duplicateRatio ?? 1,
    },
    windows: planned,
    dedupe: dedupe ?? evaluateReplayDedupSafety([]),
  };
}

