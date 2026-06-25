import test from "node:test";
import assert from "node:assert/strict";

import {
  evaluateOperationalSlo,
  classifySloBurnRate,
  buildSloBreachAlerts,
} from "../../src/observe/api/operational-slo-contract.mjs";

const measurements = [
  { metric: "api-latency-p95", target: 800, actual: 780, windowHours: 24 },
  { metric: "error-rate", target: 0.01, actual: 0.03, windowHours: 24 },
];

test("evaluates operational SLOs", () => {
  const evaluations = evaluateOperationalSlo(measurements);
  assert.equal(evaluations.length, 2);
  assert.equal(evaluations[0].status, "met");
  assert.equal(evaluations[1].status, "breached");
});

test("classifies SLO burn rates", () => {
  assert.equal(classifySloBurnRate(0.005), "low");
  assert.equal(classifySloBurnRate(0.03), "high");
});

test("builds SLO breach alerts", () => {
  const alerts = buildSloBreachAlerts(evaluateOperationalSlo(measurements));
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].metric, "error-rate");
});

