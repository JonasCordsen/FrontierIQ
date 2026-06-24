/**
 * @typedef {{
 *   timestamp: string;
 *   tenantId: string;
 *   solutionId: string;
 *   workload: string;
 *   businessUnit: string;
 *   assignedSeats: number;
 *   activeSeats: number;
 *   provisionedSeats: number;
 * }} LicenseUtilizationRecord
 */

/**
 * @param {LicenseUtilizationRecord[]} records
 */
export function summarizeLicenseUtilization(records) {
  const totals = {
    assignedSeats: 0,
    activeSeats: 0,
    provisionedSeats: 0,
    strandedSeats: 0,
    utilizationRate: 0,
    activationRate: 0,
    records: 0,
  };

  /** @type {Record<string, { assignedSeats: number; activeSeats: number; provisionedSeats: number; strandedSeats: number; utilizationRate: number; activationRate: number }>} */
  const byWorkload = {};
  /** @type {Record<string, { assignedSeats: number; activeSeats: number; provisionedSeats: number; strandedSeats: number; utilizationRate: number; activationRate: number }>} */
  const byTenant = {};
  /** @type {Record<string, { assignedSeats: number; activeSeats: number; provisionedSeats: number; strandedSeats: number; utilizationRate: number; activationRate: number }>} */
  const byBusinessUnit = {};

  for (const record of records) {
    const validation = validateLicenseUtilizationRecord(record);
    if (!validation.ok) {
      throw new Error(`Invalid license utilization record: ${validation.errors.join("; ")}`);
    }

    totals.assignedSeats += record.assignedSeats;
    totals.activeSeats += record.activeSeats;
    totals.provisionedSeats += record.provisionedSeats;
    totals.strandedSeats += record.assignedSeats - record.activeSeats;
    totals.records += 1;

    accumulate(byWorkload, record.workload, record);
    accumulate(byTenant, record.tenantId, record);
    accumulate(byBusinessUnit, record.businessUnit, record);
  }

  finalizeRates(totals);
  finalizeRatesForBucket(byWorkload);
  finalizeRatesForBucket(byTenant);
  finalizeRatesForBucket(byBusinessUnit);

  return { totals, byWorkload, byTenant, byBusinessUnit };
}

/**
 * @param {LicenseUtilizationRecord} record
 * @returns {{ ok: true } | { ok: false; errors: string[] }}
 */
export function validateLicenseUtilizationRecord(record) {
  /** @type {string[]} */
  const errors = [];

  if (typeof record.timestamp !== "string" || Number.isNaN(Date.parse(record.timestamp))) {
    errors.push("timestamp must be an ISO-8601 datetime string");
  }
  for (const field of ["tenantId", "solutionId", "workload", "businessUnit"]) {
    if (typeof record[field] !== "string" || !record[field]) {
      errors.push(`${field} must be a non-empty string`);
    }
  }
  for (const field of ["assignedSeats", "activeSeats", "provisionedSeats"]) {
    if (typeof record[field] !== "number" || Number.isNaN(record[field]) || record[field] < 0) {
      errors.push(`${field} must be a non-negative number`);
    }
  }
  if (typeof record.activeSeats === "number" && typeof record.assignedSeats === "number" &&
      record.activeSeats > record.assignedSeats) {
    errors.push("activeSeats must be <= assignedSeats");
  }
  if (typeof record.assignedSeats === "number" && typeof record.provisionedSeats === "number" &&
      record.assignedSeats > record.provisionedSeats) {
    errors.push("assignedSeats must be <= provisionedSeats");
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true };
}

function accumulate(bucket, key, record) {
  if (!bucket[key]) {
    bucket[key] = {
      assignedSeats: 0,
      activeSeats: 0,
      provisionedSeats: 0,
      strandedSeats: 0,
      utilizationRate: 0,
      activationRate: 0,
    };
  }

  bucket[key].assignedSeats += record.assignedSeats;
  bucket[key].activeSeats += record.activeSeats;
  bucket[key].provisionedSeats += record.provisionedSeats;
  bucket[key].strandedSeats += record.assignedSeats - record.activeSeats;
}

function finalizeRates(target) {
  target.utilizationRate = rate(target.activeSeats, target.assignedSeats);
  target.activationRate = rate(target.assignedSeats, target.provisionedSeats);
}

function finalizeRatesForBucket(bucket) {
  for (const value of Object.values(bucket)) {
    finalizeRates(value);
  }
}

function rate(numerator, denominator) {
  if (denominator === 0) return 0;
  return Number((numerator / denominator).toFixed(4));
}
