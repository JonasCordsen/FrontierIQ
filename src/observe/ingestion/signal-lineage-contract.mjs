/**
 * Signal lineage contract.
 * Pillar: OBSERVE
 *
 * Deterministic source-to-action lineage graph and evidence.
 */

/**
 * Build lineage graph from signals and actions.
 * @param {{ signalId:string, source:string, tenantId:string, signalType:string }[]} signals
 * @param {{ actionId:string, tenantId:string, linkedSignalIds:string[] }[]} actions
 * @returns {object}
 */
export function buildSignalLineageGraph(signals, actions) {
  const signalNodes = (Array.isArray(signals) ? signals : []).map((signal) => ({
    id: signal.signalId,
    kind: "signal",
    source: signal.source,
    tenantId: signal.tenantId,
    signalType: signal.signalType,
  }));

  const actionNodes = (Array.isArray(actions) ? actions : []).map((action) => ({
    id: action.actionId,
    kind: "action",
    tenantId: action.tenantId,
  }));

  const signalIds = new Set(signalNodes.map((node) => node.id));
  const edges = [];
  const unresolvedLinks = [];
  for (const action of Array.isArray(actions) ? actions : []) {
    for (const signalId of action.linkedSignalIds ?? []) {
      if (signalIds.has(signalId)) {
        edges.push({ from: signalId, to: action.actionId, relation: "informs" });
      } else {
        unresolvedLinks.push({ actionId: action.actionId, signalId });
      }
    }
  }

  return {
    nodes: [...signalNodes, ...actionNodes],
    edges,
    unresolvedLinks,
  };
}

/**
 * Summarize lineage graph.
 * @param {ReturnType<typeof buildSignalLineageGraph>} graph
 * @returns {object}
 */
export function summarizeSignalLineage(graph) {
  const nodes = Array.isArray(graph?.nodes) ? graph.nodes : [];
  const edges = Array.isArray(graph?.edges) ? graph.edges : [];
  const unresolved = Array.isArray(graph?.unresolvedLinks) ? graph.unresolvedLinks : [];
  return {
    nodeCount: nodes.length,
    edgeCount: edges.length,
    signalCount: nodes.filter((node) => node.kind === "signal").length,
    actionCount: nodes.filter((node) => node.kind === "action").length,
    unresolvedLinks: unresolved.length,
    status: unresolved.length === 0 ? "ready" : "blocked",
  };
}

/**
 * Build lineage evidence envelope.
 * @param {ReturnType<typeof buildSignalLineageGraph>} graph
 * @param {string} generatedAt
 * @returns {object}
 */
export function buildSignalLineageEvidence(graph, generatedAt) {
  return {
    artifactType: "signal-lineage",
    generatedAt: generatedAt ?? null,
    summary: summarizeSignalLineage(graph),
    graph,
  };
}

