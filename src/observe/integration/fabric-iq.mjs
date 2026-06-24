import { SOLUTION_IDS } from "../foundation/solution-taxonomy.mjs";

const AGENT_STATUSES = new Set(["connected", "degraded", "disconnected"]);
const SKILL_STATUSES = new Set(["approved", "pending", "rejected"]);
const ACCESS_MODES = new Set(["readOnly", "directQuery", "cachedImport"]);
const AVAILABILITY_STATUSES = new Set(["available", "preview", "unsupported"]);
const PERMISSION_KINDS = new Set(["delegatedScope", "appRole", "workspaceRole"]);

/**
 * @param {{
 *   toolId: string;
 *   tenantId: string;
 *   workspaceId: string;
 *   workspaceName: string;
 *   workspaceRegion: string;
 *   owner: string;
 *   semanticModelId: string;
 *   semanticModelName: string;
 *   semanticModelRegion: string;
 *   supportedRegions: string[];
 *   requiredPermissions: Array<{
 *     permissionId: string;
 *     permissionName: string;
 *     kind: "delegatedScope"|"appRole"|"workspaceRole";
 *     targetType: "workspace"|"semanticModel";
 *     targetId: string;
 *   }>;
 *   ontologies?: string[];
 *   regionAvailabilityStatus?: "available"|"preview"|"unsupported";
 * }} input
 */
export function buildFabricIqToolRegistration(input) {
  if (!input.toolId) throw new Error("toolId is required");
  if (!input.tenantId) throw new Error("tenantId is required");
  const workspaceId = input.workspaceId ?? input.workspace?.workspaceId;
  const workspaceName = input.workspaceName ?? input.workspace?.workspaceName;
  const workspaceRegion = input.workspaceRegion ?? input.workspace?.region;
  const semanticModelId = input.semanticModelId ?? input.semanticModel?.semanticModelId;
  const semanticModelName = input.semanticModelName ?? input.semanticModel?.semanticModelName;
  const semanticModelRegion = input.semanticModelRegion ?? input.semanticModel?.region;

  if (!workspaceId || !workspaceName) {
    throw new Error("workspaceId and workspaceName are required");
  }
  if (!semanticModelId || !semanticModelName) {
    throw new Error("semanticModelId and semanticModelName are required");
  }
  if (!input.owner) throw new Error("owner is required");
  if (!workspaceRegion || !semanticModelRegion) {
    throw new Error("workspaceRegion and semanticModelRegion are required");
  }
  if (!Array.isArray(input.supportedRegions) || input.supportedRegions.length === 0) {
    throw new Error("supportedRegions must be a non-empty array");
  }
  if (!AVAILABILITY_STATUSES.has(input.regionAvailabilityStatus ?? "available")) {
    throw new Error("regionAvailabilityStatus must be available|preview|unsupported");
  }
  if (!Array.isArray(input.requiredPermissions) || input.requiredPermissions.length === 0) {
    throw new Error("requiredPermissions must be a non-empty array");
  }

  const requiredPermissions = input.requiredPermissions.map((permission) => {
    if (!permission.permissionId || !permission.permissionName) {
      throw new Error("permissionId and permissionName are required");
    }
    if (!PERMISSION_KINDS.has(permission.kind)) {
      throw new Error("permission kind must be delegatedScope|appRole|workspaceRole");
    }
    if (!["workspace", "semanticModel"].includes(permission.targetType)) {
      throw new Error("targetType must be workspace or semanticModel");
    }
    if (!permission.targetId) {
      throw new Error("targetId is required for requiredPermissions");
    }
    return { ...permission };
  });

  return {
    version: "2026.06.1",
    toolId: input.toolId,
    tenantId: input.tenantId,
    solutionId: SOLUTION_IDS.FABRIC,
    workload: "fabric-iq",
    owner: input.owner,
    workspace: {
      workspaceId,
      workspaceName,
      region: workspaceRegion,
    },
    semanticModel: {
      semanticModelId,
      semanticModelName,
      region: semanticModelRegion,
    },
    supportedRegions: [...new Set(input.supportedRegions)].sort((left, right) => left.localeCompare(right)),
    regionAvailabilityStatus: input.regionAvailabilityStatus ?? "available",
    ontologies: [...new Set(input.ontologies ?? ["default-business-ontology"])].sort((left, right) =>
      left.localeCompare(right)
    ),
    requiredPermissions,
  };
}

