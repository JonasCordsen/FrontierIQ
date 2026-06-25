/**
 * Data minimization contract.
 * Pillar: SECURE
 *
 * Deterministic minimization and redaction checks for PII-bearing records.
 */

/**
 * Validate minimization policy.
 * @param {{ allowedFields:string[], redactFields:string[] }} policy
 * @returns {{ ok:true } | { ok:false, errors:string[] }}
 */
export function validateMinimizationPolicy(policy) {
  const errors = [];
  if (!Array.isArray(policy?.allowedFields)) errors.push("allowedFields must be an array");
  if (!Array.isArray(policy?.redactFields)) errors.push("redactFields must be an array");
  return errors.length > 0 ? { ok: false, errors } : { ok: true };
}

/**
 * Minimize single data record.
 * @param {Record<string,unknown>} record
 * @param {{ allowedFields:string[], redactFields:string[] }} policy
 * @returns {{ minimized:Record<string,unknown>, droppedFields:string[], redactedFields:string[] }}
 */
export function minimizeDataRecord(record, policy) {
  const allowed = new Set(policy.allowedFields ?? []);
  const redact = new Set(policy.redactFields ?? []);
  const minimized = {};
  const droppedFields = [];
  const redactedFields = [];

  for (const [key, value] of Object.entries(record ?? {})) {
    if (!allowed.has(key)) {
      droppedFields.push(key);
      continue;
    }
    if (redact.has(key)) {
      minimized[key] = "[REDACTED]";
      redactedFields.push(key);
      continue;
    }
    minimized[key] = value;
  }

  return { minimized, droppedFields, redactedFields };
}

/**
 * Build minimization audit envelope.
 * @param {Record<string,unknown>[]} records
 * @param {{ allowedFields:string[], redactFields:string[] }} policy
 * @param {string} generatedAt
 * @returns {object}
 */
export function buildMinimizationAudit(records, policy, generatedAt) {
  const policyValidation = validateMinimizationPolicy(policy);
  if (!policyValidation.ok) {
    return {
      artifactType: "data-minimization-audit",
      generatedAt: generatedAt ?? null,
      status: "blocked",
      errors: policyValidation.errors,
      summary: { totalRecords: 0, totalDroppedFields: 0, totalRedactedFields: 0 },
      records: [],
    };
  }

  const list = Array.isArray(records) ? records : [];
  const results = list.map((record) => minimizeDataRecord(record, policy));
  const totalDroppedFields = results.reduce((acc, item) => acc + item.droppedFields.length, 0);
  const totalRedactedFields = results.reduce((acc, item) => acc + item.redactedFields.length, 0);

  return {
    artifactType: "data-minimization-audit",
    generatedAt: generatedAt ?? null,
    status: "ready",
    errors: [],
    summary: {
      totalRecords: list.length,
      totalDroppedFields,
      totalRedactedFields,
    },
    records: results,
  };
}

