import { createHash } from "node:crypto";

import { createIngestionScope } from "../../observe/ingestion/runtime-pipeline.mjs";
import {
  validateAclSync,
  validatePurviewLabelEnforcement,
} from "../../observe/ingestion/foundry-iq-connector.mjs";
import { CONTROL_IDS } from "../../govern/policy/control-catalog.mjs";
import { getEvidenceArtifactsForControl } from "../../govern/policy/evidence-mapping.mjs";
import {
  detectPiiFindings,
  redactSensitiveText,
} from "../privacy/m365-copilot-privacy-posture.mjs";

const DETECTOR_CATALOG = Object.freeze([
  {
    detectorId: "pii-source-content",
    stage: "ingestion",
    signalType: "pii",
    title: "Source content PII scanner",
    description: "Scans staged source documents for PII before indexing.",
    controls: [CONTROL_IDS.PII_DETECTION_REDACTION],
  },
  {
    detectorId: "pii-indexed-content",
    stage: "ingestion",
    signalType: "pii",
    title: "Indexed content PII scanner",
    description: "Scans indexed chunks and snippets for retained sensitive content.",
    controls: [CONTROL_IDS.PII_DETECTION_REDACTION],
  },
  {
    detectorId: "acl-drift",
    stage: "ingestion",
    signalType: "access",
    title: "ACL drift detector",
    description: "Flags ACL hash drift and deny-precedence loss between source and index.",
    controls: [CONTROL_IDS.ACCESS_LEAST_PRIVILEGE],
  },
  {
    detectorId: "purview-label-drift",
    stage: "ingestion",
    signalType: "label",
    title: "Purview label drift detector",
    description: "Flags label mismatches and stale label sync in indexed content.",
    controls: [CONTROL_IDS.PURVIEW_LABEL_ENFORCEMENT],
  },
  {
    detectorId: "query-answer-pii",
    stage: "query",
    signalType: "exposure",
    title: "Query answer PII detector",
    description: "Detects sensitive data surfaced in generated answers.",
    controls: [CONTROL_IDS.PII_DETECTION_REDACTION, CONTROL_IDS.AUDIT_TRACEABILITY],
  },
  {
    detectorId: "query-hit-exposure",
    stage: "query",
    signalType: "exposure",
    title: "Query hit exposure detector",
    description: "Evaluates whether sensitive hits were blocked, redacted, or exposed.",
    controls: [
      CONTROL_IDS.PII_DETECTION_REDACTION,
      CONTROL_IDS.PURVIEW_LABEL_ENFORCEMENT,
      CONTROL_IDS.AUDIT_TRACEABILITY,
    ],
  },
]);

const SEVERITY_ORDER = Object.freeze(["none", "low", "medium", "high", "critical"]);
const ENFORCEMENT_ACTIONS = Object.freeze(["allow", "warn", "review", "throttle", "suspend"]);
const ENFORCEMENT_STATES = Object.freeze(["clear", "warned", "in_review", "throttled", "suspended"]);

export function buildOvershareDetectorCatalog() {
  return DETECTOR_CATALOG.map((detector) => ({ ...detector, controls: [...detector.controls] }));
}

/**
 * @param {{
 *   scope: ReturnType<typeof createIngestionScope>;
 *   documents: Array<{ id: string; title?: string; content?: string; text?: string }>;
 *   sourceDocuments: Array<{
 *     sourceDocumentId: string;
 *     sourceArtifactId: string;
 *     sourceUri: string;
 *     title: string;
 *     contentHash: string;
 *     lastModifiedAt: string;
 *     aclEntries: Array<{ principalId: string; principalType: "user"|"group"|"servicePrincipal"; access: "read"|"deny"; inherited?: boolean }>;
 *     requiredPurviewLabelId: string;
 *     requiredPurviewLabelName: string;
 *     labelAppliedAt: string;
 *     aclHash: string;
 *     aclVersion: string;
 *   }>;
 *   indexedDocuments?: Array<{
 *     documentId: string;
 *     chunkId: string;
 *     sourceDocumentId: string;
 *     sourceArtifactId: string;
 *     sourceUri: string;
 *     title: string;
 *     snippet: string;
 *     indexedAt: string;
 *     indexedContentHash: string;
 *     aclEntries: Array<{ principalId: string; principalType: "user"|"group"|"servicePrincipal"; access: "read"|"deny"; inherited?: boolean }>;
 *     indexedLabelId: string;
 *     indexedLabelName: string;
 *     indexedAclHash: string;
 *     securityTrimMode?: string;
 *   }>;
 *   generatedAt?: string;
 * }} input
 */
