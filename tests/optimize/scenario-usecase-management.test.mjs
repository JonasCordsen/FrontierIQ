import test from "node:test";
import assert from "node:assert/strict";

import {
  adviseScenarioUseCases,
  buildScenarioPortfolioSummary,
  initializeUseCaseTracker,
  mergeUseCaseTracker,
  summarizeUseCaseTracker,
  updateUseCaseTracker,
} from "../../src/optimize/planning/scenario-usecase-management.mjs";

function createUseCases() {
  return [
    {
      useCaseId: "it-reduce-incident-triage-time",
      name: "Reduce incident triage time",
      functionArea: "Information Technology (IT)",
      scenarioLevel: "Build",
      solutionIds: ["security-copilot"],
      hasPromptGallery: true,
      hasDemoVideo: true,
      isFrontlineWorker: false,
    },
    {
      useCaseId: "finance-accelerate-month-end-close",
      name: "Accelerate month-end close",
      functionArea: "Finance",
      scenarioLevel: "Buy",
      solutionIds: ["m365-copilot"],
      hasPromptGallery: false,
      hasDemoVideo: true,
      isFrontlineWorker: false,
    },
  ];
}

test("tracker initialization and summary reflect candidate baseline", () => {
  const tracker = initializeUseCaseTracker(createUseCases(), {
    tenantId: "tenant-a",
    businessUnit: "finance",
  });
  const summary = summarizeUseCaseTracker(tracker);
  assert.equal(summary.totalUseCases, 2);
  assert.equal(summary.byStatus.candidate, 2);
  assert.equal(summary.kpiCoverage, 0);
});

test("tracker updates persist status and KPI fields", () => {
  const tracker = initializeUseCaseTracker(createUseCases(), {
    tenantId: "tenant-a",
    businessUnit: "it",
  });
  updateUseCaseTracker(tracker, [
    {
      useCaseId: "it-reduce-incident-triage-time",
      status: "in_progress",
      kpiName: "Average incident triage time",
      kpiBaseline: 42,
      kpiTarget: 20,
      selectedAt: "2026-06-24",
    },
  ]);
  const summary = summarizeUseCaseTracker(tracker);
  assert.equal(summary.byStatus.in_progress, 1);
  assert.equal(summary.withKpi, 1);
});

test("advisor prioritizes scenarios from tracker", () => {
  const tracker = initializeUseCaseTracker(createUseCases(), {
    tenantId: "tenant-a",
    businessUnit: "it",
  });
  const recommendations = adviseScenarioUseCases(tracker, { top: 2 });
  assert.equal(recommendations.length, 2);
  assert.equal(recommendations[0].id, "it-reduce-incident-triage-time");
  assert.ok(recommendations[0].priorityScore >= recommendations[1].priorityScore);
});

test("mergeUseCaseTracker preserves lifecycle and KPI state", () => {
  const existing = initializeUseCaseTracker(createUseCases(), {
    tenantId: "tenant-a",
    businessUnit: "it",
  });
  updateUseCaseTracker(existing, [
    {
      useCaseId: "finance-accelerate-month-end-close",
      status: "adopted",
      kpiName: "Close cycle time",
      kpiBaseline: 14,
      kpiTarget: 8,
      adoptedAt: "2026-06-24",
    },
  ]);

  const merged = mergeUseCaseTracker(existing, createUseCases(), {
    tenantId: "tenant-a",
    businessUnit: "it",
  });
  const adopted = merged.items.find((item) => item.useCaseId === "finance-accelerate-month-end-close");
  assert.equal(adopted?.status, "adopted");
  assert.equal(adopted?.kpiName, "Close cycle time");
});

test("portfolio summary includes scenario level distribution", () => {
  const tracker = initializeUseCaseTracker(createUseCases(), {
    tenantId: "tenant-a",
    businessUnit: "it",
  });
  const summary = buildScenarioPortfolioSummary(tracker);
  assert.equal(summary.totalUseCases, 2);
  assert.equal(summary.byScenarioLevel.build, 1);
  assert.equal(summary.byScenarioLevel.buy, 1);
});
