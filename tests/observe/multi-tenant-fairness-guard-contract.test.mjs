import test from "node:test";
import assert from "node:assert/strict";

import {
  evaluateMultiTenantFairness,
  listFairnessBlockers,
  buildMultiTenantFairnessEvidence,
} from "../../src/observe/graph/multi-tenant-fairness-guard-contract.mjs";

const queue = [
  { tenantId: "t1", priority: "urgent", estimatedCost: 3 },
  { tenantId: "t2", priority: "standard", estimatedCost: 2 },
  { tenantId: "t3", priority: "low", estimatedCost: 1 },
];

test("evaluates multi-tenant fairness", () => {
  const fairness = evaluateMultiTenantFairness(queue);
  assert.equal(fairness.totalTenants, 3);
  assert.equal(Number.isFinite(fairness.fairnessIndex), true);
});

test("lists fairness blockers for empty queue", () => {
  const blockers = listFairnessBlockers(evaluateMultiTenantFairness([]));
  assert.ok(blockers.includes("no-tenants-in-queue"));
});

test("builds fairness evidence envelope", () => {
  const evidence = buildMultiTenantFairnessEvidence(evaluateMultiTenantFairness(queue), "2026-01-01T00:00:00.000Z");
  assert.equal(evidence.artifactType, "multi-tenant-fairness");
});