export function buildIngestionOvershareAssessment(input) {
  const scope = createIngestionScope(input.scope);
  const generatedAt = ensureIsoDate(input.generatedAt ?? new Date().toISOString(), "generatedAt");
  const sourceDocuments = Array.isArray(input.sourceDocuments) ? input.sourceDocuments : [];
  const indexedDocuments = Array.isArray(input.indexedDocuments) ? input.indexedDocuments : [];

  const sourcePiiFindings = buildHashedPiiFindings(
    (Array.isArray(input.documents) ? input.documents : []).map((document) => ({
      itemId: String(document.id),
      sourceDocumentId: String(document.id),
      title: document.title ?? String(document.id),
      text: buildDocumentText(document),
    }))
  );
  const indexedPiiFindings = buildHashedPiiFindings(
    indexedDocuments.map((document) => ({
      itemId: document.chunkId,
      sourceDocumentId: document.sourceDocumentId,
      title: document.title,
      text: [document.title, document.snippet].filter(Boolean).join("\n"),
    }))
  );

  const aclValidation = validateAclSync(sourceDocuments, indexedDocuments);
  const purviewValidation = validatePurviewLabelEnforcement(sourceDocuments, indexedDocuments);
  const documentFindings = buildDocumentFindings({
    documents: Array.isArray(input.documents) ? input.documents : [],
    sourceDocuments,
    indexedDocuments,
    sourcePiiFindings,
    indexedPiiFindings,
    aclValidation,
    purviewValidation,
  });

  const riskInputs = {
    sourcePiiDocumentCount: countWhere(documentFindings, (item) => item.sourcePiiFindingCount > 0),
    indexedPiiDocumentCount: countWhere(documentFindings, (item) => item.indexedPiiFindingCount > 0),
    aclMismatchCount: aclValidation.mismatches.filter((item) => item.code === "acl_hash_mismatch").length,
    denyPrecedenceLostCount: aclValidation.mismatches.filter((item) => item.code === "deny_precedence_lost").length,
    labelMismatchCount: purviewValidation.mismatches.filter((item) => item.code === "label_mismatch").length,
    staleLabelSyncCount: purviewValidation.mismatches.filter((item) => item.code === "stale_label_sync").length,
  };

  const riskScore = capAt100(
    Math.min(sourcePiiFindings.length * 8, 24) +
      Math.min(riskInputs.indexedPiiDocumentCount * 12, 24) +
      Math.min(riskInputs.aclMismatchCount * 14, 28) +
      Math.min(riskInputs.denyPrecedenceLostCount * 18, 36) +
      Math.min(riskInputs.labelMismatchCount * 10, 20) +
      Math.min(riskInputs.staleLabelSyncCount * 6, 12)
  );
  const severity = classifySeverity(riskScore);
  const reasonCodes = unique([
    ...(sourcePiiFindings.length > 0 ? ["pii_detected"] : []),
    ...(indexedPiiFindings.length > 0 ? ["indexed_pii_detected"] : []),
    ...aclValidation.mismatches.map((item) => item.code),
    ...purviewValidation.mismatches.map((item) => item.code),
  ]);
  const controlIds = deriveControlIds({
    reasonCodes,
    includeAuditTraceability: riskScore > 0,
  });

  return {
    assessmentId: hashValue(
      [scope.tenantId, scope.connectionId, "ingestion", generatedAt, reasonCodes.join(",")].join("|")
    ).slice(0, 16),
    stage: "ingestion",
    generatedAt,
    ...scope,
    detectorIds: DETECTOR_CATALOG.filter((detector) => detector.stage === "ingestion").map(
      (detector) => detector.detectorId
    ),
    documentFindings,
    sourcePiiFindings,
    indexedPiiFindings,
    aclValidation,
    purviewValidation,
    summary: {
      totalSourceDocuments: Array.isArray(input.documents) ? input.documents.length : 0,
      totalIndexedDocuments: indexedDocuments.length,
      sourceDocumentsWithPii: riskInputs.sourcePiiDocumentCount,
      indexedDocumentsWithPii: riskInputs.indexedPiiDocumentCount,
      aclMismatchCount: riskInputs.aclMismatchCount,
      denyPrecedenceLostCount: riskInputs.denyPrecedenceLostCount,
      labelMismatchCount: riskInputs.labelMismatchCount,
      staleLabelSyncCount: riskInputs.staleLabelSyncCount,
    },
    actualExposure: false,
    riskScore,
    severity,
    reasonCodes,
    controlIds,
    evidenceArtifacts: collectEvidenceArtifacts(controlIds),
  };
}