/**
 * @param {{
 *   agentId: string;
 *   name: string;
 *   ontologyId: string;
 *   status: "connected"|"degraded"|"disconnected";
 *   supportedIntents: string[];
 *   supportedEntities: string[];
 *   supportedMeasures: string[];
 *   maxConfidenceDrop?: number;
 * }} input
 */
export function buildOntologyAgentContract(input) {
  if (!input.agentId || !input.name || !input.ontologyId) {
    throw new Error("agentId, name, and ontologyId are required");
  }
  if (!AGENT_STATUSES.has(input.status)) {
    throw new Error("ontology agent status must be connected|degraded|disconnected");
  }
  if (!Array.isArray(input.supportedIntents) || input.supportedIntents.length === 0) {
    throw new Error("supportedIntents must be a non-empty array");
  }
  return {
    ...input,
    supportedEntities: [...new Set(input.supportedEntities ?? [])].sort((left, right) => left.localeCompare(right)),
    supportedMeasures: [...new Set(input.supportedMeasures ?? [])].sort((left, right) => left.localeCompare(right)),
    maxConfidenceDrop: input.maxConfidenceDrop ?? 0.15,
  };
}

/**
 * @param {{
 *   agentId: string;
 *   name: string;
 *   status: "connected"|"degraded"|"disconnected";
 *   workspaceId: string;
 *   semanticModelId: string;
 *   semanticModelName: string;
 *   workspaceRegion: string;
 *   semanticModelRegion: string;
 *   accessMode: "readOnly"|"directQuery"|"cachedImport";
 *   grantedPermissions: Array<{
 *     permissionName: string;
 *     kind: "delegatedScope"|"appRole"|"workspaceRole";
 *     targetType: "workspace"|"semanticModel";
 *     targetId: string;
 *   }>;
 * }} input
 */
export function buildDataAgentContract(input) {
  if (!input.agentId || !input.name) throw new Error("agentId and name are required");
  if (!AGENT_STATUSES.has(input.status)) {
    throw new Error("data agent status must be connected|degraded|disconnected");
  }
  if (!ACCESS_MODES.has(input.accessMode)) {
    throw new Error("accessMode must be readOnly|directQuery|cachedImport");
  }
  if (!Array.isArray(input.grantedPermissions) || input.grantedPermissions.length === 0) {
    throw new Error("grantedPermissions must be a non-empty array");
  }

  return {
    ...input,
    grantedPermissions: input.grantedPermissions.map((permission) => {
      if (!permission.permissionName) throw new Error("permissionName is required");
      if (!PERMISSION_KINDS.has(permission.kind)) {
        throw new Error("granted permission kind must be delegatedScope|appRole|workspaceRole");
      }
      if (!["workspace", "semanticModel"].includes(permission.targetType)) {
        throw new Error("granted permission targetType must be workspace or semanticModel");
      }
      if (!permission.targetId) throw new Error("granted permission targetId is required");
      return { ...permission };
    }),
  };
}

/**
 * @param {{
 *   registration: ReturnType<typeof buildFabricIqToolRegistration>;
 *   ontologyAgent: ReturnType<typeof buildOntologyAgentContract>;
 *   dataAgent: ReturnType<typeof buildDataAgentContract>;
 *   lastAttestedAt: string;
 *   riskBand?: "high"|"medium"|"low";
 * }} input
 */
export function buildFabricIqRegistryEntry(input) {
  if (Number.isNaN(Date.parse(input.lastAttestedAt))) {
    throw new Error("lastAttestedAt must be ISO-8601");
  }
  const registration = buildFabricIqToolRegistration(input.registration);
  const ontologyAgent = buildOntologyAgentContract(input.ontologyAgent);
  const dataAgent = buildDataAgentContract(input.dataAgent);

  return {
    agentId: registration.toolId,
    name: "Fabric IQ",
    owner: registration.owner,
    solutionId: registration.solutionId,
    riskBand: input.riskBand ?? "medium",
    lastAttestedAt: input.lastAttestedAt,
    skills: [
      {
        skillId: ontologyAgent.agentId,
        name: ontologyAgent.name,
        permissionScopes: registration.requiredPermissions
          .filter((permission) => permission.targetType === "workspace")
          .map((permission) => permission.permissionName),
        status: mapAgentStatusToSkillStatus(ontologyAgent.status),
      },
      {
        skillId: dataAgent.agentId,
        name: dataAgent.name,
        permissionScopes: dataAgent.grantedPermissions.map((permission) => permission.permissionName),
        status: mapAgentStatusToSkillStatus(dataAgent.status),
      },
    ],
    metadata: {
      workload: registration.workload,
      workspaceId: registration.workspace.workspaceId,
      semanticModelId: registration.semanticModel.semanticModelId,
      ontologyId: ontologyAgent.ontologyId,
      supportedRegions: registration.supportedRegions,
    },
  };
}

