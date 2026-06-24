import { listRequiredReviewers } from "./approval-board.mjs";
import { listRequiredControls } from "../policy/baseline-library.mjs";

const REQUIRED_ASSET_TYPES = Object.freeze(["agent", "skill"]);
const REQUIRED_RISK_BANDS = Object.freeze(["low", "medium", "high", "critical"]);

/**
 * @param {{
 *   bands?: Array<{
 *     riskBand: "low"|"medium"|"high"|"critical";
 *     scoreMin: number;
 *     scoreMax: number;
 *     reviewGate: "auto-approve"|"standard-review"|"governance-board"|"executive-board";
 *     attestationCadenceDays: number;
 *   }>;
 * }} input
 */
export function buildRiskTaxonomy(input = {}) {
  return {
    version: "2026.06.1",
    bands: input.bands ?? [
      {
        riskBand: "low",
        scoreMin: 0,
        scoreMax: 24,
        reviewGate: "auto-approve",
        attestationCadenceDays: 180,
      },
      {
        riskBand: "medium",
        scoreMin: 25,
        scoreMax: 49,
        reviewGate: "standard-review",
        attestationCadenceDays: 90,
      },
      {
        riskBand: "high",
        scoreMin: 50,
        scoreMax: 74,
        reviewGate: "governance-board",
        attestationCadenceDays: 60,
      },
      {
        riskBand: "critical",
        scoreMin: 75,
        scoreMax: 100,
        reviewGate: "executive-board",
        attestationCadenceDays: 30,
      },
    ],
  };
}

/**
 * @param {{
 *   mappings?: Array<{
 *     assetType: "agent"|"skill";
 *     riskBand: "low"|"medium"|"high"|"critical";
 *     reviewGate: "auto-approve"|"standard-review"|"governance-board"|"executive-board";
 *     requiredReviewers: string[];
 *     requiredControlIds: string[];
 *   }>;
 * }} input
 */
export function buildGovernanceMatrix(input = {}) {
  const requiredReviewers = listRequiredReviewers();
  const requiredControls = listRequiredControls();

  return {
    version: "2026.06.1",
    mappings: input.mappings ?? [
      {
        assetType: "agent",
        riskBand: "low",
        reviewGate: "auto-approve",
        requiredReviewers: ["coeLead"],
        requiredControlIds: [requiredControls[0], requiredControls[1], requiredControls[4]],
      },
      {
        assetType: "agent",
        riskBand: "medium",
        reviewGate: "standard-review",
        requiredReviewers: ["coeLead", "securityRepresentative"],
        requiredControlIds: [...requiredControls],
      },
      {
        assetType: "agent",
        riskBand: "high",
        reviewGate: "governance-board",
        requiredReviewers: [...requiredReviewers],
        requiredControlIds: [...requiredControls],
      },
      {
        assetType: "agent",
        riskBand: "critical",
        reviewGate: "executive-board",
        requiredReviewers: [...requiredReviewers, "executiveSponsor"],
        requiredControlIds: [...requiredControls],
      },
      {
        assetType: "skill",
        riskBand: "low",
        reviewGate: "auto-approve",
        requiredReviewers: ["coeLead"],
        requiredControlIds: [requiredControls[0], requiredControls[1], requiredControls[4]],
      },
      {
        assetType: "skill",
        riskBand: "medium",
        reviewGate: "standard-review",
        requiredReviewers: ["coeLead", "securityRepresentative"],
        requiredControlIds: [...requiredControls],
      },
      {
        assetType: "skill",
        riskBand: "high",
        reviewGate: "governance-board",
        requiredReviewers: [...requiredReviewers],
        requiredControlIds: [...requiredControls],
      },
      {
        assetType: "skill",
        riskBand: "critical",
        reviewGate: "executive-board",
        requiredReviewers: [...requiredReviewers, "executiveSponsor"],
        requiredControlIds: [...requiredControls],
      },
    ],
  };
}