/**
 * @param {{
 *   queryRequest: {
 *     queryId: string;
 *     knowledgeBaseRef: string;
 *     indexRef: string;
 *     queryText: string;
 *     filtersApplied: { principalIds: string[]; labelFilterIds: string[] };
 *     topK: number;
 *   };
 *   queryResponse: {
 *     queryId: string;
 *     knowledgeBaseRef: string;
 *     indexRef: string;
 *     queryText: string;
 *     filtersApplied: { principalIds: string[]; labelFilterIds: string[] };
 *     answer: string | null;
 *     hits: Array<{
 *       documentId: string;
 *       chunkId: string;
 *       title: string;
 *       snippet: string;
 *       score: number;
 *       sourceDocumentId: string;
 *       sourceArtifactId: string;
 *       sourceUri: string;
 *       citations: string[];
 *       blocked?: boolean;
 *       redacted?: boolean;
 *       labelStatus?: string;
 *       enforcementReason?: string | null;
 *     }>;
 *     diagnostics: { latencyMs: number; blockedHitCount: number; redactedHitCount: number; warnings: string[] };
 *   };
 *   sourceAssessment?: ReturnType<typeof buildIngestionOvershareAssessment> | null;
 *   generatedAt?: string;
 * }} input
 */
export function buildQueryOvershareAssessment(input) {
  const generatedAt = ensureIsoDate(input.generatedAt ?? new Date().toISOString(), "generatedAt");
  const answerPiiFindings = buildHashedPiiFindings(
    input.queryResponse.answer
      ? [
          {
            itemId: `${input.queryRequest.queryId}:answer`,
            sourceDocumentId: "__answer__",
            title: "answer",
            text: input.queryResponse.answer,
          },
        ]
      : []
  );
  const hitPiiFindings = buildHashedPiiFindings(
    input.queryResponse.hits.map((hit) => ({
      itemId: hit.chunkId,
      sourceDocumentId: hit.sourceDocumentId,
      title: hit.title,
      text: [hit.title, hit.snippet].filter(Boolean).join("\n"),
    }))
  );
  const hitMeta = new Map(input.queryResponse.hits.map((hit) => [hit.chunkId, hit]));
  const sourceFindingMeta = new Map(
    (input.sourceAssessment?.documentFindings ?? []).map((item) => [item.sourceDocumentId, item])
  );

  const piiHitsByExposure = {
    blocked: new Set(),
    redacted: new Set(),
    exposed: new Set(),
  };
  const blockedHits = new Set(
    input.queryResponse.hits.filter((hit) => hit.blocked).map((hit) => hit.chunkId)
  );
  const redactedHits = new Set(
    input.queryResponse.hits.filter((hit) => hit.redacted).map((hit) => hit.chunkId)
  );
  for (const finding of hitPiiFindings) {
    const hit = hitMeta.get(finding.itemId);
    if (!hit) continue;
    if (hit.blocked) {
      piiHitsByExposure.blocked.add(hit.chunkId);
      continue;
    }
    if (hit.redacted) {
      piiHitsByExposure.redacted.add(hit.chunkId);
      continue;
    }
    piiHitsByExposure.exposed.add(hit.chunkId);
  }

  const labelGapHits = input.queryResponse.hits.filter((hit) => hit.labelStatus !== "enforced");
  const sourceRiskHits = input.queryResponse.hits.filter((hit) => {
    const sourceFinding = sourceFindingMeta.get(hit.sourceDocumentId);
    return Boolean(
      sourceFinding &&
        (sourceFinding.hasAclMismatch ||
          sourceFinding.hasDenyPrecedenceLoss ||
          sourceFinding.hasLabelMismatch ||
          sourceFinding.hasStaleLabelSync)
    );
  });
  const actualExposure =
    answerPiiFindings.length > 0 || piiHitsByExposure.exposed.size > 0;

  const riskScore = capAt100(
    (answerPiiFindings.length > 0 ? 30 : 0) +
      Math.min(piiHitsByExposure.exposed.size * 20, 40) +
      Math.min(sourceRiskHits.length * 12, 24) +
      Math.min(labelGapHits.length * 8, 16) +
      Math.min(redactedHits.size * 4, 8) +
      Math.min(blockedHits.size * 2, 4) +
      Math.min((input.queryResponse.diagnostics.warnings ?? []).length * 3, 6)
  );
  const severity = classifySeverity(riskScore);
  const reasonCodes = unique([
    ...(answerPiiFindings.length > 0 ? ["answer_pii_detected"] : []),
    ...(piiHitsByExposure.exposed.size > 0 ? ["query_hit_pii_exposed"] : []),
    ...(redactedHits.size > 0 ? ["query_hit_pii_redacted"] : []),
    ...(blockedHits.size > 0 ? ["query_hit_pii_blocked"] : []),
    ...(labelGapHits.length > 0 ? ["query_label_gap"] : []),
    ...sourceRiskHits.flatMap((hit) => {
      const sourceFinding = sourceFindingMeta.get(hit.sourceDocumentId);
      return [
        ...(sourceFinding?.hasAclMismatch || sourceFinding?.hasDenyPrecedenceLoss
          ? ["source_acl_drift_exposed"]
          : []),
        ...(sourceFinding?.hasLabelMismatch || sourceFinding?.hasStaleLabelSync
          ? ["source_label_drift_exposed"]
          : []),
      ];
    }),
    ...(input.queryResponse.diagnostics.warnings ?? []),
  ]);
  const controlIds = deriveControlIds({
    reasonCodes,
    includeAuditTraceability: riskScore > 0,
  });

  return {
    assessmentId: hashValue(
      [input.queryRequest.queryId, "query", generatedAt, reasonCodes.join(",")].join("|")
    ).slice(0, 16),
    stage: "query",
    generatedAt,
    queryId: input.queryRequest.queryId,
    knowledgeBaseRef: input.queryRequest.knowledgeBaseRef,
    indexRef: input.queryRequest.indexRef,
    queryText: input.queryRequest.queryText,
    actualExposure,
    answerPiiFindings,
    hitPiiFindings,
    summary: {
      answerFindingCount: answerPiiFindings.length,
      blockedHitCount: blockedHits.size,
      redactedHitCount: redactedHits.size,
      exposedHitCount: piiHitsByExposure.exposed.size,
      labelGapHitCount: labelGapHits.length,
      sourceRiskHitCount: sourceRiskHits.length,
    },
    riskScore,
    severity,
    reasonCodes,
    controlIds,
    evidenceArtifacts: collectEvidenceArtifacts(controlIds),
  };
}

