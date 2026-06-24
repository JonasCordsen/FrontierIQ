const REQUIRED_SEGMENT_IDS = Object.freeze([
  "it-admins",
  "agent-builders",
  "service-desk",
  "executive-stakeholders",
]);

const REQUIRED_ROLLOUT_PHASES = Object.freeze([
  "pre-launch",
  "launch",
  "adoption-sprint",
  "steady-state",
]);

/**
 * @param {{
 *   ownerRole?: string;
 *   segments?: Array<{
 *     segmentId: string;
 *     title: string;
 *     goals: string[];
 *     requiredForRollout: boolean;
 *     channels: string[];
 *   }>;
 * }} input
 */
export function buildTrainingAudienceSegments(input = {}) {
  return {
    version: "2026.06.1",
    ownerRole: input.ownerRole ?? "changeManagementLead",
    segments: input.segments ?? [
      {
        segmentId: "it-admins",
        title: "IT administrators",
        goals: ["configure-governance-baselines", "monitor-usage-and-incidents"],
        requiredForRollout: true,
        channels: ["teams-live-session", "operator-runbook-walkthrough"],
      },
      {
        segmentId: "agent-builders",
        title: "Agent builders",
        goals: ["ship-policy-compliant-agents", "apply-secure-prompt-patterns"],
        requiredForRollout: true,
        channels: ["hands-on-lab", "office-hours"],
      },
      {
        segmentId: "service-desk",
        title: "Service desk and support",
        goals: ["triage-agent-incidents", "route-escalations-with-evidence"],
        requiredForRollout: true,
        channels: ["playbook-drill", "knowledge-base-briefing"],
      },
      {
        segmentId: "executive-stakeholders",
        title: "Executive stakeholders",
        goals: ["align-on-value-kpis", "review-risk-and-control-posture"],
        requiredForRollout: true,
        channels: ["monthly-briefing", "quarterly-business-review"],
      },
    ],
  };
}

/**
 * @param {{
 *   tracks?: Array<{
 *     trackId: string;
 *     audienceSegmentId: string;
 *     modules: Array<{ moduleId: string; title: string; durationMinutes: number; deliveryMode: "live"|"self-paced"|"hybrid" }>;
 *     completionTargetPercent: number;
 *   }>;
 * }} input
 */
export function buildTrainingCurriculum(input = {}) {
  return {
    version: "2026.06.1",
    tracks: input.tracks ?? [
      {
        trackId: "admin-governance-foundations",
        audienceSegmentId: "it-admins",
        modules: [
          { moduleId: "adm-001", title: "Governance baseline operations", durationMinutes: 90, deliveryMode: "live" },
          { moduleId: "adm-002", title: "SIEM and incident response workflows", durationMinutes: 75, deliveryMode: "hybrid" },
        ],
        completionTargetPercent: 95,
      },
      {
        trackId: "builder-safe-agent-delivery",
        audienceSegmentId: "agent-builders",
        modules: [
          { moduleId: "bld-001", title: "Secure agent design patterns", durationMinutes: 90, deliveryMode: "live" },
          { moduleId: "bld-002", title: "Onboarding evidence and approvals", durationMinutes: 60, deliveryMode: "self-paced" },
        ],
        completionTargetPercent: 90,
      },
      {
        trackId: "support-ops-readiness",
        audienceSegmentId: "service-desk",
        modules: [
          { moduleId: "sup-001", title: "Operator playbook drill", durationMinutes: 60, deliveryMode: "live" },
          { moduleId: "sup-002", title: "Escalation and lifecycle transitions", durationMinutes: 45, deliveryMode: "self-paced" },
        ],
        completionTargetPercent: 90,
      },
      {
        trackId: "executive-value-governance",
        audienceSegmentId: "executive-stakeholders",
        modules: [
          { moduleId: "exe-001", title: "Value realization scorecards", durationMinutes: 45, deliveryMode: "live" },
          { moduleId: "exe-002", title: "Risk and compliance governance review", durationMinutes: 45, deliveryMode: "live" },
        ],
        completionTargetPercent: 100,
      },
    ],
  };
}

/**
 * @param {{
 *   templates?: string[];
 *   internalDocs?: string[];
 *   communicationAssets?: string[];
 * }} input
 */
