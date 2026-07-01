/**
 * Cost attribution adapter contract.
 * Pillar: OPTIMIZE
 *
 * Maps usage records to deterministic cost attribution rows grouped by coaching
 * pillar and generates evidence summaries.
 */

import { validateCostValueRecord } from "./cost-value-model.mjs";

const PILLAR_HINTS = Object.freeze([
  { pillar: "GOVERN", tokens: ["govern", "policy", "compliance", "onboarding", "approval"] },
  { pillar: "SECURE", tokens: ["secure", "identity", "overshare", "threat", "auth"] },
  { pillar: "OBSERVE", tokens: ["observe", "ingestion", "telemetry", "monitor", "signal"] },
]);

/**
 * Map usage records to pillar-attributed rows.
 * @param {object[]} records
 * @returns {{ ok: true, rows: object[] } | { ok: false, reason: string, errors: string[] }}
 */
export function mapUsageToCostAttribution(records) {
  if (!Array.isArray(records)) {
    return { ok: false, reason: "invalid_input", errors: ["records must be an array"] };
  }

  const rows = [];
  for (const record of records) {
    const validated = validateCostValueRecord(record);
    if (!validated.ok) return { ok: false, reason: "invalid_record", errors: validated.errors };

    if (
      !Number.isFinite(record.usageQuantity) ||
      !Number.isFinite(record.unitCost) ||
      !Number.isFinite(record.valuePoints)
    ) {
      return { ok: false, reason: "invalid_record", errors: ["numeric fields must be finite numbers"] };
    }

    const totalCost = Number((record.usageQuantity * record.unitCost).toFixed(4));
    const totalValuePoints = Number(record.valuePoints.toFixed(4));
    rows.push({
      tenantId: record.tenantId,
      solutionId: record.solutionId,
      workload: record.workload,
      businessUnit: record.businessUnit,
      environment: record.environment,
      resourceId: record.resourceId,
      timestamp: record.timestamp,
      pillar: inferPillar(record),
      totalCost,
      totalValuePoints,
      roiIndex: totalCost > 0 ? Number((totalValuePoints / totalCost).toFixed(4)) : 0,
    });
  }

  return { ok: true, rows };
}

/**
 * Summarize attributed rows by pillar.
 * @param {object[]} rows
 * @returns {object}
 */
export function summarizeCostAttributionByPillar(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const byPillar = {};
  for (const row of list) {
    const pillar = row?.pillar ?? "OPTIMIZE";
    if (!byPillar[pillar]) {
      byPillar[pillar] = { totalCost: 0, totalValuePoints: 0, recordCount: 0, avgRoi: 0, sharePercent: 0 };
    }
    byPillar[pillar].totalCost += row.totalCost ?? 0;
    byPillar[pillar].totalValuePoints += row.totalValuePoints ?? 0;
    byPillar[pillar].recordCount += 1;
  }

  const totalCost = Object.values(byPillar).reduce((acc, item) => acc + item.totalCost, 0);
  for (const pillar of Object.keys(byPillar)) {
    byPillar[pillar].totalCost = Number(byPillar[pillar].totalCost.toFixed(4));
    byPillar[pillar].totalValuePoints = Number(byPillar[pillar].totalValuePoints.toFixed(4));
    byPillar[pillar].avgRoi = byPillar[pillar].totalCost > 0
      ? Number((byPillar[pillar].totalValuePoints / byPillar[pillar].totalCost).toFixed(4))
      : 0;
    byPillar[pillar].sharePercent = totalCost > 0
      ? Number(((byPillar[pillar].totalCost / totalCost) * 100).toFixed(2))
      : 0;
  }

  return {
    records: list.length,
    totalCost: Number(totalCost.toFixed(4)),
    byPillar,
  };
}

/**
 * Build evidence envelope for attributed cost rows.
 * @param {object[]} rows
 * @param {string} generatedAt
 * @returns {object}
 */
export function buildCostAttributionEvidence(rows, generatedAt) {
  const list = Array.isArray(rows) ? rows : [];
  return {
    artifactType: "cost-attribution",
    generatedAt: generatedAt ?? null,
    summary: summarizeCostAttributionByPillar(list),
    rows: list,
  };
}

function inferPillar(record) {
  const candidate = `${record?.workload ?? ""} ${record?.solutionId ?? ""}`.toLowerCase();
  for (const hint of PILLAR_HINTS) {
    if (hint.tokens.some((token) => candidate.includes(token))) return hint.pillar;
  }
  return "OPTIMIZE";
}