/**
 * @param {{
 *   incident: {
 *     assessmentId: string;
 *     stage: "ingestion"|"query";
 *     severity: "none"|"low"|"medium"|"high"|"critical";
 *     riskScore: number;
 *     reasonCodes: string[];
 *     controlIds: string[];
 *     evidenceArtifacts: string[];
 *     actualExposure: boolean;
 *   };
 *   priorState?: "clear"|"warned"|"in_review"|"throttled"|"suspended";
 *   recurrenceCount?: number;
 *   policy?: {
 *     warningScore?: number;
 *     reviewScore?: number;
 *     throttleScore?: number;
 *     suspendScore?: number;
 *     recurrenceEscalationThreshold?: number;
 *   };
 * }} input
 */
export function evaluateOvershareEnforcement(input) {
  const policy = {
    warningScore: input.policy?.warningScore ?? 10,
    reviewScore: input.policy?.reviewScore ?? 30,
    throttleScore: input.policy?.throttleScore ?? 60,
    suspendScore: input.policy?.suspendScore ?? 85,
    recurrenceEscalationThreshold: input.policy?.recurrenceEscalationThreshold ?? 1,
  };
  const priorState = input.priorState ?? "clear";
  if (!ENFORCEMENT_STATES.includes(priorState)) {
    throw new Error("priorState must be clear|warned|in_review|throttled|suspended");
  }
  const recurrenceCount = Number.isInteger(input.recurrenceCount) && input.recurrenceCount >= 0
    ? input.recurrenceCount
    : 0;

  let actionIndex = ENFORCEMENT_ACTIONS.indexOf("allow");
  if (input.incident.riskScore >= policy.warningScore) actionIndex = 1;
  if (input.incident.riskScore >= policy.reviewScore) actionIndex = 2;
  if (
    input.incident.riskScore >= policy.throttleScore &&
    (input.incident.actualExposure || input.incident.reasonCodes.includes("deny_precedence_lost"))
  ) {
    actionIndex = 3;
  }
  if (
    input.incident.riskScore >= policy.suspendScore &&
    (input.incident.actualExposure || input.incident.reasonCodes.includes("deny_precedence_lost")) &&
    (recurrenceCount >= policy.recurrenceEscalationThreshold || priorState === "throttled")
  ) {
    actionIndex = 4;
  }
  if (recurrenceCount > 0 && actionIndex > 0 && actionIndex < ENFORCEMENT_ACTIONS.length - 1) {
    actionIndex += 1;
  }
  if (
    !input.incident.actualExposure &&
    !input.incident.reasonCodes.includes("deny_precedence_lost") &&
    actionIndex > 2
  ) {
    actionIndex = 2;
  }
  if (priorState === "suspended" && input.incident.riskScore > 0) {
    actionIndex = 4;
  }

  const recommendedAction = ENFORCEMENT_ACTIONS[actionIndex];
  const nextState = mapActionToState(recommendedAction);
  const controlIds = unique([
    ...input.incident.controlIds,
    ...(recommendedAction === "review" || recommendedAction === "throttle" || recommendedAction === "suspend"
      ? [CONTROL_IDS.APPROVAL_GATES, CONTROL_IDS.AUDIT_TRACEABILITY]
      : []),
  ]);

  return {
    decisionId: hashValue(
      [
        input.incident.assessmentId,
        priorState,
        String(recurrenceCount),
        recommendedAction,
      ].join("|")
    ).slice(0, 16),
    incidentId: input.incident.assessmentId,
    priorState,
    recurrenceCount,
    recommendedAction,
    nextState,
    reviewRequired: recommendedAction !== "allow" && recommendedAction !== "warn",
    controlIds,
    evidenceArtifacts: collectEvidenceArtifacts(controlIds),
    reasonCodes: unique([
      ...input.incident.reasonCodes,
      ...(recurrenceCount > 0 ? ["recurrence_detected"] : []),
      ...(recommendedAction === "throttle" ? ["throttle_recommended"] : []),
      ...(recommendedAction === "suspend" ? ["suspension_recommended"] : []),
    ]),
    automation: {
      shouldWarnOwners: recommendedAction === "warn",
      shouldOpenReview: recommendedAction === "review",
      shouldThrottleQueries: recommendedAction === "throttle" || recommendedAction === "suspend",
      shouldSuspendConnector: recommendedAction === "suspend",
    },
    policy,
  };
}

