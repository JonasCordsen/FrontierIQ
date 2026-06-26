import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCurrentStateFixtures,
  buildCurrentStateSnapshot,
  formatCurrentStateSnapshot,
  executeCurrentStateViewCommand,
} from "../../src/observe/api/current-state-view-contract.mjs";

test("builds deterministic current-state fixtures", () => {
  const fixtures = buildCurrentStateFixtures("2026-01-01T00:00:00.000Z");
  assert.equal(fixtures.accessAnomalies.length, 1);
  assert.equal(fixtures.tenantMetrics.length, 3);
});

test("builds current-state snapshot across pillars", () => {
  const snapshot = buildCurrentStateSnapshot(buildCurrentStateFixtures("2026-01-01T00:00:00.000Z"));
  assert.equal(snapshot.secure.accessAnomalies.total, 1);
  assert.equal(snapshot.optimize.benchmark.totalTenants, 3);
  assert.equal(snapshot.govern.waiverAudit.totalEvents, 2);
});

test("formats current-state snapshot as text", () => {
  const snapshot = buildCurrentStateSnapshot(buildCurrentStateFixtures("2026-01-01T00:00:00.000Z"));
  const output = formatCurrentStateSnapshot(snapshot);
  assert.equal(output.includes("generatedAt"), true);
});

test("executes current-state command in json mode", () => {
  const result = executeCurrentStateViewCommand(["--json"]);
  assert.equal(result.exitCode, 0);
  assert.equal(result.stdout.startsWith("{"), true);
});

