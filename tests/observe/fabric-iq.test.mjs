import test from "node:test";
import assert from "node:assert/strict";

import { buildAgentSkillRegistry, queryRegistry } from "../../src/observe/registry/agent-skill-registry.mjs";
import {
  buildDataAgentContract,
  buildFabricIqRegistryEntry,
  buildFabricIqToolRegistration,
  buildOntologyAgentContract,
  summarizeFabricIqReadiness,
  validateFabricIqRegionAvailability,
  validateNl2OntologyQuery,
  validateSemanticModelAccess,
} from "../../src/observe/integration/fabric-iq.mjs";

function createRegistration(overrides = {}) {
  return {
    toolId: "fabric-iq-1",
    tenantId: "tenant-a",
    workspaceId: "workspace-1",
    workspaceName: "Fabric Analytics",
    workspaceRegion: "northeurope",
    owner: "data-owner",
    semanticModelId: "model-1",
    semanticModelName: "Sales Model",
    semanticModelRegion: "northeurope",
    supportedRegions: ["northeurope", "westeurope"],
    requiredPermissions: [
      {
        permissionId: "workspace-reader",
        permissionName: "Workspace.Read.All",
        kind: "workspaceRole",
        targetType: "workspace",
        targetId: "workspace-1",
      },
      {
        permissionId: "semantic-model-reader",
        permissionName: "SemanticModel.Read.All",
        kind: "delegatedScope",
        targetType: "semanticModel",
        targetId: "model-1",
      },
    ],
    ...overrides,
  };
}

function createOntologyAgent(overrides = {}) {
  return {
    agentId: "ontology-agent-1",
    name: "Fabric Ontology Agent",
    ontologyId: "ontology-sales",
    status: "connected",
    supportedIntents: ["sales_analysis", "inventory_review"],
    supportedEntities: ["customer", "product", "region"],
    supportedMeasures: ["revenue", "margin", "unitsSold"],
    ...overrides,
  };
}

function createDataAgent(overrides = {}) {
  return {
    agentId: "data-agent-1",
    name: "Fabric Data Agent",
    status: "connected",
    workspaceId: "workspace-1",
    semanticModelId: "model-1",
    semanticModelName: "Sales Model",
    workspaceRegion: "northeurope",
    semanticModelRegion: "northeurope",
    accessMode: "directQuery",
    grantedPermissions: [
      {
        permissionName: "Workspace.Read.All",
        kind: "workspaceRole",
        targetType: "workspace",
        targetId: "workspace-1",
      },
      {
        permissionName: "SemanticModel.Read.All",
        kind: "delegatedScope",
        targetType: "semanticModel",
        targetId: "model-1",
      },
    ],
    ...overrides,
  };
}

test("fabric iq registration builds registry-compatible entry", () => {
  const registration = buildFabricIqToolRegistration(createRegistration());
  const entry = buildFabricIqRegistryEntry({
    registration,
    ontologyAgent: createOntologyAgent(),
    dataAgent: createDataAgent(),
    lastAttestedAt: "2026-06-24T10:00:00Z",
  });
  const registry = buildAgentSkillRegistry([entry]);
  const filtered = queryRegistry(registry, { solutionId: "fabric" });

  assert.equal(registration.solutionId, "fabric");
  assert.equal(registration.workload, "fabric-iq");
  assert.equal(entry.skills.length, 2);
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].metadata.semanticModelId, "model-1");
});

test("nl2ontology validation catches unsupported mappings and model mismatch", () => {
  const result = validateNl2OntologyQuery({
    registration: createRegistration(),
    ontologyAgent: createOntologyAgent(),
    dataAgent: createDataAgent(),
    queryText: "Show employee satisfaction by office",
    mapping: {
      intent: "people_analysis",
      entities: ["employee"],
      measures: ["satisfaction"],
      targetSemanticModelId: "other-model",
      confidence: 0.62,
    },
  });

  assert.equal(result.ok, false);
  assert.ok(result.reasonCodes.includes("intent_not_supported"));
  assert.ok(result.reasonCodes.includes("semantic_model_mismatch"));
  assert.ok(result.reasonCodes.includes("unsupported_entities"));
  assert.ok(result.reasonCodes.includes("unsupported_measures"));
  assert.ok(result.reasonCodes.includes("confidence_below_threshold"));
});

test("semantic model access and region checks surface permission and residency failures", () => {
  const access = validateSemanticModelAccess({
    registration: createRegistration(),
    dataAgent: createDataAgent({
      grantedPermissions: [
        {
          permissionName: "Workspace.Read.All",
          kind: "workspaceRole",
          targetType: "workspace",
          targetId: "workspace-1",
        },
      ],
    }),
    principal: { principalId: "principal-1", principalType: "servicePrincipal" },
  });
  const region = validateFabricIqRegionAvailability({
    registration: createRegistration({
      semanticModelRegion: "swedencentral",
      supportedRegions: ["northeurope"],
      regionAvailabilityStatus: "unsupported",
    }),
    tenantRegion: "swedencentral",
  });

  assert.equal(access.ok, false);
  assert.ok(access.reasonCodes.includes("missing_permission:semantic-model-reader"));
  assert.equal(region.ok, false);
  assert.ok(region.reasonCodes.includes("tenant_region_unsupported"));
  assert.ok(region.reasonCodes.includes("cross_region_semantic_model"));
  assert.ok(region.reasonCodes.includes("fabric_iq_region_unavailable"));
});

test("fabric iq readiness summarizes registration, agent, query, access, and region checks", () => {
  const query = validateNl2OntologyQuery({
    registration: createRegistration(),
    ontologyAgent: createOntologyAgent(),
    dataAgent: createDataAgent(),
    queryText: "Show revenue by region",
    mapping: {
      intent: "sales_analysis",
      entities: ["region"],
      measures: ["revenue"],
      filters: ["current-quarter"],
      targetSemanticModelId: "model-1",
      confidence: 0.91,
    },
  });
  const access = validateSemanticModelAccess({
    registration: createRegistration(),
    dataAgent: buildDataAgentContract(createDataAgent()),
    principal: { principalId: "principal-1", principalType: "servicePrincipal" },
  });
  const region = validateFabricIqRegionAvailability({
    registration: createRegistration(),
    tenantRegion: "northeurope",
  });
  const summary = summarizeFabricIqReadiness({
    registration: createRegistration(),
    ontologyAgent: createOntologyAgent(),
    dataAgent: createDataAgent(),
    queryValidation: query,
    accessValidation: access,
    regionValidation: region,
  });

  assert.equal(summary.checks.toolRegistered.status, "ready");
  assert.equal(summary.checks.nl2OntologyReady.status, "ready");
  assert.equal(summary.checks.semanticModelAccessReady.status, "ready");
  assert.equal(summary.checks.regionAlignmentReady.status, "ready");
  assert.equal(summary.failedChecks.length, 0);
});
