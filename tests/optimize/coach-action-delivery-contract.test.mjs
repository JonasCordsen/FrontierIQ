import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCoachActionDeliveryPackage,
  buildCoachActionDeliveryRoutes,
  summarizeCoachActionDelivery,
} from "../../src/optimize/delivery/coach-action-delivery-contract.mjs";

const pillarActions = {
  OBSERVE: [
    {
      id: "a1",
      pillar: "OBSERVE",
      title: "Fix stale ingestion",
      description: "reduce stale data",
      severity: "high",
      impact: 80,
      confidence: 0.9,
      effort: "medium",
      controlId: "audit.traceability",
    },
  ],
};

test("builds ready delivery package", () => {
  const result = buildCoachActionDeliveryPackage({
    pillarActions,
    channel: "teams",
    maxActions: 5,
    generatedAt: "2026-01-01T00:00:00.000Z",
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.package.readinessStatus, "ready");
  assert.equal(result.package.routes.primary, "teams_adaptive_card");
});

test("returns blocked package when no actions are available", () => {
  const result = buildCoachActionDeliveryPackage({
    pillarActions: {},
    channel: "api",
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.package.readinessStatus, "blocked");
});

test("builds per-channel routes", () => {
  assert.equal(buildCoachActionDeliveryRoutes("email").primary, "digest_email");
  assert.equal(buildCoachActionDeliveryRoutes("api").primary, "api_response");
});

test("summarizes delivery package", () => {
  const result = buildCoachActionDeliveryPackage({ pillarActions, channel: "email" });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const summary = summarizeCoachActionDelivery(result.package);
  assert.equal(summary.deliveredActions, 1);
  assert.equal(summary.status, "ready");
});

