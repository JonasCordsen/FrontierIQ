import { validateShowbackDimensions } from "./showback-dimensions.mjs";

/**
 * @typedef {{
 *   timestamp: string;
 *   tenantId: string;
 *   solutionId: string;
 *   workload: string;
 *   businessUnit: string;
 *   environment: "prod"|"nonprod";
 *   resourceId: string;
 *   usageQuantity: number;
 *   unitCost: number;
 *   valuePoints: number;
 * }} CostValueRecord
 */

/**
 * @param {CostValueRecord[]} records
 * @returns {{
 *   totals: { totalCost: number; totalValuePoints: number; roiIndex: number; records: number };
 *   bySolution: Record<string, { totalCost: number; totalValuePoints: number; roiIndex: number }>;
 *   byBusinessUnit: Record<string, { totalCost: number; totalValuePoints: number; roiIndex: number }>;
 *   byTenant: Record<string, { totalCost: number; totalValuePoints: number; roiIndex: number }>;
 *   byEnvironment: Record<string, { totalCost: number; totalValuePoints: number; roiIndex: number }>;
 * }}
 */
export function buildCostValueSummary(records) {
  const totals = { totalCost: 0, totalValuePoints: 0, roiIndex: 0, records: 0 };

  /** @type {Record<string, { totalCost: number; totalValuePoints: number; roiIndex: number }>} */
  const bySolution = {};
  /** @type {Record<string, { totalCost: number; totalValuePoints: number; roiIndex: number }>} */
  const byBusinessUnit = {};
  /** @type {Record<string, { totalCost: number; totalValuePoints: number; roiIndex: number }>} */
  const byTenant = {};
  /** @type {Record<string, { totalCost: number; totalValuePoints: number; roiIndex: number }>} */
  const byEnvironment = {};

  for (const record of records) {
    const validation = validateCostValueRecord(record);
    if (!validation.ok) {
      throw new Error(`Invalid cost/value record: ${validation.errors.join("; ")}`);
    }

    const cost = record.usageQuantity * record.unitCost;
    const value = record.valuePoints;

    totals.totalCost += cost;
    totals.totalValuePoints += value;
    totals.records += 1;

    accumulate(bySolution, record.solutionId, cost, value);
    accumulate(byBusinessUnit, record.businessUnit, cost, value);
    accumulate(byTenant, record.tenantId, cost, value);
    accumulate(byEnvironment, record.environment, cost, value);
  }

  totals.roiIndex = roiIndex(totals.totalValuePoints, totals.totalCost);
  finalizeRoi(bySolution);
  finalizeRoi(byBusinessUnit);
  finalizeRoi(byTenant);
  finalizeRoi(byEnvironment);

  return { totals, bySolution, byBusinessUnit, byTenant, byEnvironment };
}

/**
 * @param {CostValueRecord[]} records
 * @param {(record: CostValueRecord) => boolean} threshold
 */
export function detectBudgetAnomalies(records, threshold) {
  return records.filter((record) => threshold(record)).map((record) => ({
    key: `${record.tenantId}:${record.solutionId}:${record.resourceId}`,
    tenantId: record.tenantId,
    solutionId: record.solutionId,
    resourceId: record.resourceId,
    workload: record.workload,
    estimatedCost: record.usageQuantity * record.unitCost,
  }));
}

/**
 * @param {CostValueRecord} record
 * @returns {{ ok: true } | { ok: false; errors: string[] }}
 */
export function validateCostValueRecord(record) {
  /** @type {string[]} */
  const errors = [];
  const dimValidation = validateShowbackDimensions(record);
  if (!dimValidation.ok) {
    errors.push(...dimValidation.errors);
  }

  if (typeof record.timestamp !== "string" || Number.isNaN(Date.parse(record.timestamp))) {
    errors.push("timestamp must be an ISO-8601 datetime string");
  }
  if (typeof record.usageQuantity !== "number" || record.usageQuantity < 0) {
    errors.push("usageQuantity must be a non-negative number");
  }
  if (typeof record.unitCost !== "number" || record.unitCost < 0) {
    errors.push("unitCost must be a non-negative number");
  }
  if (typeof record.valuePoints !== "number" || record.valuePoints < 0) {
    errors.push("valuePoints must be a non-negative number");
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return { ok: true };
}

function roiIndex(valuePoints, totalCost) {
  if (totalCost === 0) return 0;
  return Number((valuePoints / totalCost).toFixed(4));
}

function accumulate(bucket, key, cost, value) {
  if (!bucket[key]) {
    bucket[key] = { totalCost: 0, totalValuePoints: 0, roiIndex: 0 };
  }
  bucket[key].totalCost += cost;
  bucket[key].totalValuePoints += value;
}

function finalizeRoi(bucket) {
  for (const key of Object.keys(bucket)) {
    bucket[key].roiIndex = roiIndex(bucket[key].totalValuePoints, bucket[key].totalCost);
  }
}

