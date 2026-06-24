const LIFECYCLE_STATES = Object.freeze([
  "draft",
  "pilot",
  "approved",
  "production",
  "deprecated",
  "archived",
]);

const ALLOWED_TRANSITIONS = Object.freeze({
  draft: ["pilot", "archived"],
  pilot: ["approved", "deprecated", "archived"],
  approved: ["production", "deprecated", "archived"],
  production: ["deprecated", "archived"],
  deprecated: ["archived"],
  archived: [],
});

/**
 * @param {"draft"|"pilot"|"approved"|"production"|"deprecated"|"archived"} from
 * @param {"draft"|"pilot"|"approved"|"production"|"deprecated"|"archived"} to
 */
export function canTransitionLifecycle(from, to) {
  const allowed = ALLOWED_TRANSITIONS[from] ?? [];
  return allowed.includes(to);
}

/**
 * @param {{
 *   itemId: string;
 *   currentState: string;
 *   nextState: string;
 *   changedBy: string;
 *   reason: string;
 * }} event
 */
export function applyLifecycleTransition(event) {
  const errors = [];
  if (!event.itemId) errors.push("itemId is required");
  if (!LIFECYCLE_STATES.includes(event.currentState)) errors.push("currentState is invalid");
  if (!LIFECYCLE_STATES.includes(event.nextState)) errors.push("nextState is invalid");
  if (!event.changedBy) errors.push("changedBy is required");
  if (!event.reason) errors.push("reason is required");
  if (errors.length > 0) return { ok: false, errors };

  if (!canTransitionLifecycle(event.currentState, event.nextState)) {
    return {
      ok: false,
      errors: [`Transition ${event.currentState} -> ${event.nextState} is not allowed.`],
    };
  }

  return {
    ok: true,
    change: {
      itemId: event.itemId,
      from: event.currentState,
      to: event.nextState,
      changedBy: event.changedBy,
      reason: event.reason,
      changedAt: new Date().toISOString(),
    },
  };
}

/**
 * @param {{
 *   itemId: string;
 *   owner: string;
 *   lastAttestedAt: string;
 *   cadenceDays: number;
 * }[]} records
 * @param {string} asOfIso
 */
export function findDueAttestations(records, asOfIso) {
  const asOf = new Date(asOfIso).getTime();
  if (Number.isNaN(asOf)) {
    throw new Error("asOfIso must be an ISO datetime");
  }
  return records.filter((record) => {
    const last = new Date(record.lastAttestedAt).getTime();
    const dueAt = last + record.cadenceDays * 24 * 60 * 60 * 1000;
    return !Number.isNaN(last) && dueAt <= asOf;
  });
}

export function listLifecycleStates() {
  return [...LIFECYCLE_STATES];
}

