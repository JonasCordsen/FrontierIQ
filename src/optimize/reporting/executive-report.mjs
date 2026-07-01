/**
 * Builds a compact executive report from optimization outputs.
 *
 * @param {{
 *   scorecardSummary: { tenants: number; overall: number };
 *   costSummary: {
 *     totals: { totalCost: number; totalValuePoints: number; roiIndex: number; records: number };
 *   };
 *   topActions: Array<{
 *     id: string;
 *     title: string;
 *     pillar: string;
 *     priorityScore: number;
 *   }>;
 *   scenarioPortfolio?: {
 *     tenantId: string;
 *     businessUnit: string;
 *     totalUseCases: number;
 *     byStatus: Record<string, number>;
 *     withKpi: number;
 *     kpiCoverage: number;
 *     byScenarioLevel: Record<string, number>;
 *   };
 *   complianceSummary?: {
 *     solutionId: string;
 *     totalCertifications: number;
 *     mappedCertifications: number;
 *     controlCoveragePercent: number;
 *     requiredControls: number;
 *     missingControls: string[];
 *     keyGaps: string[];
 *   };
 *   controlSystemSummary?: {
 *     solutionId: string;
 *     totalLesson2Controls: number;
 *     validManifests: number;
 *     totalManifests: number;
 *     roleAssignmentsValid: boolean;
 *     onboardingReady: boolean;
 *     keyVaultRotationReady: boolean;
 *     failedChecks: string[];
 *   };
 *   privacySummary?: {
 *     solutionId: string;
 *     totalLesson3Controls: number;
 *     residencyAligned: boolean;
 *     labelCoveragePercent: number;
 *     piiFindingCount: number;
 *     retentionWorkflowCovered: boolean;
 *     failedChecks: string[];
 *   };
 *   generatedAt?: string;
 * }} input
 */
export function buildExecutiveReport(input) {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const topline = {
    tenants: input.scorecardSummary.tenants,
    maturityOverall: input.scorecardSummary.overall,
    totalCost: input.costSummary.totals.totalCost,
    totalValuePoints: input.costSummary.totals.totalValuePoints,
    roiIndex: input.costSummary.totals.roiIndex,
  };

  const keyRecommendations = input.topActions.slice(0, 5).map((action, index) => ({
    rank: index + 1,
    id: action.id,
    title: action.title,
    pillar: action.pillar,
    priorityScore: action.priorityScore,
  }));

  return {
    version: "2026.06.1",
    generatedAt,
    topline,
    scenarioPortfolio: input.scenarioPortfolio ?? null,
    complianceSummary: input.complianceSummary ?? null,
    controlSystemSummary: input.controlSystemSummary ?? null,
    privacySummary: input.privacySummary ?? null,
    keyRecommendations,
  };
}

/**
 * @param {ReturnType<typeof buildExecutiveReport>} report
 */
export function validateExecutiveReport(report) {
  /** @type {string[]} */
  const errors = [];

  if (!report || typeof report !== "object") {
    return { ok: false, errors: ["report must be an object"] };
  }
  if (typeof report.version !== "string" || !report.version) {
    errors.push("version must be set");
  }
  if (typeof report.generatedAt !== "string" || Number.isNaN(Date.parse(report.generatedAt))) {
    errors.push("generatedAt must be ISO-8601");
  }
  if (!report.topline || typeof report.topline !== "object") {
    errors.push("topline must be present");
  }
  if (!Array.isArray(report.keyRecommendations)) {
    errors.push("keyRecommendations must be an array");
  }
  if (report.scenarioPortfolio !== null && report.scenarioPortfolio !== undefined) {
    if (typeof report.scenarioPortfolio !== "object") {
      errors.push("scenarioPortfolio must be an object when provided");
    } else {
      if (typeof report.scenarioPortfolio.totalUseCases !== "number") {
        errors.push("scenarioPortfolio.totalUseCases must be a number");
      }
      if (typeof report.scenarioPortfolio.kpiCoverage !== "number") {
        errors.push("scenarioPortfolio.kpiCoverage must be a number");
      }
    }
  }
  if (report.complianceSummary !== null && report.complianceSummary !== undefined) {
    if (typeof report.complianceSummary !== "object") {
      errors.push("complianceSummary must be an object when provided");
    } else {
      if (typeof report.complianceSummary.totalCertifications !== "number") {
        errors.push("complianceSummary.totalCertifications must be a number");
      }
      if (typeof report.complianceSummary.controlCoveragePercent !== "number") {
        errors.push("complianceSummary.controlCoveragePercent must be a number");
      }
      if (!Array.isArray(report.complianceSummary.missingControls)) {
        errors.push("complianceSummary.missingControls must be an array");
      }
    }
  }
  if (report.controlSystemSummary !== null && report.controlSystemSummary !== undefined) {
    if (typeof report.controlSystemSummary !== "object") {
      errors.push("controlSystemSummary must be an object when provided");
    } else {
      if (typeof report.controlSystemSummary.totalLesson2Controls !== "number") {
        errors.push("controlSystemSummary.totalLesson2Controls must be a number");
      }
      if (typeof report.controlSystemSummary.roleAssignmentsValid !== "boolean") {
        errors.push("controlSystemSummary.roleAssignmentsValid must be a boolean");
      }
      if (!Array.isArray(report.controlSystemSummary.failedChecks)) {
        errors.push("controlSystemSummary.failedChecks must be an array");
      }
    }
  }
  if (report.privacySummary !== null && report.privacySummary !== undefined) {
    if (typeof report.privacySummary !== "object") {
      errors.push("privacySummary must be an object when provided");
    } else {
      if (typeof report.privacySummary.totalLesson3Controls !== "number") {
        errors.push("privacySummary.totalLesson3Controls must be a number");
      }
      if (typeof report.privacySummary.labelCoveragePercent !== "number") {
        errors.push("privacySummary.labelCoveragePercent must be a number");
      }
      if (!Array.isArray(report.privacySummary.failedChecks)) {
        errors.push("privacySummary.failedChecks must be an array");
      }
    }
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true };
}
