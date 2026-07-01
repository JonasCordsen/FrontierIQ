import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCostValueSummary,
  detectBudgetAnomalies,
  validateCostValueRecord,
} from "../../src/optimize/model/cost-value-model.mjs";
import { validateShowbackDimensions } from "../../src/optimize/model/showback-dimensions.mjs";
import { SOLUTION_IDS } from "../../src/observe/foundation/solution-taxonomy.mjs";

const records = [
  {
    timestamp: "2026-06-24T09:00:00Z",
    tenantId: "tenant-a",
    solutionId: SOLUTION_IDS.M365_COPILOT,
    workload: "chat",
    businessUnit: "finance",
    environment: "prod",
    resourceId: "res-1",
    usageQuantity: 100,
    unitCost: 0.2,
    valuePoints: 50,
  },
  {
    timestamp: "2026-06-24T10:00:00Z",
    tenantId: "tenant-a",
    solutionId: SOLUTION_IDS.FABRIC,
    workload: "capacity",
    businessUnit: "ops",
    environment: "prod",
    resourceId: "res-2",
    usageQuantity: 80,
    unitCost: 0.25,
    valuePoints: 60,
  },
];

test("validates showback dimensions", () => {
  const result = validateShowbackDimensions(records[0]);
  assert.equal(result.ok, true);
});

test("builds aggregate cost/value summary", () => {
  const summary = buildCostValueSummary(records);
  assert.equal(summary.totals.records, 2);
  assert.equal(summary.totals.totalCost, 40);
  assert.equal(summary.totals.totalValuePoints, 110);
  assert.equal(summary.bySolution[SOLUTION_IDS.M365_COPILOT].totalCost, 20);
});

test("detects budget anomalies by custom threshold", () => {
  const anomalies = detectBudgetAnomalies(records, (record) => record.usageQuantity * record.unitCost > 19);
  assert.equal(anomalies.length, 2);
});

test("record validation fails for invalid values", () => {
  const invalid = { ...records[0], unitCost: -1, timestamp: "not-date" };
  const result = validateCostValueRecord(invalid);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.errors.join(" "), /unitCost|timestamp/);
  }
});

