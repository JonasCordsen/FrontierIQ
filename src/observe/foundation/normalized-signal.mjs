import { isKnownSolution } from "./solution-taxonomy.mjs";

const SEVERITIES = new Set(["critical", "high", "medium", "low", "info"]);

/**
 * @typedef {{
 *   tenantId: string;
 *   solutionId: string;
 *   workload: string;
 *   resourceId: string;
 *   source: string;
 *   timestamp: string;
 *   signalType: string;
 *   severity: "critical"|"high"|"medium"|"low"|"info";
 *   confidence: number;
 *   freshnessMinutes: number;
 *   dimensions: Record<string, string | number | boolean>;
 *   evidence: Record<string, string | number | boolean>;
 * }} NormalizedSignal
 */

/**
 * @param {unknown} value
 * @returns {{ ok: true; value: NormalizedSignal } | { ok: false; errors: string[] }}
 */
export function validateNormalizedSignal(value) {
  /** @type {string[]} */
  const errors = [];
  const signal = /** @type {Record<string, unknown>} */ (value);

  if (!signal || typeof signal !== "object") {
    return { ok: false, errors: ["Signal must be an object."] };
  }

  const requiredStringFields = [
    "tenantId",
    "solutionId",
    "workload",
    "resourceId",
    "source",
    "timestamp",
    "signalType",
  ];

  for (const field of requiredStringFields) {
    if (typeof signal[field] !== "string" || !signal[field]) {
      errors.push(`${field} must be a non-empty string.`);
    }
  }

  if (typeof signal.solutionId === "string" && !isKnownSolution(signal.solutionId)) {
    errors.push(`solutionId is unknown: ${signal.solutionId}`);
  }

  if (typeof signal.severity !== "string" || !SEVERITIES.has(signal.severity)) {
    errors.push("severity must be one of critical|high|medium|low|info.");
  }

  if (typeof signal.confidence !== "number" || Number.isNaN(signal.confidence)) {
    errors.push("confidence must be a number.");
  } else if (signal.confidence < 0 || signal.confidence > 1) {
    errors.push("confidence must be between 0 and 1.");
  }

  if (typeof signal.freshnessMinutes !== "number" || Number.isNaN(signal.freshnessMinutes)) {
    errors.push("freshnessMinutes must be a number.");
  } else if (signal.freshnessMinutes < 0) {
    errors.push("freshnessMinutes must be >= 0.");
  }

  if (!isPlainObject(signal.dimensions)) {
    errors.push("dimensions must be an object.");
  }

  if (!isPlainObject(signal.evidence)) {
    errors.push("evidence must be an object.");
  }

  if (typeof signal.timestamp === "string" && Number.isNaN(Date.parse(signal.timestamp))) {
    errors.push("timestamp must be a valid ISO-8601 datetime string.");
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, value: /** @type {NormalizedSignal} */ (signal) };
}

/**
 * @param {NormalizedSignal} signal
 * @returns {NormalizedSignal}
 */
export function createNormalizedSignal(signal) {
  const validation = validateNormalizedSignal(signal);
  if (!validation.ok) {
    throw new Error(`Invalid normalized signal: ${validation.errors.join("; ")}`);
  }
  return validation.value;
}

/**
 * @param {NormalizedSignal[]} signals
 * @param {{ staleAfterMinutes?: number }} options
 */
export function summarizeSignalFreshness(signals, options = {}) {
  const staleAfterMinutes = options.staleAfterMinutes ?? 60;
  if (typeof staleAfterMinutes !== "number" || Number.isNaN(staleAfterMinutes) || staleAfterMinutes < 0) {
    throw new Error("staleAfterMinutes must be a non-negative number");
  }

  /** @type {Record<string, { totalSignals: number; staleCount: number; freshCount: number; averageFreshnessMinutes: number; maxFreshnessMinutes: number; freshnessSum: number }>} */
  const byWorkload = {};
  let staleCount = 0;
  let freshnessSum = 0;
  let maxFreshnessMinutes = 0;

  for (const signal of signals) {
    const validated = createNormalizedSignal(signal);
    const isStale = validated.freshnessMinutes > staleAfterMinutes;
    staleCount += isStale ? 1 : 0;
    freshnessSum += validated.freshnessMinutes;
    maxFreshnessMinutes = Math.max(maxFreshnessMinutes, validated.freshnessMinutes);

    if (!byWorkload[validated.workload]) {
      byWorkload[validated.workload] = {
        totalSignals: 0,
        staleCount: 0,
        freshCount: 0,
        averageFreshnessMinutes: 0,
        maxFreshnessMinutes: 0,
        freshnessSum: 0,
      };
    }
    byWorkload[validated.workload].totalSignals += 1;
    byWorkload[validated.workload].staleCount += isStale ? 1 : 0;
    byWorkload[validated.workload].freshCount += isStale ? 0 : 1;
    byWorkload[validated.workload].freshnessSum += validated.freshnessMinutes;
    byWorkload[validated.workload].maxFreshnessMinutes = Math.max(
      byWorkload[validated.workload].maxFreshnessMinutes,
      validated.freshnessMinutes
    );
  }

  for (const workload of Object.keys(byWorkload)) {
    byWorkload[workload].averageFreshnessMinutes = byWorkload[workload].totalSignals
      ? Number((byWorkload[workload].freshnessSum / byWorkload[workload].totalSignals).toFixed(4))
      : 0;
    delete byWorkload[workload].freshnessSum;
  }

  return {
    staleAfterMinutes,
    totalSignals: signals.length,
    staleCount,
    freshCount: signals.length - staleCount,
    averageFreshnessMinutes: signals.length ? Number((freshnessSum / signals.length).toFixed(4)) : 0,
    maxFreshnessMinutes,
    byWorkload,
  };
}

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
