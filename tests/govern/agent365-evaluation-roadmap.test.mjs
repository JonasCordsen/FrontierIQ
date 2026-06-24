import test from "node:test";
import assert from "node:assert/strict";

import {
  buildAgent365CapabilityCatalog,
  buildAgent365DecisionGates,
  buildAgent365EvaluationCriteria,
  buildAgent365IntegrationRoadmap,
  summarizeAgent365EvaluationReadiness,
} from "../../src/govern/operations/agent365-evaluation-roadmap.mjs";

test("builds capability catalog with required Agent 365 integration capabilities", () => {
  const catalog = buildAgent365CapabilityCatalog();

  const capabilityIds = catalog.capabilities.map((capability) => capability.capabilityId);
  assert.equal(capabilityIds.includes("policy-evaluation-hooks"), true);
  assert.equal(capabilityIds.includes("identity-context-integration"), true);
  assert.equal(capabilityIds.includes("telemetry-export"), true);
  assert.equal(capabilityIds.includes("admin-governance-actions"), true);
});

test("builds evaluation criteria with deterministic weighted score model", () => {
  const criteria = buildAgent365EvaluationCriteria();
  const weightTotal = criteria.criteria.reduce((sum, criterion) => sum + criterion.weight, 0);

  assert.equal(weightTotal, 100);
  assert.equal(criteria.criteria.length, 4);
});

test("builds decision gates across discovery to production readiness", () => {
  const gates = buildAgent365DecisionGates();

  const gatePhases = gates.gates.map((gate) => gate.phaseId);
  assert.equal(gatePhases.includes("discovery"), true);
  assert.equal(gatePhases.includes("proof-of-value"), true);
  assert.equal(gatePhases.includes("pilot"), true);
  assert.equal(gatePhases.includes("production-readiness"), true);
});

test("builds integration roadmap with phase-aligned milestones", () => {
  const roadmap = buildAgent365IntegrationRoadmap();

  assert.equal(roadmap.milestones.length >= 4, true);
  assert.equal(Boolean(roadmap.targetDecisionDate), true);
});

test("evaluation readiness blocks when criteria weights do not add to 100", () => {
  const readiness = summarizeAgent365EvaluationReadiness({
    capabilityCatalog: buildAgent365CapabilityCatalog(),
    evaluationCriteria: buildAgent365EvaluationCriteria({
      criteria: [{ criterionId: "security-controls", area: "security", weight: 80, passThreshold: 80 }],
    }),
    decisionGates: buildAgent365DecisionGates(),
    roadmap: buildAgent365IntegrationRoadmap(),
  });

  assert.equal(readiness.overallStatus, "blocked");
  assert.ok(readiness.failedChecks.includes("invalid-weight-total:80"));
});

test("evaluation readiness is ready with complete capability criteria gates and roadmap", () => {
  const readiness = summarizeAgent365EvaluationReadiness({
    capabilityCatalog: buildAgent365CapabilityCatalog(),
    evaluationCriteria: buildAgent365EvaluationCriteria(),
    decisionGates: buildAgent365DecisionGates(),
    roadmap: buildAgent365IntegrationRoadmap(),
  });

  assert.equal(readiness.overallStatus, "ready");
  assert.equal(readiness.failedChecks.length, 0);
});
