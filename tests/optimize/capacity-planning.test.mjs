import test from "node:test";
import assert from "node:assert/strict";

import {
  detectCapacityBudgetPressure,
  forecastCapacity,
} from "../../src/optimize/planning/capacity-planning.mjs";

test("capacity forecast returns timeline per workload", () => {
  const forecast = forecastCapacity([
    {
      workload: "work-iq",
      monthlyRequests: 10000,
      unitCost: 0.0015,
      baselineCapacityUnits: 10,
      growthRate: 0.1,
    },
  ], 3);
  assert.equal(forecast.length, 1);
  assert.equal(forecast[0].timeline.length, 3);
});

test("budget pressure detection surfaces threshold breaches", () => {
  const forecast = forecastCapacity([
    {
      workload: "foundry-iq",
      monthlyRequests: 50000,
      unitCost: 0.01,
      baselineCapacityUnits: 15,
      growthRate: 0.2,
    },
  ], 2);
  const alerts = detectCapacityBudgetPressure(forecast, 400);
  assert.ok(alerts.length >= 1);
});

