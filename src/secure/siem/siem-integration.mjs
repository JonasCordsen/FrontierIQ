import { createHash } from "node:crypto";

export const SIEM_PLATFORMS = Object.freeze(["sentinel", "splunk", "qradar", "genericWebhook"]);
export const SIEM_EVENT_KINDS = Object.freeze([
  "governance-decision",
  "overshare-incident",
  "overshare-enforcement",
]);
export const SIEM_SEVERITIES = Object.freeze(["low", "medium", "high", "critical"]);
export const SIEM_DELIVERY_KINDS = Object.freeze(["audit", "incident"]);
export const PLAYBOOK_STEP_ACTIONS = Object.freeze([
  "preserve-evidence",
  "disable-principal",
  "revoke-consent",
  "throttle-access",
  "open-review-case",
  "notify-owner",
  "notify-soc",
  "hold-change",
]);

const SEVERITY_RANK = Object.freeze({
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
});

const OVERSHARE_OUTCOMES = Object.freeze(["at-risk", "exposed"]);
const GOVERNANCE_OUTCOMES = Object.freeze(["allow", "deny", "require_approval"]);
const ENFORCEMENT_OUTCOMES = Object.freeze(["allow", "warn", "review", "throttle", "suspend"]);

/**
 * @param {{
 *   connectorId: string;
 *   tenantId: string;
 *   platform: "sentinel"|"splunk"|"qradar"|"genericWebhook";
 *   owner: string;
 *   destinationName: string;
 *   workspaceId?: string;
 *   workspaceName?: string;
 *   minimumSeverity?: "low"|"medium"|"high"|"critical";
 *   supportedEventKinds?: Array<"governance-decision"|"overshare-incident"|"overshare-enforcement">;
 *   transport?: "nativeApi"|"eventHub"|"webhook";
 * }} input
 */
export function buildSiemConnectorRegistration(input) {
  if (!input.connectorId) throw new Error("connectorId is required");
  if (!input.tenantId) throw new Error("tenantId is required");
  if (!SIEM_PLATFORMS.includes(input.platform)) {
    throw new Error("platform must be sentinel|splunk|qradar|genericWebhook");
  }
  if (!input.owner) throw new Error("owner is required");
  if (!input.destinationName) throw new Error("destinationName is required");
  if (!SIEM_SEVERITIES.includes(input.minimumSeverity ?? "low")) {
    throw new Error("minimumSeverity must be low|medium|high|critical");
  }

  const supportedEventKinds = [...new Set(input.supportedEventKinds ?? SIEM_EVENT_KINDS)].sort((left, right) =>
    left.localeCompare(right)
  );
  if (supportedEventKinds.length === 0 || supportedEventKinds.some((kind) => !SIEM_EVENT_KINDS.includes(kind))) {
    throw new Error("supportedEventKinds must contain known SIEM event kinds");
  }

  if (input.platform === "sentinel" && (!input.workspaceId || !input.workspaceName)) {
    throw new Error("workspaceId and workspaceName are required for Sentinel");
  }

  return {
    version: "2026.06.1",
    connectorId: input.connectorId,
    tenantId: input.tenantId,
    platform: input.platform,
    owner: input.owner,
    minimumSeverity: input.minimumSeverity ?? "low",
    supportedEventKinds,
    transport:
      input.transport ??
      (input.platform === "sentinel" ? "nativeApi" : input.platform === "genericWebhook" ? "webhook" : "nativeApi"),
    destination: {
      destinationName: input.destinationName,
      workspaceId: input.workspaceId ?? null,
      workspaceName: input.workspaceName ?? null,
    },
  };
}

/**
 * @param {{
 *   trace: {
 *     traceType: "governance-decision";
 *     tenantId: string;
 *     solutionId: string;
 *     principalId: string;
 *     actionType: string;
 *     resourceId: string;
 *     decision: "allow"|"deny"|"require_approval";
 *     reasons: string[];
 *     enforcedControls: string[];
 *     evaluatedAt: string;
 *     metadata?: Record<string, string|number|boolean>;
 *   };
 * }} input
 */