/**
 * @param {{
 *   cadences?: Array<{
 *     assetType: "agent"|"skill";
 *     riskBand: "low"|"medium"|"high"|"critical";
 *     cadenceDays: number;
 *   }>;
 * }} input
 */
export function buildAttestationCadencePolicy(input = {}) {
  return {
    version: "2026.06.1",
    cadences: input.cadences ?? [
      { assetType: "agent", riskBand: "low", cadenceDays: 180 },
      { assetType: "agent", riskBand: "medium", cadenceDays: 90 },
      { assetType: "agent", riskBand: "high", cadenceDays: 60 },
      { assetType: "agent", riskBand: "critical", cadenceDays: 30 },
      { assetType: "skill", riskBand: "low", cadenceDays: 180 },
      { assetType: "skill", riskBand: "medium", cadenceDays: 90 },
      { assetType: "skill", riskBand: "high", cadenceDays: 60 },
      { assetType: "skill", riskBand: "critical", cadenceDays: 30 },
    ],
  };
}

/**
 * @param {{
 *   taxonomy: ReturnType<typeof buildRiskTaxonomy>;
 *   matrix: ReturnType<typeof buildGovernanceMatrix>;
 *   attestation: ReturnType<typeof buildAttestationCadencePolicy>;
 * }} input
 */
export function summarizeGovernanceRiskReadiness(input) {
  const taxonomyBands = new Set(input.taxonomy.bands.map((band) => band.riskBand));
  const matrixKeys = new Set(input.matrix.mappings.map((mapping) => `${mapping.assetType}:${mapping.riskBand}`));
  const cadenceKeys = new Set(input.attestation.cadences.map((cadence) => `${cadence.assetType}:${cadence.riskBand}`));

  const requiredKeys = REQUIRED_ASSET_TYPES.flatMap((assetType) =>
    REQUIRED_RISK_BANDS.map((riskBand) => `${assetType}:${riskBand}`)
  );

  const checks = {
    taxonomyCoverage: makeCheck(
      REQUIRED_RISK_BANDS.every((band) => taxonomyBands.has(band)),
      REQUIRED_RISK_BANDS.filter((band) => !taxonomyBands.has(band)).map((band) => `missing-risk-band:${band}`)
    ),
    governanceMatrixCoverage: makeCheck(
      requiredKeys.every((key) => matrixKeys.has(key)),
      requiredKeys.filter((key) => !matrixKeys.has(key)).map((key) => `missing-governance-mapping:${key}`)
    ),
    policyMappingIntegrity: makeCheck(
      input.matrix.mappings.every(
        (mapping) => mapping.requiredControlIds.length > 0 && mapping.requiredReviewers.length > 0
      ),
      input.matrix.mappings.flatMap((mapping) => [
        ...(mapping.requiredControlIds.length > 0 ? [] : [`missing-controls:${mapping.assetType}:${mapping.riskBand}`]),
        ...(mapping.requiredReviewers.length > 0 ? [] : [`missing-reviewers:${mapping.assetType}:${mapping.riskBand}`]),
      ])
    ),
    attestationCoverage: makeCheck(
      requiredKeys.every((key) => cadenceKeys.has(key)) &&
        input.attestation.cadences.every((cadence) => cadence.cadenceDays > 0),
      [
        ...requiredKeys.filter((key) => !cadenceKeys.has(key)).map((key) => `missing-attestation-cadence:${key}`),
        ...input.attestation.cadences.flatMap((cadence) =>
          cadence.cadenceDays > 0 ? [] : [`invalid-attestation-cadence:${cadence.assetType}:${cadence.riskBand}`]
        ),
      ]
    ),
  };

  return {
    overallStatus: Object.values(checks).every((check) => check.status === "ready") ? "ready" : "blocked",
    checks,
    failedChecks: Object.values(checks).flatMap((check) => check.reasonCodes),
  };
}

function makeCheck(ok, reasonCodes = []) {
  return {
    status: ok ? "ready" : "blocked",
    reasonCodes,
  };
}