/**
 * @param {{
 *   registration: ReturnType<typeof buildFabricIqToolRegistration>;
 *   ontologyAgent: ReturnType<typeof buildOntologyAgentContract>;
 *   dataAgent: ReturnType<typeof buildDataAgentContract>;
 *   queryText: string;
 *   mapping: {
 *     intent: string;
 *     entities: string[];
 *     measures: string[];
 *     filters?: string[];
 *     targetSemanticModelId: string;
 *     confidence: number;
 *   };
 * }} input
 */
export function validateNl2OntologyQuery(input) {
  const registration = buildFabricIqToolRegistration(input.registration);
  const ontologyAgent = buildOntologyAgentContract(input.ontologyAgent);
  const dataAgent = buildDataAgentContract(input.dataAgent);
  /** @type {string[]} */
  const reasonCodes = [];

  if (!input.queryText) reasonCodes.push("missing_query_text");
  if (!ontologyAgent.supportedIntents.includes(input.mapping.intent)) {
    reasonCodes.push("intent_not_supported");
  }
  if (input.mapping.targetSemanticModelId !== registration.semanticModel.semanticModelId) {
    reasonCodes.push("semantic_model_mismatch");
  }
  if (input.mapping.targetSemanticModelId !== dataAgent.semanticModelId) {
    reasonCodes.push("data_agent_model_mismatch");
  }
  if (!Array.isArray(input.mapping.entities) || input.mapping.entities.length === 0) {
    reasonCodes.push("missing_entities");
  }
  if (!Array.isArray(input.mapping.measures) || input.mapping.measures.length === 0) {
    reasonCodes.push("missing_measures");
  }
  const unsupportedEntities = (input.mapping.entities ?? []).filter(
    (entity) => !ontologyAgent.supportedEntities.includes(entity)
  );
  if (unsupportedEntities.length > 0) {
    reasonCodes.push("unsupported_entities");
  }
  const unsupportedMeasures = (input.mapping.measures ?? []).filter(
    (measure) => !ontologyAgent.supportedMeasures.includes(measure)
  );
  if (unsupportedMeasures.length > 0) {
    reasonCodes.push("unsupported_measures");
  }
  if (typeof input.mapping.confidence !== "number" || input.mapping.confidence < 0.7) {
    reasonCodes.push("confidence_below_threshold");
  }

  return {
    ok: reasonCodes.length === 0,
    reasonCodes,
    normalizedQuery: {
      queryText: input.queryText,
      intent: input.mapping.intent,
      entities: [...new Set(input.mapping.entities ?? [])].sort((left, right) => left.localeCompare(right)),
      measures: [...new Set(input.mapping.measures ?? [])].sort((left, right) => left.localeCompare(right)),
      filters: [...new Set(input.mapping.filters ?? [])].sort((left, right) => left.localeCompare(right)),
      targetSemanticModelId: input.mapping.targetSemanticModelId,
      confidence: input.mapping.confidence,
    },
  };
}

/**
 * @param {{
 *   registration: ReturnType<typeof buildFabricIqToolRegistration>;
 *   dataAgent: ReturnType<typeof buildDataAgentContract>;
 *   principal: { principalId: string; principalType: "user"|"servicePrincipal" };
 * }} input
 */
export function validateSemanticModelAccess(input) {
  const registration = buildFabricIqToolRegistration(input.registration);
  const dataAgent = buildDataAgentContract(input.dataAgent);
  /** @type {string[]} */
  const reasonCodes = [];

  for (const required of registration.requiredPermissions) {
    const granted = dataAgent.grantedPermissions.some((permission) =>
      permission.permissionName === required.permissionName &&
      permission.kind === required.kind &&
      permission.targetType === required.targetType &&
      permission.targetId === required.targetId
    );
    if (!granted) {
      reasonCodes.push(`missing_permission:${required.permissionId}`);
    }
  }
  if (dataAgent.workspaceId !== registration.workspace.workspaceId) {
    reasonCodes.push("workspace_mismatch");
  }
  if (dataAgent.semanticModelId !== registration.semanticModel.semanticModelId) {
    reasonCodes.push("semantic_model_access_mismatch");
  }
  if (dataAgent.status === "disconnected") {
    reasonCodes.push("data_agent_disconnected");
  }

  return {
    ok: reasonCodes.length === 0,
    principal: input.principal,
    reasonCodes,
    grantedPermissionCount: dataAgent.grantedPermissions.length,
    requiredPermissionCount: registration.requiredPermissions.length,
  };
}

