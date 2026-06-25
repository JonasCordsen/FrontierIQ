import test from "node:test";
import assert from "node:assert/strict";

import {
  buildRecommendationRationaleTrace,
  buildRecommendationExplainabilityBundle,
  summarizeRecommendationExplainability,
} from "../../src/optimize/delivery/recommendation-explainability-contract.mjs";

const action = {
  id: "act-1",
  pillar: "GOVERN",
  title: "Enable approval gate",
  severity: "high",
  impact: 80,
  confidence: 0.9,
  effort: "medium",
  controlId: "governance.approval-gates",
};

test("builds recommendation rationale trace", () => {
  const trace = buildRecommendationRationaleTrace(action);
  assert.equal(trace.actionId, "act-1");
  assert.equal(trace.priorityScore > 0, true);
});

test("builds explainability bundle", () => {
  const bundle = buildRecommendationExplainabilityBundle([action]);
  assert.equal(bundle.traces.length, 1);
  assert.equal(bundle.summary.status, "ready");
});

test("summarizes explainability traces", () => {
  const summary = summarizeRecommendationExplainability([buildRecommendationRationaleTrace(action)]);
  assert.equal(summary.total, 1);
  assert.equal(summary.explainable, 1);
});