export function buildGovernanceDecisionSiemEvent(input) {
  const trace = input.trace;
  if (!trace || trace.traceType !== "governance-decision") {
    throw new Error("trace.traceType must be governance-decision");
  }
  if (!GOVERNANCE_OUTCOMES.includes(trace.decision)) {
    throw new Error("trace.decision must be allow|deny|require_approval");
  }
  if (Number.isNaN(Date.parse(trace.evaluatedAt))) {
    throw new Error("trace.evaluatedAt must be ISO-8601");
  }

  const severity = trace.decision === "deny" ? "high" : trace.decision === "require_approval" ? "medium" : "low";
  const deliveryKind = trace.decision === "allow" ? "audit" : "incident";
  const recommendedPlaybookId =
    trace.decision === "deny" ? "access-revocation" : trace.decision === "require_approval" ? "risk-containment" : null;

  return {
    version: "2026.06.1",
    eventId: hashValue(
      [
        trace.tenantId,
        trace.solutionId,
        trace.resourceId,
        trace.actionType,
        trace.decision,
        trace.evaluatedAt,
      ].join("|")
    ).slice(0, 16),
    tenantId: trace.tenantId,
    solutionId: trace.solutionId,
    eventKind: "governance-decision",
    outcome: trace.decision,
    severity,
    deliveryKind,
    occurredAt: trace.evaluatedAt,
    sourceRecordType: trace.traceType,
    sourceRecordId: `${trace.principalId}:${trace.resourceId}`,
    title: `Governance ${trace.decision} for ${trace.actionType}`,
    summary: trace.reasons.join(" "),
    controlIds: [...new Set(trace.enforcedControls)].sort((left, right) => left.localeCompare(right)),
    evidenceArtifacts: [],
    recommendedPlaybookId,
    dimensions: {
      principalId: trace.principalId,
      actionType: trace.actionType,
      resourceId: trace.resourceId,
      riskBand: String(trace.metadata?.riskBand ?? "unknown"),
      permissionName: String(trace.metadata?.permissionName ?? "n/a"),
    },
  };
}

/**
 * @param {{
 *   incident: {
 *     assessmentId: string;
 *     tenantId?: string;
 *     solutionId?: string;
 *     stage: "ingestion"|"query";
 *     severity: "none"|"low"|"medium"|"high"|"critical";
 *     riskScore: number;
 *     reasonCodes: string[];
 *     controlIds: string[];
 *     evidenceArtifacts: string[];
 *     actualExposure: boolean;
 *     generatedAt?: string;
 *   };
 * }} input
 */
export function buildOvershareIncidentSiemEvent(input) {
  const incident = input.incident;
  if (!incident?.assessmentId) throw new Error("incident.assessmentId is required");
  if (!["ingestion", "query"].includes(incident.stage)) {
    throw new Error("incident.stage must be ingestion|query");
  }
  if (!["none", "low", "medium", "high", "critical"].includes(incident.severity)) {
    throw new Error("incident.severity must be none|low|medium|high|critical");
  }

  const severity = incident.severity === "none" ? "low" : incident.severity;
  const deliveryKind = severityRank(severity) >= severityRank("medium") || incident.actualExposure ? "incident" : "audit";
  const outcome = incident.actualExposure ? "exposed" : "at-risk";

  return {
    version: "2026.06.1",
    eventId: hashValue([incident.assessmentId, incident.stage, severity, outcome].join("|")).slice(0, 16),
    tenantId: incident.tenantId ?? "unknown-tenant",
    solutionId: incident.solutionId ?? "m365-copilot",
    eventKind: "overshare-incident",
    outcome,
    severity,
    deliveryKind,
    occurredAt: incident.generatedAt ?? "unknown",
    sourceRecordType: "overshare-assessment",
    sourceRecordId: incident.assessmentId,
    title: `Overshare ${incident.stage} incident (${severity})`,
    summary: incident.reasonCodes.join(", "),
    controlIds: [...new Set(incident.controlIds)].sort((left, right) => left.localeCompare(right)),
    evidenceArtifacts: [...new Set(incident.evidenceArtifacts)].sort((left, right) => left.localeCompare(right)),
    recommendedPlaybookId: deliveryKind === "incident" ? "risk-containment" : null,
    dimensions: {
      stage: incident.stage,
      riskScore: incident.riskScore,
      actualExposure: incident.actualExposure,
    },
  };
}

/**
 * @param {{
 *   decision: {
 *     decisionId: string;
 *     incidentId: string;
 *     recommendedAction: "allow"|"warn"|"review"|"throttle"|"suspend";
 *     nextState: "clear"|"warned"|"in_review"|"throttled"|"suspended";
 *     reviewRequired: boolean;
 *     controlIds: string[];
 *     evidenceArtifacts: string[];
 *     reasonCodes: string[];
 *   };
 *   incident?: {
 *     assessmentId: string;
 *     tenantId?: string;
 *     solutionId?: string;
 *     stage?: "ingestion"|"query";
 *     severity?: "none"|"low"|"medium"|"high"|"critical";
 *     evidenceArtifacts?: string[];
 *     controlIds?: string[];
 *   };
 * }} input
 */
