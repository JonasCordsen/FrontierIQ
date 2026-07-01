import { isKnownSolution } from "../../observe/foundation/solution-taxonomy.mjs";

/**
 * @typedef {"user"|"servicePrincipal"|"managedIdentity"|"group"|"application"} PrincipalType
 * @typedef {"appRole"|"delegatedScope"|"rbacRole"|"custom"} PermissionKind
 *
 * @typedef {{
 *   tenantId: string;
 *   solutionId: string;
 *   principalId: string;
 *   principalType: PrincipalType;
 *   principalDisplayName?: string;
 *   permissionName: string;
 *   permissionKind: PermissionKind;
 *   resourceId: string;
 *   resourceType: string;
 *   source: string;
 *   assignedAt: string;
 *   metadata?: Record<string, string | number | boolean>;
 * }} IdentityPermissionBinding
 */

/**
 * @typedef {{
 *   principals: Map<string, {
 *     id: string;
 *     tenantId: string;
 *     principalType: PrincipalType;
 *     displayName?: string;
 *     solutionIds: Set<string>;
 *   }>;
 *   permissions: Map<string, {
 *     id: string;
 *     permissionName: string;
 *     permissionKind: PermissionKind;
 *     solutionIds: Set<string>;
 *   }>;
 *   resources: Map<string, {
 *     id: string;
 *     tenantId: string;
 *     resourceType: string;
 *   }>;
 *   edges: Array<{
 *     tenantId: string;
 *     principalKey: string;
 *     permissionKey: string;
 *     resourceKey: string;
 *     solutionId: string;
 *     source: string;
 *     assignedAt: string;
 *   }>;
 * }} IdentityPermissionGraph
 */

/**
 * @param {IdentityPermissionBinding[]} bindings
 * @returns {{ ok: true; graph: IdentityPermissionGraph } | { ok: false; errors: string[] }}
 */
export function buildIdentityPermissionGraph(bindings) {
  /** @type {string[]} */
  const errors = [];
  /** @type {IdentityPermissionGraph} */
  const graph = {
    principals: new Map(),
    permissions: new Map(),
    resources: new Map(),
    edges: [],
  };

  for (const [index, binding] of bindings.entries()) {
    const validation = validateBinding(binding);
    if (!validation.ok) {
      errors.push(`bindings[${index}]: ${validation.errors.join(", ")}`);
      continue;
    }

    const principalKey = `${binding.tenantId}:${binding.principalId}`;
    const permissionKey = `${binding.solutionId}:${binding.permissionKind}:${binding.permissionName}`;
    const resourceKey = `${binding.tenantId}:${binding.resourceId}`;

    if (!graph.principals.has(principalKey)) {
      graph.principals.set(principalKey, {
        id: binding.principalId,
        tenantId: binding.tenantId,
        principalType: binding.principalType,
        displayName: binding.principalDisplayName,
        solutionIds: new Set(),
      });
    }
    graph.principals.get(principalKey)?.solutionIds.add(binding.solutionId);

    if (!graph.permissions.has(permissionKey)) {
      graph.permissions.set(permissionKey, {
        id: permissionKey,
        permissionName: binding.permissionName,
        permissionKind: binding.permissionKind,
        solutionIds: new Set(),
      });
    }
    graph.permissions.get(permissionKey)?.solutionIds.add(binding.solutionId);

    if (!graph.resources.has(resourceKey)) {
      graph.resources.set(resourceKey, {
        id: binding.resourceId,
        tenantId: binding.tenantId,
        resourceType: binding.resourceType,
      });
    }

    graph.edges.push({
      tenantId: binding.tenantId,
      principalKey,
      permissionKey,
      resourceKey,
      solutionId: binding.solutionId,
      source: binding.source,
      assignedAt: binding.assignedAt,
    });
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, graph };
}

/**
 * @param {IdentityPermissionGraph} graph
 * @param {{ principalType?: PrincipalType; solutionId?: string; tenantId?: string }} filters
 */
export function listPrincipalPermissions(graph, filters = {}) {
  return graph.edges.filter((edge) => {
    const principal = graph.principals.get(edge.principalKey);
    if (!principal) return false;
    if (filters.tenantId && edge.tenantId !== filters.tenantId) return false;
    if (filters.solutionId && edge.solutionId !== filters.solutionId) return false;
    if (filters.principalType && principal.principalType !== filters.principalType) return false;
    return true;
  });
}

/**
 * @param {IdentityPermissionGraph} graph
 * @param {(permissionName: string, permissionKind: PermissionKind) => boolean} matcher
 */
export function findRiskyPermissionEdges(graph, matcher) {
  return graph.edges.filter((edge) => {
    const permission = graph.permissions.get(edge.permissionKey);
    if (!permission) return false;
    return matcher(permission.permissionName, permission.permissionKind);
  });
}

/**
 * @param {IdentityPermissionBinding} binding
 * @returns {{ ok: true } | { ok: false; errors: string[] }}
 */
function validateBinding(binding) {
  /** @type {string[]} */
  const errors = [];

  if (!binding || typeof binding !== "object") {
    return { ok: false, errors: ["binding must be an object"] };
  }

  const requiredStringFields = [
    "tenantId",
    "solutionId",
    "principalId",
    "permissionName",
    "resourceId",
    "resourceType",
    "source",
    "assignedAt",
  ];

  for (const field of requiredStringFields) {
    const value = /** @type {Record<string, unknown>} */ (binding)[field];
    if (typeof value !== "string" || !value) {
      errors.push(`${field} must be a non-empty string`);
    }
  }

  if (!isKnownSolution(binding.solutionId)) {
    errors.push(`unknown solutionId: ${binding.solutionId}`);
  }

  if (
    binding.principalType !== "user" &&
    binding.principalType !== "servicePrincipal" &&
    binding.principalType !== "managedIdentity" &&
    binding.principalType !== "group" &&
    binding.principalType !== "application"
  ) {
    errors.push("principalType is invalid");
  }

  if (
    binding.permissionKind !== "appRole" &&
    binding.permissionKind !== "delegatedScope" &&
    binding.permissionKind !== "rbacRole" &&
    binding.permissionKind !== "custom"
  ) {
    errors.push("permissionKind is invalid");
  }

  if (Number.isNaN(Date.parse(binding.assignedAt))) {
    errors.push("assignedAt must be ISO-8601 datetime");
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return { ok: true };
}

