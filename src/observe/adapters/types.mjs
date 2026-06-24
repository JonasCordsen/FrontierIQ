import { validateNormalizedSignal } from "../foundation/normalized-signal.mjs";

/**
 * @template TRaw
 * @typedef {{
 *   id: string;
 *   solutionId: string;
 *   map: (payload: TRaw) => AdapterMappingResult;
 * }} SignalAdapter
 */

/**
 * @typedef {{
 *   ok: true;
 *   signals: import("../foundation/normalized-signal.mjs").NormalizedSignal[];
 * }} AdapterMappingSuccess
 */

/**
 * @typedef {{
 *   ok: false;
 *   code: "invalid_payload" | "mapping_error";
 *   errors: string[];
 * }} AdapterMappingFailure
 */

/**
 * @typedef {AdapterMappingSuccess | AdapterMappingFailure} AdapterMappingResult
 */

/**
 * @param {import("../foundation/normalized-signal.mjs").NormalizedSignal[]} signals
 * @returns {AdapterMappingResult}
 */
export function adapterSuccess(signals) {
  /** @type {string[]} */
  const errors = [];

  for (const [index, signal] of signals.entries()) {
    const validation = validateNormalizedSignal(signal);
    if (!validation.ok) {
      errors.push(`signals[${index}]: ${validation.errors.join(", ")}`);
    }
  }

  if (errors.length > 0) {
    return {
      ok: false,
      code: "mapping_error",
      errors,
    };
  }

  return { ok: true, signals };
}

/**
 * @param {AdapterMappingFailure["code"]} code
 * @param {string | string[]} errors
 * @returns {AdapterMappingResult}
 */
export function adapterFailure(code, errors) {
  return { ok: false, code, errors: Array.isArray(errors) ? errors : [errors] };
}

/**
 * @param {unknown} payload
 * @returns {payload is {
 *   tenantId: string;
 *   timestamp: string;
 *   signals: Array<{
 *     signalType: string;
 *     severity: "critical"|"high"|"medium"|"low"|"info";
 *     confidence: number;
 *     freshnessMinutes: number;
 *     workload: string;
 *     resourceId: string;
 *     dimensions?: Record<string, string|number|boolean>;
 *     evidence?: Record<string, string|number|boolean>;
 *   }>
 * }}
 */
export function isBasePayload(payload) {
  if (!payload || typeof payload !== "object") return false;
  const value = /** @type {Record<string, unknown>} */ (payload);
  if (typeof value.tenantId !== "string" || !value.tenantId) return false;
  if (typeof value.timestamp !== "string" || Number.isNaN(Date.parse(value.timestamp))) return false;
  if (!Array.isArray(value.signals)) return false;

  return value.signals.every((entry) => {
    if (!entry || typeof entry !== "object") return false;
    const signal = /** @type {Record<string, unknown>} */ (entry);
    return (
      typeof signal.signalType === "string" &&
      typeof signal.severity === "string" &&
      typeof signal.confidence === "number" &&
      typeof signal.freshnessMinutes === "number" &&
      typeof signal.workload === "string" &&
      typeof signal.resourceId === "string"
    );
  });
}