export function buildOvershareEnforcementSiemEvent(input) {
  const decision = input.decision;
  if (!decision?.decisionId) throw new Error("decision.decisionId is required");
  if (!ENFORCEMENT_OUTCOMES.includes(decision.recommendedAction)) {
    throw new Error("decision.recommendedAction must be allow|warn|review|throttle|suspend");
  }
  if (input.incident && decision.incidentId !== input.incident.assessmentId) {
    throw new Error("decision.incidentId must match incident.assessmentId");
  }

  const severity = mapEnforcementActionToSeverity(decision.recommendedAction);
  const deliveryKind =
    decision.recommendedAction === "allow" || decision.recommendedAction === "warn" ? "audit" : "incident";
  const recommendedPlaybookId =
    decision.recommendedAction === "suspend"
      ? "access-revocation"
      : decision.recommendedAction === "review" || decision.recommendedAction === "throttle"
        ? "risk-containment"
        : null;

  return {
    version: "2026.06.1",
    eventId: hashValue([decision.decisionId, decision.incidentId, decision.recommendedAction].join("|")).slice(0, 16),
    tenantId: input.incident?.tenantId ?? "unknown-tenant",
    solutionId: input.incident?.solutionId ?? "m365-copilot",
    eventKind: "overshare-enforcement",
    outcome: decision.recommendedAction,
    severity,
    deliveryKind,
    occurredAt: "unknown",
    sourceRecordType: "overshare-enforcement",
    sourceRecordId: decision.decisionId,
    title: `Overshare enforcement ${decision.recommendedAction}`,
    summary: decision.reasonCodes.join(", "),
    controlIds: [...new Set([...(input.incident?.controlIds ?? []), ...decision.controlIds])].sort((left, right) =>
      left.localeCompare(right)
    ),
    evidenceArtifacts: [
      ...new Set([...(input.incident?.evidenceArtifacts ?? []), ...decision.evidenceArtifacts]),
    ].sort((left, right) => left.localeCompare(right)),
    recommendedPlaybookId,
    dimensions: {
      incidentId: decision.incidentId,
      nextState: decision.nextState,
      reviewRequired: decision.reviewRequired,
      sourceStage: input.incident?.stage ?? "unknown",
    },
  };
}

/**
 * @param {{
 *   routingId: string;
 *   tenantId: string;
 *   routes: Array<{
 *     routeId: string;
 *     eventKind: "governance-decision"|"overshare-incident"|"overshare-enforcement";
 *     deliveryKind: "audit"|"incident";
 *     minimumSeverity: "low"|"medium"|"high"|"critical";
 *     targetQueue: string;
 *     destination: string;
 *     outcomes?: string[];
 *     playbookId?: string | null;
 *   }>;
 * }} input
 */
export function buildIncidentRoutingPlan(input) {
  if (!input.routingId) throw new Error("routingId is required");
  if (!input.tenantId) throw new Error("tenantId is required");
  if (!Array.isArray(input.routes) || input.routes.length === 0) {
    throw new Error("routes must be a non-empty array");
  }

  return {
    version: "2026.06.1",
    routingId: input.routingId,
    tenantId: input.tenantId,
    routes: input.routes.map((route) => {
      if (!route.routeId) throw new Error("routeId is required");
      if (!SIEM_EVENT_KINDS.includes(route.eventKind)) {
        throw new Error("route.eventKind must be a known SIEM event kind");
      }
      if (!SIEM_DELIVERY_KINDS.includes(route.deliveryKind)) {
        throw new Error("route.deliveryKind must be audit|incident");
      }
      if (!SIEM_SEVERITIES.includes(route.minimumSeverity)) {
        throw new Error("route.minimumSeverity must be low|medium|high|critical");
      }
      if (!route.targetQueue || !route.destination) {
        throw new Error("route.targetQueue and route.destination are required");
      }
      if (route.deliveryKind === "incident" && !route.playbookId) {
        throw new Error("route.playbookId is required for incident routes");
      }

      const validOutcomes = getValidOutcomesForEventKind(route.eventKind);
      const outcomes = [...new Set(route.outcomes ?? validOutcomes)].sort((left, right) => left.localeCompare(right));
      if (outcomes.length === 0 || outcomes.some((outcome) => !validOutcomes.includes(outcome))) {
        throw new Error("route.outcomes must match the event kind");
      }

      return {
        routeId: route.routeId,
        eventKind: route.eventKind,
        deliveryKind: route.deliveryKind,
        minimumSeverity: route.minimumSeverity,
        targetQueue: route.targetQueue,
        destination: route.destination,
        outcomes,
        playbookId: route.playbookId ?? null,
      };
    }),
  };
}

