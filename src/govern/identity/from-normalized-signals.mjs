import { buildIdentityPermissionGraph } from "./identity-permission-graph.mjs";

/**
 * Converts normalized signals into identity-permission bindings.
 * Signals that do not include identity/permission dimensions are skipped.
 *
 * @param {import("../../observe/foundation/normalized-signal.mjs").NormalizedSignal[]} signals
 */
export function buildIdentityGraphFromSignals(signals) {
  const bindings = signals
    .map((signal) => toBinding(signal))
    .filter((binding) => binding !== null);

  return buildIdentityPermissionGraph(bindings);
}

/**
 * @param {import("../../observe/foundation/normalized-signal.mjs").NormalizedSignal} signal
 */
function toBinding(signal) {
  const principalId = getString(signal.dimensions.principalId);
  const principalType = getString(signal.dimensions.principalType);
  const permissionName = getString(signal.dimensions.permissionName);
  const permissionKind = getString(signal.dimensions.permissionKind);
  const resourceType = getString(signal.dimensions.resourceType);

  if (!principalId || !principalType || !permissionName || !permissionKind || !resourceType) {
    return null;
  }

  return {
    tenantId: signal.tenantId,
    solutionId: signal.solutionId,
    principalId,
    principalType,
    principalDisplayName: getString(signal.dimensions.principalDisplayName),
    permissionName,
    permissionKind,
    resourceId: signal.resourceId,
    resourceType,
    source: signal.source,
    assignedAt: signal.timestamp,
    metadata: { signalType: signal.signalType, confidence: signal.confidence },
  };
}

/**
 * @param {unknown} value
 * @returns {string|undefined}
 */
function getString(value) {
  return typeof value === "string" && value ? value : undefined;
}

