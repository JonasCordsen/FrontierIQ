import test from "node:test";
import assert from "node:assert/strict";

import {
  simulateRecommendationImpact,
  simulatePortfolioImpact,
  summarizeImpactSimulation,
} from "../../src/optimize/model/recommendation-impact-simulation-contract.mjs";

const baseline = {
  adoptionRate: 60,
  overshareRisk: 24,
  valueScore: 40,
};

const recommendation = {
  id: "rec-1",
  title: "Enable stricter guardrails",
  confidence: 0.75,
  deltas: {
    adoptionRate: 8,
    overshareRisk: -6,
    valueScore: 10,
  },
};

test("simulates recommendation impact with confidence adjustment", () => {
  const simulation = simulateRecommendationImpact(recommendation, baseline);
  assert.equal(simulation.recommendationId, "rec-1");
  assert.equal(simulation.after.adoptionRate > baseline.adoptionRate, true);
});

test("simulates portfolio impact", () => {
  const portfolio = simulatePortfolioImpact([{ recommendation, baseline }]);
  assert.equal(portfolio.length, 1);
});

test("summarizes simulation portfolio", () => {
  const portfolio = simulatePortfolioImpact([{ recommendation, baseline }]);
  const summary = summarizeImpactSimulation(portfolio);
  assert.equal(summary.totalRecommendations, 1);
  assert.equal(summary.status, "ready");
});

