/**
 * In-memory registry builder for agents and skills with governance metadata.
 */

/**
 * @param {{
 *   agentId: string;
 *   name: string;
 *   owner: string;
 *   solutionId: string;
 *   riskBand: "high"|"medium"|"low";
 *   lastAttestedAt: string;
 *   skills: Array<{ skillId: string; name: string; permissionScopes: string[]; status: "approved"|"pending"|"rejected" }>;
 * }[]} entries
 */
export function buildAgentSkillRegistry(entries) {
  /** @type {Record<string, any>} */
  const byAgent = {};

  for (const entry of entries) {
    const validation = validateRegistryEntry(entry);
    if (!validation.ok) {
      throw new Error(`Invalid registry entry ${entry.agentId}: ${validation.errors.join("; ")}`);
    }
    byAgent[entry.agentId] = {
      ...entry,
      skills: [...entry.skills],
    };
  }

  return { byAgent };
}

/**
 * @param {ReturnType<typeof buildAgentSkillRegistry>} registry
 * @param {{ owner?: string; riskBand?: "high"|"medium"|"low"; solutionId?: string }} filters
 */
export function queryRegistry(registry, filters = {}) {
  return Object.values(registry.byAgent).filter((entry) => {
    if (filters.owner && entry.owner !== filters.owner) return false;
    if (filters.riskBand && entry.riskBand !== filters.riskBand) return false;
    if (filters.solutionId && entry.solutionId !== filters.solutionId) return false;
    return true;
  });
}

/**
 * @param {Parameters<typeof buildAgentSkillRegistry>[0][number]} entry
 */
export function validateRegistryEntry(entry) {
  /** @type {string[]} */
  const errors = [];
  if (!entry.agentId) errors.push("agentId is required");
  if (!entry.name) errors.push("name is required");
  if (!entry.owner) errors.push("owner is required");
  if (!entry.solutionId) errors.push("solutionId is required");
  if (!["high", "medium", "low"].includes(entry.riskBand)) errors.push("riskBand is invalid");
  if (Number.isNaN(Date.parse(entry.lastAttestedAt))) errors.push("lastAttestedAt must be ISO datetime");
  if (!Array.isArray(entry.skills)) {
    errors.push("skills must be an array");
  } else {
    for (const skill of entry.skills) {
      if (!skill.skillId) errors.push("skillId is required");
      if (!skill.name) errors.push("skill name is required");
      if (!Array.isArray(skill.permissionScopes)) errors.push("skill permissionScopes must be an array");
      if (!["approved", "pending", "rejected"].includes(skill.status)) errors.push("skill status is invalid");
    }
  }
  if (errors.length > 0) return { ok: false, errors };
  return { ok: true };
}

/**
 * @param {{
 *   registry: ReturnType<typeof buildAgentSkillRegistry>;
 *   invocations: Array<{
 *     agentId: string;
 *     skillId?: string | null;
 *     tenantId: string;
 *     timestamp: string;
 *     status: "success"|"failure"|"throttled";
 *     count: number;
 *   }>;
 * }} input
 */
export function summarizeAgentInvocations(input) {
  const totals = {
    totalInvocations: 0,
    successInvocations: 0,
    failureInvocations: 0,
    throttledInvocations: 0,
    failureRate: 0,
    uniqueAgentsInvoked: 0,
  };

  /** @type {Record<string, { agentId: string; name: string; solutionId: string; totalInvocations: number; successInvocations: number; failureInvocations: number; throttledInvocations: number; failureRate: number }>} */
  const byAgent = {};
  /** @type {Record<string, { totalInvocations: number; successInvocations: number; failureInvocations: number; throttledInvocations: number; failureRate: number }>} */
  const bySolution = {};

  for (const invocation of input.invocations) {
    validateInvocationRecord(input.registry, invocation);
    const entry = input.registry.byAgent[invocation.agentId];
    totals.totalInvocations += invocation.count;
    if (invocation.status === "success") totals.successInvocations += invocation.count;
    if (invocation.status === "failure") totals.failureInvocations += invocation.count;
    if (invocation.status === "throttled") totals.throttledInvocations += invocation.count;

    if (!byAgent[invocation.agentId]) {
      byAgent[invocation.agentId] = {
        agentId: invocation.agentId,
        name: entry.name,
        solutionId: entry.solutionId,
        totalInvocations: 0,
        successInvocations: 0,
        failureInvocations: 0,
        throttledInvocations: 0,
        failureRate: 0,
      };
    }
    if (!bySolution[entry.solutionId]) {
      bySolution[entry.solutionId] = {
        totalInvocations: 0,
        successInvocations: 0,
        failureInvocations: 0,
        throttledInvocations: 0,
        failureRate: 0,
      };
    }

    accumulateInvocation(byAgent[invocation.agentId], invocation);
    accumulateInvocation(bySolution[entry.solutionId], invocation);
  }

  totals.uniqueAgentsInvoked = Object.keys(byAgent).length;
  totals.failureRate = failureRate(totals.failureInvocations, totals.totalInvocations);
  finalizeInvocationRates(byAgent);
  finalizeInvocationRates(bySolution);

  return { totals, byAgent, bySolution };
}

function validateInvocationRecord(registry, invocation) {
  if (!invocation.agentId || !registry.byAgent[invocation.agentId]) {
    throw new Error(`Unknown agentId: ${invocation.agentId}`);
  }
  if (invocation.skillId) {
    const skillExists = registry.byAgent[invocation.agentId].skills.some((skill) => skill.skillId === invocation.skillId);
    if (!skillExists) {
      throw new Error(`Unknown skillId ${invocation.skillId} for agent ${invocation.agentId}`);
    }
  }
  if (typeof invocation.tenantId !== "string" || !invocation.tenantId) {
    throw new Error("tenantId is required");
  }
  if (typeof invocation.timestamp !== "string" || Number.isNaN(Date.parse(invocation.timestamp))) {
    throw new Error("timestamp must be ISO datetime");
  }
  if (!["success", "failure", "throttled"].includes(invocation.status)) {
    throw new Error("status must be success|failure|throttled");
  }
  if (typeof invocation.count !== "number" || Number.isNaN(invocation.count) || invocation.count < 0) {
    throw new Error("count must be a non-negative number");
  }
}

function accumulateInvocation(target, invocation) {
  target.totalInvocations += invocation.count;
  if (invocation.status === "success") target.successInvocations += invocation.count;
  if (invocation.status === "failure") target.failureInvocations += invocation.count;
  if (invocation.status === "throttled") target.throttledInvocations += invocation.count;
}

function finalizeInvocationRates(bucket) {
  for (const value of Object.values(bucket)) {
    value.failureRate = failureRate(value.failureInvocations, value.totalInvocations);
  }
}

function failureRate(failures, total) {
  if (total === 0) return 0;
  return Number((failures / total).toFixed(4));
}
