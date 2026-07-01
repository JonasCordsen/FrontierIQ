import test from "node:test";
import assert from "node:assert/strict";

import {
  buildEnablementArtifactPack,
  buildRolloutCommunicationsPlan,
  buildTrainingAudienceSegments,
  buildTrainingCurriculum,
  summarizeTrainingAndCommunicationsReadiness,
} from "../../src/govern/operating-model/training-and-communications.mjs";

test("builds training audience segments with required rollout populations", () => {
  const audience = buildTrainingAudienceSegments();

  const segmentIds = audience.segments.map((segment) => segment.segmentId);
  assert.ok(segmentIds.includes("it-admins"));
  assert.ok(segmentIds.includes("agent-builders"));
  assert.ok(segmentIds.includes("service-desk"));
  assert.ok(segmentIds.includes("executive-stakeholders"));
});

test("builds curriculum with one track per required audience segment", () => {
  const curriculum = buildTrainingCurriculum();

  assert.equal(curriculum.tracks.length >= 4, true);
  const trackSegmentIds = new Set(curriculum.tracks.map((track) => track.audienceSegmentId));
  assert.equal(trackSegmentIds.has("it-admins"), true);
  assert.equal(trackSegmentIds.has("agent-builders"), true);
  assert.equal(trackSegmentIds.has("service-desk"), true);
  assert.equal(trackSegmentIds.has("executive-stakeholders"), true);
});

test("builds enablement artifact pack with templates docs and communication assets", () => {
  const artifacts = buildEnablementArtifactPack();

  assert.equal(artifacts.templates.length >= 3, true);
  assert.equal(artifacts.internalDocs.length >= 4, true);
  assert.equal(artifacts.communicationAssets.length >= 3, true);
});

test("builds rollout communications plan covering all lifecycle phases", () => {
  const plan = buildRolloutCommunicationsPlan();

  const phases = plan.phases.map((phase) => phase.phaseId);
  assert.equal(phases.includes("pre-launch"), true);
  assert.equal(phases.includes("launch"), true);
  assert.equal(phases.includes("adoption-sprint"), true);
  assert.equal(phases.includes("steady-state"), true);
});

test("training and communications readiness is blocked when launch communications are incomplete", () => {
  const readiness = summarizeTrainingAndCommunicationsReadiness({
    audience: buildTrainingAudienceSegments(),
    curriculum: buildTrainingCurriculum(),
    artifacts: buildEnablementArtifactPack(),
    communications: buildRolloutCommunicationsPlan({
      phases: [
        {
          phaseId: "pre-launch",
          audienceSegmentIds: ["it-admins"],
          channels: ["teams"],
          cadence: "weekly",
          messageTheme: "readiness",
        },
      ],
    }),
  });

  assert.equal(readiness.overallStatus, "blocked");
  assert.ok(readiness.failedChecks.includes("missing-rollout-phase:launch"));
});

test("training and communications readiness is ready with complete contracts", () => {
  const readiness = summarizeTrainingAndCommunicationsReadiness({
    audience: buildTrainingAudienceSegments(),
    curriculum: buildTrainingCurriculum(),
    artifacts: buildEnablementArtifactPack(),
    communications: buildRolloutCommunicationsPlan(),
  });

  assert.equal(readiness.overallStatus, "ready");
  assert.equal(readiness.failedChecks.length, 0);
});