export function buildEnablementArtifactPack(input = {}) {
  return {
    version: "2026.06.1",
    templates: input.templates ?? [
      "templates/agent-onboarding-checklist.md",
      "templates/incident-escalation-brief.md",
      "templates/executive-value-review-deck.pptx",
    ],
    internalDocs: input.internalDocs ?? [
      "docs/180-tenant-onboarding-automation.md",
      "docs/230-siem-integration.md",
      "docs/250-operator-playbooks.md",
      "docs/260-agents-coe.md",
    ],
    communicationAssets: input.communicationAssets ?? [
      "comms/launch-announcement-email.html",
      "comms/training-invite-teams-post.md",
      "comms/adoption-kpi-monthly-update.md",
    ],
  };
}

/**
 * @param {{
 *   ownerRole?: string;
 *   phases?: Array<{
 *     phaseId: "pre-launch"|"launch"|"adoption-sprint"|"steady-state";
 *     audienceSegmentIds: string[];
 *     channels: string[];
 *     cadence: string;
 *     messageTheme: string;
 *   }>;
 * }} input
 */
export function buildRolloutCommunicationsPlan(input = {}) {
  return {
    version: "2026.06.1",
    ownerRole: input.ownerRole ?? "changeManagementLead",
    phases: input.phases ?? [
      {
        phaseId: "pre-launch",
        audienceSegmentIds: ["it-admins", "agent-builders", "service-desk"],
        channels: ["teams", "email", "office-hours"],
        cadence: "weekly",
        messageTheme: "readiness-and-what-is-changing",
      },
      {
        phaseId: "launch",
        audienceSegmentIds: ["it-admins", "agent-builders", "service-desk", "executive-stakeholders"],
        channels: ["email", "townhall", "intranet"],
        cadence: "daily-first-week",
        messageTheme: "go-live-guardrails-and-support",
      },
      {
        phaseId: "adoption-sprint",
        audienceSegmentIds: ["agent-builders", "service-desk", "executive-stakeholders"],
        channels: ["teams", "kpi-digest", "q-and-a"],
        cadence: "twice-weekly",
        messageTheme: "adoption-progress-and-hotspots",
      },
      {
        phaseId: "steady-state",
        audienceSegmentIds: ["it-admins", "executive-stakeholders"],
        channels: ["monthly-briefing", "quarterly-review"],
        cadence: "monthly",
        messageTheme: "value-risk-and-next-actions",
      },
    ],
  };
}

/**
 * @param {{
 *   audience: ReturnType<typeof buildTrainingAudienceSegments>;
 *   curriculum: ReturnType<typeof buildTrainingCurriculum>;
 *   artifacts: ReturnType<typeof buildEnablementArtifactPack>;
 *   communications: ReturnType<typeof buildRolloutCommunicationsPlan>;
 * }} input
 */
export function summarizeTrainingAndCommunicationsReadiness(input) {
  const segmentIds = new Set(input.audience.segments.map((segment) => segment.segmentId));
  const trackSegmentIds = new Set(input.curriculum.tracks.map((track) => track.audienceSegmentId));
  const phaseIds = new Set(input.communications.phases.map((phase) => phase.phaseId));

  const checks = {
    segmentCoverage: makeCheck(
      REQUIRED_SEGMENT_IDS.every((segmentId) => segmentIds.has(segmentId)),
      REQUIRED_SEGMENT_IDS.filter((segmentId) => !segmentIds.has(segmentId)).map((segmentId) => `missing-segment:${segmentId}`)
    ),
    curriculumCoverage: makeCheck(
      input.curriculum.tracks.length >= REQUIRED_SEGMENT_IDS.length &&
        REQUIRED_SEGMENT_IDS.every((segmentId) => trackSegmentIds.has(segmentId)),
      REQUIRED_SEGMENT_IDS.filter((segmentId) => !trackSegmentIds.has(segmentId)).map(
        (segmentId) => `missing-curriculum-track:${segmentId}`
      )
    ),
    artifactCoverage: makeCheck(
      input.artifacts.templates.length >= 3 &&
        input.artifacts.internalDocs.length >= 4 &&
        input.artifacts.communicationAssets.length >= 3,
      [
        ...(input.artifacts.templates.length >= 3 ? [] : ["insufficient-templates"]),
        ...(input.artifacts.internalDocs.length >= 4 ? [] : ["insufficient-internal-docs"]),
        ...(input.artifacts.communicationAssets.length >= 3 ? [] : ["insufficient-communication-assets"]),
      ]
    ),
    rolloutCoverage: makeCheck(
      REQUIRED_ROLLOUT_PHASES.every((phaseId) => phaseIds.has(phaseId)),
      REQUIRED_ROLLOUT_PHASES.filter((phaseId) => !phaseIds.has(phaseId)).map((phaseId) => `missing-rollout-phase:${phaseId}`)
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