/**
 * @param {{
 *   ownerRole?: string;
 *   notifyChannel?: string;
 * }} input
 */
export function buildIncidentPlaybookCatalog(input = {}) {
  const ownerRole = input.ownerRole ?? "securityOperator";
  const notifyChannel = input.notifyChannel ?? "soc@frontieriq.local";

  return {
    version: "2026.06.1",
    playbooks: [
      {
        playbookId: "access-revocation",
        name: "Access revocation",
        description: "Revoke access, suspend risky principals, and preserve evidence for severe incidents.",
        ownerRole,
        responseSlaMinutes: 15,
        supportedEventKinds: ["governance-decision", "overshare-enforcement"],
        supportedOutcomes: ["deny", "suspend"],
        steps: [
          {
            stepId: "preserve-evidence",
            actionType: "preserve-evidence",
            ownerRole: "securityOperator",
            targetType: "evidenceBundle",
            notes: "Export audit, overshare, and connector evidence before access changes.",
          },
          {
            stepId: "disable-principal",
            actionType: "disable-principal",
            ownerRole: "identityAdmin",
            targetType: "principalOrApp",
            notes: "Disable the user, app, or connector identity tied to the SIEM event.",
          },
          {
            stepId: "revoke-consent",
            actionType: "revoke-consent",
            ownerRole: "identityAdmin",
            targetType: "graphConsentGrant",
            notes: "Revoke delegated consent or app-role grants for the affected workload.",
          },
          {
            stepId: "notify-owner",
            actionType: "notify-owner",
            ownerRole: "coeLead",
            targetType: "ownerChannel",
            notes: `Notify accountable owners and record the response in ${notifyChannel}.`,
          },
        ],
      },
      {
        playbookId: "risk-containment",
        name: "Risk containment",
        description: "Contain risky activity, preserve evidence, and open a governed review flow.",
        ownerRole,
        responseSlaMinutes: 30,
        supportedEventKinds: ["governance-decision", "overshare-incident", "overshare-enforcement"],
        supportedOutcomes: ["require_approval", "at-risk", "exposed", "review", "throttle"],
        steps: [
          {
            stepId: "preserve-evidence",
            actionType: "preserve-evidence",
            ownerRole: "securityOperator",
            targetType: "evidenceBundle",
            notes: "Capture the source event, approval context, and affected documents or permissions.",
          },
          {
            stepId: "hold-change",
            actionType: "hold-change",
            ownerRole: "coeLead",
            targetType: "deploymentOrConnector",
            notes: "Pause deployment, ingestion, or risky workload expansion until review completes.",
          },
          {
            stepId: "throttle-access",
            actionType: "throttle-access",
            ownerRole: "platformEngineer",
            targetType: "connectorOrQueryPath",
            notes: "Throttle queries or indexing paths that are amplifying the incident.",
          },
          {
            stepId: "open-review-case",
            actionType: "open-review-case",
            ownerRole: "complianceRepresentative",
            targetType: "incidentTicket",
            notes: "Open a review case with evidence refs and remediation owner assignment.",
          },
          {
            stepId: "notify-soc",
            actionType: "notify-soc",
            ownerRole: "securityOperator",
            targetType: "socChannel",
            notes: `Notify the response queue and link the live case in ${notifyChannel}.`,
          },
        ],
      },
    ],
  };
}

/**
 * @param {ReturnType<typeof buildIncidentRoutingPlan>} routingPlan
 * @param {ReturnType<typeof buildGovernanceDecisionSiemEvent>|ReturnType<typeof buildOvershareIncidentSiemEvent>|ReturnType<typeof buildOvershareEnforcementSiemEvent>} event
 */