function buildDocumentText(document) {
  return [document.title, document.content, document.text].filter(Boolean).join("\n");
}

function buildHashedPiiFindings(items) {
  const rawFindings = detectPiiFindings(items.map((item) => ({ itemId: item.itemId, text: item.text })));
  const itemMetadata = new Map(items.map((item) => [item.itemId, item]));
  const seen = new Set();

  return rawFindings.flatMap((finding) => {
    const meta = itemMetadata.get(finding.itemId);
    if (!meta) return [];
    const valueHash = hashValue(`${finding.type}|${String(finding.value).toLowerCase()}`);
    const dedupeKey = `${meta.sourceDocumentId}|${finding.type}|${valueHash}`;
    if (seen.has(dedupeKey)) return [];
    seen.add(dedupeKey);
    return [
      {
        itemId: finding.itemId,
        sourceDocumentId: meta.sourceDocumentId,
        title: meta.title,
        type: finding.type,
        valueHash,
        preview: redactSensitiveText(String(finding.value)),
      },
    ];
  });
}

function buildDocumentFindings(input) {
  const documentIds = new Set([
    ...input.documents.map((document) => String(document.id)),
    ...input.sourceDocuments.map((document) => document.sourceDocumentId),
    ...input.indexedDocuments.map((document) => document.sourceDocumentId),
  ]);
  const aclMismatches = new Map(groupCodesByDocumentId(input.aclValidation.mismatches));
  const labelMismatches = new Map(groupCodesByDocumentId(input.purviewValidation.mismatches));

  return [...documentIds].sort((left, right) => left.localeCompare(right)).map((sourceDocumentId) => {
    const sourcePii = input.sourcePiiFindings.filter((finding) => finding.sourceDocumentId === sourceDocumentId);
    const indexedPii = input.indexedPiiFindings.filter((finding) => finding.sourceDocumentId === sourceDocumentId);
    const aclCodes = aclMismatches.get(sourceDocumentId) ?? [];
    const labelCodes = labelMismatches.get(sourceDocumentId) ?? [];
    return {
      sourceDocumentId,
      sourcePiiFindingCount: sourcePii.length,
      indexedPiiFindingCount: indexedPii.length,
      hasAclMismatch: aclCodes.includes("acl_hash_mismatch"),
      hasDenyPrecedenceLoss: aclCodes.includes("deny_precedence_lost"),
      hasLabelMismatch: labelCodes.includes("label_mismatch"),
      hasStaleLabelSync: labelCodes.includes("stale_label_sync"),
    };
  });
}

