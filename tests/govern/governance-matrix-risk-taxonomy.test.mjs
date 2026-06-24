import test from "node:test";
import assert from "node:assert/strict";

import {
  buildAttestationCadencePolicy,
  buildGovernanceMatrix,
  buildRiskTaxonomy,
  summarizeGovernanceRiskReadiness,
} from "../../src/govern/operations/governance-matrix-risk-taxonomy.mjs";

test("builds risk taxonomy with low medium high critical bands", () => {
  const taxonomy = buildRiskTaxonomy();
  const riskBands = taxonomy.bands.map((band) => band.riskBand);

  assert.equal(riskBands.includes("low"), true);
  assert.equal(riskBands.includes("medium"), true);
  assert.equal(riskBands.includes("high"), true);
  assert.equal(riskBands.includes("critical"), true);
});

test("builds governance matrix for agent and skill across all risk bands", () => {
  const matrix = buildGovernanceMatrix();
  const keys = new Set(matrix.mappings.map((mapping) => `${mapping.assetType}:${mapping.riskBand}`));

  assert.equal(keys.has("agent:low"), true);
  assert.equal(keys.has("agent:critical"), true);
  assert.equal(keys.has("skill:low"), true);
  assert.equal(keys.has("skill:critical"), true);
});

test("builds attestation cadence policy for all asset and risk combinations", () => {
  const attestation = buildAttestationCadencePolicy();
  assert.equal(attestation.cadences.length, 8);
  assert.equal(attestation.cadences.every((cadence) => cadence.cadenceDays > 0), true);
});

test("readiness blocks when governance mapping is missing", () => {
  const readiness = summarizeGovernanceRiskReadiness({
    taxonomy: buildRiskTaxonomy(),
    matrix: buildGovernanceMatrix({
      mappings: [
        {
          assetType: "agent",
          riskBand: "low",
          reviewGate: "auto-approve",
          requiredReviewers: ["coeLead"],
          requiredControlIds: ["access.least-privilege"],
        },
      ],
    }),
    attestation: buildAttestationCadencePolicy(),
  });

  assert.equal(readiness.overallStatus, "blocked");
  assert.ok(readiness.failedChecks.includes("missing-governance-mapping:skill:critical"));
});

test("readiness blocks when attestation cadence is invalid", () => {
  const readiness = summarizeGovernanceRiskReadiness({
    taxonomy: buildRiskTaxonomy(),
    matrix: buildGovernanceMatrix(),
    attestation: buildAttestationCadencePolicy({
      cadences: [
        { assetType: "agent", riskBand: "low", cadenceDays: 0 },
        { assetType: "agent", riskBand: "medium", cadenceDays: 90 },
        { assetType: "agent", riskBand: "high", cadenceDays: 60 },
        { assetType: "agent", riskBand: "critical", cadenceDays: 30 },
        { assetType: "skill", riskBand: "low", cadenceDays: 180 },
        { assetType: "skill", riskBand: "medium", cadenceDays: 90 },
        { assetType: "skill", riskBand: "high", cadenceDays: 60 },
        { assetType: "skill", riskBand: "critical", cadenceDays: 30 },
      ],
    }),
  });

  assert.equal(readiness.overallStatus, "blocked");
  assert.ok(readiness.failedChecks.includes("invalid-attestation-cadence:agent:low"));
});

test("readiness is ready with complete taxonomy matrix and attestation policies", () => {
  const readiness = summarizeGovernanceRiskReadiness({
    taxonomy: buildRiskTaxonomy(),
    matrix: buildGovernanceMatrix(),
    attestation: buildAttestationCadencePolicy(),
  });

  assert.equal(readiness.overallStatus, "ready");
  assert.equal(readiness.failedChecks.length, 0);
});
