import test from "node:test";
import assert from "node:assert/strict";

import {
  MVP_PHASE1_SOLUTIONS,
  SOLUTION_CATALOG,
  SOLUTION_IDS,
  getSolutionDefinition,
  isKnownSolution,
} from "../../src/observe/foundation/solution-taxonomy.mjs";

test("solution catalog contains the focused MVP phase 1 solutions", () => {
  for (const solutionId of MVP_PHASE1_SOLUTIONS) {
    assert.equal(isKnownSolution(solutionId), true);
    assert.equal(getSolutionDefinition(solutionId)?.mvpPhase1Implemented, true);
  }
});

test("solution ids are unique in catalog", () => {
  const ids = SOLUTION_CATALOG.map((entry) => entry.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("known lookup succeeds and unknown lookup fails", () => {
  assert.equal(isKnownSolution(SOLUTION_IDS.M365_COPILOT), true);
  assert.equal(isKnownSolution("unknown-solution"), false);
  assert.equal(getSolutionDefinition("unknown-solution"), undefined);
});

