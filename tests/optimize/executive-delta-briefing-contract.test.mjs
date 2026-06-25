import test from "node:test";
import assert from "node:assert/strict";

import {
  buildExecutiveDeltaBriefing,
  summarizeExecutiveDelta,
  buildExecutiveDeltaEvidence,
} from "../../src/optimize/reporting/executive-delta-briefing-contract.mjs";

const previous = {
  topline: { maturityOverall: 68, totalCost: 1000, totalValuePoints: 1800, roiIndex: 1.8 },
  keyRecommendations: [{ id: "a1" }],
};
const current = {
  topline: { maturityOverall: 72, totalCost: 1100, totalValuePoints: 2200, roiIndex: 2.0 },
  keyRecommendations: [{ id: "a1" }, { id: "a2" }],
};

test("builds executive delta briefing", () => {
  const briefing = buildExecutiveDeltaBriefing(current, previous);
  assert.equal(briefing.toplineDelta.maturityOverall, 4);
  assert.equal(briefing.recommendationDelta.currentCount, 2);
});

test("summarizes executive delta", () => {
  const summary = summarizeExecutiveDelta(buildExecutiveDeltaBriefing(current, previous));
  assert.equal(summary.status, "stable");
  assert.equal(summary.improvedMetrics >= 1, true);
});

test("builds executive delta evidence", () => {
  const evidence = buildExecutiveDeltaEvidence(buildExecutiveDeltaBriefing(current, previous), "2026-01-01T00:00:00.000Z");
  assert.equal(evidence.artifactType, "executive-delta-briefing");
});

