import { SOLUTION_CATALOG } from "../../observe/foundation/solution-taxonomy.mjs";

const PILLARS = Object.freeze(["observe", "govern", "secure", "optimize"]);

/**
 * @typedef {{
 *   tenantId: string;
 *   solutionId: string;
 *   pillarScores: {
 *     observe: number;
 *     govern: number;
 *     secure: number;
 *     optimize: number;
 *   };
 * }} MaturityInput
 */

/**
 * @param {MaturityInput[]} inputs
 */
export function buildMaturityScorecard(inputs) {
  /** @type {Record<string, {
   *   tenantId: string;
   *   solutionScores: Record<string, { overall: number; pillars: Record<string, number> }>;
   *   overall: number;
   * }} */
  const byTenant = {};

  for (const input of inputs) {
    const validation = validateMaturityInput(input);
    if (!validation.ok) {
      throw new Error(`Invalid maturity input: ${validation.errors.join("; ")}`);
    }

    if (!byTenant[input.tenantId]) {
      byTenant[input.tenantId] = {
        tenantId: input.tenantId,
        solutionScores: {},
        overall: 0,
      };
    }

    const pillarTotals = PILLARS.reduce((acc, pillar) => acc + input.pillarScores[pillar], 0);
    const overall = round(pillarTotals / PILLARS.length);

    byTenant[input.tenantId].solutionScores[input.solutionId] = {
      overall,
      pillars: { ...input.pillarScores },
    };
  }

  for (const tenant of Object.values(byTenant)) {
    const solutionValues = Object.values(tenant.solutionScores).map((score) => score.overall);
    tenant.overall = solutionValues.length ? round(avg(solutionValues)) : 0;
  }

  return { byTenant };
}

/**
 * @param {ReturnType<typeof buildMaturityScorecard>} scorecard
 */
export function summarizeMaturity(scorecard) {
  const tenants = Object.values(scorecard.byTenant);
  const overall = tenants.length ? round(avg(tenants.map((tenant) => tenant.overall))) : 0;
  return {
    tenants: tenants.length,
    overall,
  };
}

/**
 * @param {MaturityInput} input
 * @returns {{ ok: true } | { ok: false; errors: string[] }}
 */
export function validateMaturityInput(input) {
  /** @type {string[]} */
  const errors = [];
  if (!input || typeof input !== "object") {
    return { ok: false, errors: ["input must be an object"] };
  }
  if (typeof input.tenantId !== "string" || !input.tenantId) {
    errors.push("tenantId must be a non-empty string");
  }
  if (
    typeof input.solutionId !== "string" ||
    !SOLUTION_CATALOG.some((solution) => solution.id === input.solutionId)
  ) {
    errors.push("solutionId must be known");
  }
  if (!input.pillarScores || typeof input.pillarScores !== "object") {
    errors.push("pillarScores must be an object");
  } else {
    for (const pillar of PILLARS) {
      const score = input.pillarScores[pillar];
      if (typeof score !== "number" || score < 0 || score > 100) {
        errors.push(`${pillar} score must be between 0 and 100`);
      }
    }
  }
  if (errors.length > 0) return { ok: false, errors };
  return { ok: true };
}

function avg(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round(value) {
  return Number(value.toFixed(2));
}