function groupCodesByDocumentId(items) {
  /** @type {Map<string, string[]>} */
  const grouped = new Map();
  for (const item of items) {
    const existing = grouped.get(item.sourceDocumentId) ?? [];
    if (!existing.includes(item.code)) existing.push(item.code);
    grouped.set(item.sourceDocumentId, existing);
  }
  return grouped;
}

function deriveControlIds(input) {
  const controls = [];
  if (input.reasonCodes.some((code) => code.includes("pii"))) {
    controls.push(CONTROL_IDS.PII_DETECTION_REDACTION);
  }
  if (input.reasonCodes.some((code) => code.includes("label") || code === "stale_label_sync")) {
    controls.push(CONTROL_IDS.PURVIEW_LABEL_ENFORCEMENT);
  }
  if (
    input.reasonCodes.includes("acl_hash_mismatch") ||
    input.reasonCodes.includes("deny_precedence_lost") ||
    input.reasonCodes.includes("source_acl_drift_exposed")
  ) {
    controls.push(CONTROL_IDS.ACCESS_LEAST_PRIVILEGE);
  }
  if (input.includeAuditTraceability) {
    controls.push(CONTROL_IDS.AUDIT_TRACEABILITY);
  }
  return unique(controls);
}

function collectEvidenceArtifacts(controlIds) {
  return unique(controlIds.flatMap((controlId) => getEvidenceArtifactsForControl(controlId)));
}

function countWhere(items, predicate) {
  return items.filter(predicate).length;
}

function unique(items) {
  return [...new Set(items)];
}

function capAt100(value) {
  return Math.max(0, Math.min(100, Number(value.toFixed(2))));
}

function classifySeverity(riskScore) {
  if (riskScore >= 85) return SEVERITY_ORDER[4];
  if (riskScore >= 60) return SEVERITY_ORDER[3];
  if (riskScore >= 30) return SEVERITY_ORDER[2];
  if (riskScore > 0) return SEVERITY_ORDER[1];
  return SEVERITY_ORDER[0];
}

function mapActionToState(action) {
  switch (action) {
    case "warn":
      return "warned";
    case "review":
      return "in_review";
    case "throttle":
      return "throttled";
    case "suspend":
      return "suspended";
    default:
      return "clear";
  }
}

function ensureIsoDate(value, fieldName) {
  if (Number.isNaN(Date.parse(value))) {
    throw new Error(`${fieldName} must be ISO-8601`);
  }
  return value;
}

function hashValue(value) {
  return createHash("sha256").update(value).digest("hex");
}
