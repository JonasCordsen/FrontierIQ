import test from "node:test";
import assert from "node:assert/strict";

import {
  buildIdentityPermissionGraph,
  findRiskyPermissionEdges,
  listPrincipalPermissions,
} from "../../src/govern/identity/identity-permission-graph.mjs";
import { buildIdentityGraphFromSignals } from "../../src/govern/identity/from-normalized-signals.mjs";
import { SOLUTION_IDS } from "../../src/observe/foundation/solution-taxonomy.mjs";
import { isHighRiskPermission } from "../../src/secure/permissions/high-risk-rules.mjs";

const bindings = [
  {
    tenantId: "tenant-1",
    solutionId: SOLUTION_IDS.M365_COPILOT,
    principalId: "spn-01",
    principalType: "servicePrincipal",
    permissionName: "Directory.ReadWrite.All",
    permissionKind: "appRole",
    resourceId: "graph",
    resourceType: "api",
    source: "graph",
    assignedAt: "2026-06-24T09:00:00Z",
  },
  {
    tenantId: "tenant-1",
    solutionId: SOLUTION_IDS.FABRIC,
    principalId: "mi-01",
    principalType: "managedIdentity",
    permissionName: "Reader",
    permissionKind: "rbacRole",
    resourceId: "fabric-capacity-1",
    resourceType: "fabricCapacity",
    source: "fabric",
    assignedAt: "2026-06-24T09:10:00Z",
  },
];

test("buildIdentityPermissionGraph builds nodes and edges", () => {
  const result = buildIdentityPermissionGraph(bindings);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.graph.principals.size, 2);
    assert.equal(result.graph.permissions.size, 2);
    assert.equal(result.graph.resources.size, 2);
    assert.equal(result.graph.edges.length, 2);
  }
});

test("buildIdentityPermissionGraph rejects invalid entries", () => {
  const result = buildIdentityPermissionGraph([{ tenantId: "missing-fields" }]);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok(result.errors.length > 0);
  }
});

test("high risk matcher finds expected edges", () => {
  const result = buildIdentityPermissionGraph(bindings);
  assert.equal(result.ok, true);
  if (!result.ok) return;

  const risky = findRiskyPermissionEdges(result.graph, isHighRiskPermission);
  assert.equal(risky.length, 1);
});

test("listPrincipalPermissions can filter by principal type", () => {
  const result = buildIdentityPermissionGraph(bindings);
  assert.equal(result.ok, true);
  if (!result.ok) return;

  const servicePrincipalEdges = listPrincipalPermissions(result.graph, {
    principalType: "servicePrincipal",
  });
  assert.equal(servicePrincipalEdges.length, 1);
});

test("buildIdentityGraphFromSignals maps identity dimensions", () => {
  const signals = [
    {
      tenantId: "tenant-1",
      solutionId: SOLUTION_IDS.COPILOT_STUDIO,
      workload: "agent-runtime",
      resourceId: "agent-001",
      source: "copilot-studio",
      timestamp: "2026-06-24T10:00:00Z",
      signalType: "permission-grant",
      severity: "medium",
      confidence: 0.8,
      freshnessMinutes: 1,
      dimensions: {
        principalId: "spn-99",
        principalType: "servicePrincipal",
        permissionName: "Mail.Send",
        permissionKind: "delegatedScope",
        resourceType: "api",
      },
      evidence: {},
    },
  ];

  const result = buildIdentityGraphFromSignals(signals);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.graph.edges.length, 1);
  }
});

