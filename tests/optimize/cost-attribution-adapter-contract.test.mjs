import test from "node:test";
import assert from "node:assert/strict";

import {
  mapUsageToCostAttribution,
  summarizeCostAttributionByPillar,
  buildCostAttributionEvidence,
} from "../../src/optimize/model/cost-attribution-adapter-contract.mjs";

const records = [
  {
    timestamp: "2026-01-01T00:00:00.000Z",
    tenantId: "tenant-a",
    solutionId: "m365-copilot",
    workload: "observe-ingestion",
    businessUnit: "it",
    environment: "prod",
    resourceId: "res-1",
    usageQuantity: 10,
    unitCost: 2,
    valuePoints: 30,
  },
  {
    timestamp: "2026-01-01T00:00:00.000Z",
    tenantId: "tenant-a",
    solutionId: "m365-copilot",
    workload: "govern-policy",
    businessUnit: "it",
    environment: "prod",
    resourceId: "res-2",
    usageQuantity: 5,
    unitCost: 4,
    valuePoints: 40,
  },
];

test("maps usage records to attributed rows", () => {
  const result = mapUsageToCostAttribution(records);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.rows.length, 2);
  assert.equal(result.rows[0].totalCost, 20);
  assert.equal(result.rows[0].pillar, "OBSERVE");
});

test("fails mapping when record has non-finite numeric values", () => {
  const result = mapUsageToCostAttribution([{ ...records[0], usageQuantity: Number.NaN }]);
  assert.equal(result.ok, false);
});

test("summarizes attribution by pillar", () => {
  const result = mapUsageToCostAttribution(records);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const summary = summarizeCostAttributionByPillar(result.rows);
  assert.equal(summary.records, 2);
  assert.equal(summary.byPillar.OBSERVE.totalCost, 20);
  assert.equal(summary.byPillar.GOVERN.totalCost, 20);
});

test("builds cost attribution evidence envelope", () => {
  const result = mapUsageToCostAttribution(records);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const evidence = buildCostAttributionEvidence(result.rows, "2026-01-01T00:00:00.000Z");
  assert.equal(evidence.artifactType, "cost-attribution");
  assert.equal(evidence.summary.totalCost, 40);
});

