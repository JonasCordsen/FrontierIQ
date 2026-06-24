import test from "node:test";
import assert from "node:assert/strict";

import {
  buildExecutiveReport,
  validateExecutiveReport,
} from "../../src/optimize/reporting/executive-report.mjs";

test("builds executive report with topline and top recommendations", () => {
  const report = buildExecutiveReport({
    scorecardSummary: { tenants: 3, overall: 72.5 },
    costSummary: {
      totals: { totalCost: 1200, totalValuePoints: 2100, roiIndex: 1.75, records: 20 },
    },
    scenarioPortfolio: {
      tenantId: "tenant-a",
      businessUnit: "it",
      totalUseCases: 12,
      byStatus: { candidate: 3, planned: 4, in_progress: 2, adopted: 3, retired: 0 },
      withKpi: 8,
      kpiCoverage: 0.6667,
      byScenarioLevel: { start: 4, buy: 5, extend: 2, build: 1 },
    },
    complianceSummary: {
      solutionId: "m365-copilot",
      totalCertifications: 10,
      mappedCertifications: 10,
      controlCoveragePercent: 100,
      requiredControls: 7,
      missingControls: [],
      keyGaps: [],
    },
    controlSystemSummary: {
      solutionId: "m365-copilot",
      totalLesson2Controls: 7,
      validManifests: 2,
      totalManifests: 2,
      roleAssignmentsValid: true,
      onboardingReady: true,
      keyVaultRotationReady: true,
      failedChecks: [],
    },
    privacySummary: {
      solutionId: "m365-copilot",
      totalLesson3Controls: 7,
      residencyAligned: true,
      labelCoveragePercent: 100,
      piiFindingCount: 0,
      retentionWorkflowCovered: true,
      failedChecks: [],
    },
    topActions: [
      { id: "a1", title: "Tighten privileged scopes", pillar: "secure", priorityScore: 0.89 },
      { id: "a2", title: "Enable approval gates", pillar: "govern", priorityScore: 0.82 },
      { id: "a3", title: "Tune capacity allocations", pillar: "optimize", priorityScore: 0.76 },
    ],
  });

  assert.equal(report.topline.tenants, 3);
  assert.equal(report.scenarioPortfolio.totalUseCases, 12);
  assert.equal(report.complianceSummary.totalCertifications, 10);
  assert.equal(report.controlSystemSummary.totalLesson2Controls, 7);
  assert.equal(report.privacySummary.totalLesson3Controls, 7);
  assert.equal(report.keyRecommendations.length, 3);
  assert.equal(report.keyRecommendations[0].rank, 1);
});

test("validates generated executive report", () => {
  const report = buildExecutiveReport({
    scorecardSummary: { tenants: 1, overall: 65 },
    costSummary: {
      totals: { totalCost: 100, totalValuePoints: 200, roiIndex: 2, records: 3 },
    },
    topActions: [],
  });
  const result = validateExecutiveReport(report);
  assert.equal(result.ok, true);
});

test("detects invalid report shape", () => {
  const result = validateExecutiveReport({
    version: "",
    generatedAt: "invalid-date",
    topline: null,
    keyRecommendations: "not-array",
  });
  assert.equal(result.ok, false);
});
