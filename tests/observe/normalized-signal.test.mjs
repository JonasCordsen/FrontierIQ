import test from "node:test";
import assert from "node:assert/strict";

import {
  createNormalizedSignal,
  validateNormalizedSignal,
} from "../../src/observe/foundation/normalized-signal.mjs";
import { SOLUTION_IDS } from "../../src/observe/foundation/solution-taxonomy.mjs";

const validSignal = {
  tenantId: "tenant-1",
  solutionId: SOLUTION_IDS.M365_COPILOT,
  workload: "copilot-chat",
  resourceId: "resource-a",
  source: "m365-graph",
  timestamp: "2026-06-24T08:00:00Z",
  signalType: "usage-spike",
  severity: "medium",
  confidence: 0.9,
  freshnessMinutes: 5,
  dimensions: { userCount: 42 },
  evidence: { endpoint: "reports/getMicrosoft365CopilotUsageUserDetail" },
};

test("validateNormalizedSignal accepts valid signal", () => {
  const result = validateNormalizedSignal(validSignal);
  assert.equal(result.ok, true);
});

test("validateNormalizedSignal rejects missing tenant and invalid confidence", () => {
  const invalid = { ...validSignal, tenantId: "", confidence: 1.2 };
  const result = validateNormalizedSignal(invalid);
  assert.equal(result.ok, false);
  assert.match(result.errors.join(" "), /tenantId/);
  assert.match(result.errors.join(" "), /confidence/);
});

test("createNormalizedSignal throws on invalid payload", () => {
  assert.throws(
    () => createNormalizedSignal({ ...validSignal, solutionId: "missing-id" }),
    /Invalid normalized signal/
  );
});

