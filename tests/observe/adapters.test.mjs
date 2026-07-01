import test from "node:test";
import assert from "node:assert/strict";

import { getAdapterBySolution, MVP_ADAPTERS } from "../../src/observe/adapters/index.mjs";
import { SOLUTION_IDS } from "../../src/observe/foundation/solution-taxonomy.mjs";

const payload = {
  tenantId: "tenant-1",
  timestamp: "2026-06-24T08:00:00Z",
  signals: [
    {
      signalType: "usage-anomaly",
      severity: "high",
      confidence: 0.83,
      freshnessMinutes: 3,
      workload: "agent-runtime",
      resourceId: "agent-abc",
      dimensions: { requestsPerHour: 1200 },
      evidence: { traceId: "trace-1" },
    },
  ],
};

test("MVP adapters exist for four focused solutions", () => {
  assert.equal(MVP_ADAPTERS.length, 4);
  assert.ok(getAdapterBySolution(SOLUTION_IDS.M365_COPILOT));
  assert.ok(getAdapterBySolution(SOLUTION_IDS.COPILOT_STUDIO));
  assert.ok(getAdapterBySolution(SOLUTION_IDS.AZURE_AI_FOUNDRY));
  assert.ok(getAdapterBySolution(SOLUTION_IDS.FABRIC));
});

test("adapter map returns success with normalized signal", () => {
  const adapter = getAdapterBySolution(SOLUTION_IDS.M365_COPILOT);
  assert.ok(adapter);
  const result = adapter.map(payload);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.signals[0].solutionId, SOLUTION_IDS.M365_COPILOT);
    assert.equal(result.signals[0].tenantId, "tenant-1");
  }
});

test("adapter map returns invalid payload for bad payload shape", () => {
  const adapter = getAdapterBySolution(SOLUTION_IDS.FABRIC);
  assert.ok(adapter);
  const result = adapter.map({ tenantId: "missing-signals-array" });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.code, "invalid_payload");
  }
});

