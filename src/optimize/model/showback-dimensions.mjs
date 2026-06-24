export const SHOWBACK_DIMENSIONS = Object.freeze([
  "tenantId",
  "solutionId",
  "workload",
  "businessUnit",
  "environment",
  "resourceId",
]);

/**
 * @typedef {{
 *   tenantId: string;
 *   solutionId: string;
 *   workload: string;
 *   businessUnit: string;
 *   environment: "prod"|"nonprod";
 *   resourceId: string;
 * }} ShowbackDimensions
 */

/**
 * @param {Record<string, unknown>} input
 * @returns {{ ok: true; dimensions: ShowbackDimensions } | { ok: false; errors: string[] }}
 */
export function validateShowbackDimensions(input) {
  /** @type {string[]} */
  const errors = [];

  for (const key of SHOWBACK_DIMENSIONS) {
    if (typeof input[key] !== "string" || !input[key]) {
      errors.push(`${key} must be a non-empty string`);
    }
  }

  if (input.environment !== "prod" && input.environment !== "nonprod") {
    errors.push("environment must be prod or nonprod");
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    dimensions: /** @type {ShowbackDimensions} */ (input),
  };
}

