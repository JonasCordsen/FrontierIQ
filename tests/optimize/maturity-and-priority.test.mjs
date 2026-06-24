import test from "node:test";
import assert from "node:assert/strict";

import {
  buildMaturityScorecard,
  summarizeMaturity,
  validateMaturityInput,
} from "../../src/optimize/model/maturity-scorecard.mjs";
import {
  prioritizeNextBestActions,
  validateCandidateAction,
} from "../../src/optimize/model/next-best-action-engine.mjs";
import { SOLUTION_IDS } from "../../src/observe/foundation/solution-taxonomy.mjs";

test("builds maturity scorecard and summary", () => {
  const scorecard = buildMaturityScorecard([
    {
      tenantId: "tenant-a",
      solutionId: SOLUTION_IDS.M365_COPILOT,
      pillarScores: { observe: 80, govern: 70, secure: 75, optimize: 65 },
    },
    {
      tenantId: "tenant-a",
      solutionId: SOLUTION_IDS.FABRIC,
      pillarScores: { observe: 60, govern: 65, secure: 55, optimize: 70 },
    },
  ]);

  assert.equal(scorecard.byTenant["tenant-a"].overall, 67.5);
  const summary = summarizeMaturity(scorecard);
  assert.equal(summary.tenants, 1);
  assert.equal(summary.overall, 67.5);
});

test("maturity input validation catches bad scores", () => {
  const result = validateMaturityInput({
    tenantId: "tenant-x",
    solutionId: "unknown",
    pillarScores: { observe: 101, govern: 30, secure: 40, optimize: 50 },
  });
  assert.equal(result.ok, false);
});

test("prioritizes next-best-actions by score", () => {
  const prioritized = prioritizeNextBestActions(
    [
      {
        id: "a1",
        title: "Enable residency guardrails",
        pillar: "govern",
        impact: 9,
        effort: 4,
        riskReduction: 9,
        confidence: 0.9,
      },
      {
        id: "a2",
        title: "Tune dashboard color palette",
        pillar: "observe",
        impact: 2,
        effort: 2,
        riskReduction: 1,
        confidence: 0.7,
      },
    ],
    { top: 2 }
  );

  assert.equal(prioritized[0].id, "a1");
  assert.ok(prioritized[0].priorityScore > prioritized[1].priorityScore);
});

test("candidate validation catches invalid confidence", () => {
  const result = validateCandidateAction({
    id: "a3",
    title: "Broken action",
    pillar: "secure",
    impact: 5,
    effort: 5,
    riskReduction: 5,
    confidence: 2,
  });
  assert.equal(result.ok, false);
});