export function resolveSiemRoute(routingPlan, event) {
  return (
    routingPlan.routes.find((route) => {
      if (route.eventKind !== event.eventKind) return false;
      if (route.deliveryKind !== event.deliveryKind) return false;
      if (severityRank(event.severity) < severityRank(route.minimumSeverity)) return false;
      return route.outcomes.includes(event.outcome);
    }) ?? null
  );
}

/**
 * @param {{
 *   connector: Parameters<typeof buildSiemConnectorRegistration>[0] | ReturnType<typeof buildSiemConnectorRegistration>;
 *   routingPlan: Parameters<typeof buildIncidentRoutingPlan>[0] | ReturnType<typeof buildIncidentRoutingPlan>;
 *   playbookCatalog: ReturnType<typeof buildIncidentPlaybookCatalog>;
 *   sampleEvents: Array<
 *     | ReturnType<typeof buildGovernanceDecisionSiemEvent>
 *     | ReturnType<typeof buildOvershareIncidentSiemEvent>
 *     | ReturnType<typeof buildOvershareEnforcementSiemEvent>
 *   >;
 * }} input
 */
export function summarizeSiemReadiness(input) {
  const connector = input.connector.version ? input.connector : buildSiemConnectorRegistration(input.connector);
  const routingPlan = input.routingPlan.version ? input.routingPlan : buildIncidentRoutingPlan(input.routingPlan);
  const playbookCatalog = input.playbookCatalog;
  if (!playbookCatalog?.playbooks?.length) {
    throw new Error("playbookCatalog.playbooks must be a non-empty array");
  }
  if (!Array.isArray(input.sampleEvents) || input.sampleEvents.length === 0) {
    throw new Error("sampleEvents must be a non-empty array");
  }

  const eventKindCoverage = SIEM_EVENT_KINDS.map((eventKind) => {
    const connectorSupported = connector.supportedEventKinds.includes(eventKind);
    const routeCount = routingPlan.routes.filter((route) => route.eventKind === eventKind).length;
    return {
      eventKind,
      connectorSupported,
      routeCount,
      covered: connectorSupported && routeCount > 0,
    };
  });

  const sampleCoverage = input.sampleEvents.map((event) => {
    const connectorSupported =
      connector.supportedEventKinds.includes(event.eventKind) &&
      severityRank(event.severity) >= severityRank(connector.minimumSeverity);
    const route = connectorSupported ? resolveSiemRoute(routingPlan, event) : null;
    const playbook =
      route?.playbookId != null ? playbookCatalog.playbooks.find((item) => item.playbookId === route.playbookId) ?? null : null;
    const playbookSupportsEvent =
      route?.playbookId == null
        ? true
        : !!playbook &&
          playbook.supportedEventKinds.includes(event.eventKind) &&
          playbook.supportedOutcomes.includes(event.outcome);

    return {
      eventId: event.eventId,
      eventKind: event.eventKind,
      outcome: event.outcome,
      connectorSupported,
      matchedRouteId: route?.routeId ?? null,
      matchedPlaybookId: route?.playbookId ?? null,
      covered: connectorSupported && route != null && playbookSupportsEvent,
    };
  });

  const blockedChecks = [
    ...eventKindCoverage
      .filter((entry) => !entry.covered)
      .map((entry) => `missing-route-or-connector-support:${entry.eventKind}`),
    ...sampleCoverage.filter((entry) => !entry.covered).map((entry) => `unrouted-sample:${entry.eventKind}:${entry.outcome}`),
  ];

  return {
    connectorId: connector.connectorId,
    platform: connector.platform,
    ready: blockedChecks.length === 0,
    blockedChecks,
    eventKindCoverage,
    sampleCoverage,
    evidenceArtifacts: [
      "evidence/siem-connector-config.json",
      "evidence/siem-alert-routing.json",
      "evidence/incident-playbooks.json",
    ],
  };
}

function getValidOutcomesForEventKind(eventKind) {
  if (eventKind === "governance-decision") return GOVERNANCE_OUTCOMES;
  if (eventKind === "overshare-incident") return OVERSHARE_OUTCOMES;
  return ENFORCEMENT_OUTCOMES;
}

function mapEnforcementActionToSeverity(action) {
  if (action === "suspend") return "critical";
  if (action === "throttle") return "high";
  if (action === "review") return "medium";
  return "low";
}

/**
 * @param {"low"|"medium"|"high"|"critical"} severity
 */
function severityRank(severity) {
  return SEVERITY_RANK[severity];
}

/**
 * @param {string} value
 */
function hashValue(value) {
  return createHash("sha256").update(value).digest("hex");
}