/**
 * @param {{
 *   registration: ReturnType<typeof buildFabricIqToolRegistration>;
 *   tenantRegion: string;
 * }} input
 */
export function validateFabricIqRegionAvailability(input) {
  const registration = buildFabricIqToolRegistration(input.registration);
  /** @type {string[]} */
  const reasonCodes = [];

  if (!registration.supportedRegions.includes(input.tenantRegion)) {
    reasonCodes.push("tenant_region_unsupported");
  }
  if (!registration.supportedRegions.includes(registration.workspace.region)) {
    reasonCodes.push("workspace_region_unsupported");
  }
  if (!registration.supportedRegions.includes(registration.semanticModel.region)) {
    reasonCodes.push("semantic_model_region_unsupported");
  }
  if (registration.workspace.region !== registration.semanticModel.region) {
    reasonCodes.push("cross_region_semantic_model");
  }
  if (registration.regionAvailabilityStatus === "unsupported") {
    reasonCodes.push("fabric_iq_region_unavailable");
  }
  if (registration.regionAvailabilityStatus === "preview") {
    reasonCodes.push("fabric_iq_region_preview");
  }

  return {
    ok: reasonCodes.length === 0 || (reasonCodes.length === 1 && reasonCodes[0] === "fabric_iq_region_preview"),
    reasonCodes,
    tenantRegion: input.tenantRegion,
    workspaceRegion: registration.workspace.region,
    semanticModelRegion: registration.semanticModel.region,
    availabilityStatus: registration.regionAvailabilityStatus,
  };
}

/**
 * @param {{
 *   registration: ReturnType<typeof buildFabricIqToolRegistration>;
 *   ontologyAgent: ReturnType<typeof buildOntologyAgentContract>;
 *   dataAgent: ReturnType<typeof buildDataAgentContract>;
 *   queryValidation: ReturnType<typeof validateNl2OntologyQuery>;
 *   accessValidation: ReturnType<typeof validateSemanticModelAccess>;
 *   regionValidation: ReturnType<typeof validateFabricIqRegionAvailability>;
 * }} input
 */
export function summarizeFabricIqReadiness(input) {
  const registration = buildFabricIqToolRegistration(input.registration);
  const ontologyAgent = buildOntologyAgentContract(input.ontologyAgent);
  const dataAgent = buildDataAgentContract(input.dataAgent);

  return {
    solutionId: registration.solutionId,
    workload: registration.workload,
    toolId: registration.toolId,
    checks: {
      toolRegistered: makeCheck(Boolean(registration.toolId)),
      ontologyAgentConnected: makeCheck(ontologyAgent.status === "connected", [
        ...(ontologyAgent.status === "connected" ? [] : [`ontology_agent_${ontologyAgent.status}`]),
      ]),
      dataAgentConnected: makeCheck(dataAgent.status === "connected", [
        ...(dataAgent.status === "connected" ? [] : [`data_agent_${dataAgent.status}`]),
      ]),
      nl2OntologyReady: makeCheck(input.queryValidation.ok, input.queryValidation.reasonCodes),
      semanticModelAccessReady: makeCheck(input.accessValidation.ok, input.accessValidation.reasonCodes),
      regionAlignmentReady: makeCheck(input.regionValidation.ok, input.regionValidation.reasonCodes),
    },
    failedChecks: [
      ...input.queryValidation.reasonCodes,
      ...input.accessValidation.reasonCodes,
      ...input.regionValidation.reasonCodes,
      ...(ontologyAgent.status === "connected" ? [] : [`ontology_agent_${ontologyAgent.status}`]),
      ...(dataAgent.status === "connected" ? [] : [`data_agent_${dataAgent.status}`]),
    ],
  };
}

function mapAgentStatusToSkillStatus(status) {
  if (!AGENT_STATUSES.has(status)) {
    throw new Error("agent status must be connected|degraded|disconnected");
  }
  /** @type {"approved"|"pending"|"rejected"} */
  const skillStatus = status === "connected"
    ? "approved"
    : status === "degraded"
      ? "pending"
      : "rejected";
  if (!SKILL_STATUSES.has(skillStatus)) {
    throw new Error("invalid mapped skill status");
  }
  return skillStatus;
}

function makeCheck(ok, reasonCodes = []) {
  return {
    status: ok ? "ready" : "blocked",
    reasonCodes,
  };
}
