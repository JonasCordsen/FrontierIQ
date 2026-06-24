/**
 * Multi-tenant orchestrator — deterministic contracts for scheduling and
 * sequencing Graph API calls across multiple tenants.
 *
 * No HTTP is performed here. All functions produce deterministic execution
 * plans or summarise results supplied by the caller's execution layer.
 *
 * Pillar: OBSERVE (primary) / GOVERN
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PRIORITY_ORDER = Object.freeze(['urgent', 'standard', 'low']);

const DEFAULT_RATE_LIMIT_POLICY = Object.freeze({
  maxConcurrent: 5,
  tenantDelayMs: 200,
  maxRetries: 3,
  retryBackoffMs: 1000,
});

const ESTIMATED_COST = Object.freeze({
  usageDetail: 2,
  userCountSummary: 1,
  auditLog: 3,
  default: 1,
});

// ---------------------------------------------------------------------------
// Priority classification
// ---------------------------------------------------------------------------

/**
 * Classify a tenant's execution priority.
 *
 * @param {{ tier?: string, isNew?: boolean, hasOpenIncident?: boolean }} tenantMeta
 * @returns {'urgent' | 'standard' | 'low'}
 */
export function classifyTenantPriority(tenantMeta) {
  if (tenantMeta?.hasOpenIncident) return 'urgent';
  if (tenantMeta?.isNew) return 'urgent';
  const tier = tenantMeta?.tier ?? 'standard';
  if (tier === 'enterprise') return 'standard';
  if (tier === 'trial') return 'low';
  return 'standard';
}

// ---------------------------------------------------------------------------
// Queue builder
// ---------------------------------------------------------------------------

/**
 * @typedef {object} TenantEntry
 * @property {string}   tenantId
 * @property {boolean}  hasCredential
 * @property {string[]} requestTypes   - e.g. ['usageDetail', 'auditLog']
 * @property {object}   [meta]         - passed to classifyTenantPriority
 */

/**
 * Build an ordered execution queue from a list of tenant entries.
 * Tenants without credentials are excluded with a 'no_credential' skip reason.
 *
 * @param {TenantEntry[]} tenants
 * @returns {{ ok: true, queue: object[], skipped: object[] } | { ok: false, code: string, errors: string[] }}
 */
export function buildTenantQueue(tenants) {
  if (!Array.isArray(tenants)) {
    return { ok: false, code: 'invalid_input', errors: ['tenants must be an array'] };
  }

  const queue = [];
  const skipped = [];

  for (const t of tenants) {
    if (!t.tenantId) {
      skipped.push({ tenantId: t.tenantId ?? null, reason: 'missing_tenant_id' });
      continue;
    }
    if (!t.hasCredential) {
      skipped.push({ tenantId: t.tenantId, reason: 'no_credential' });
      continue;
    }

    const priority = classifyTenantPriority(t.meta ?? {});
    const requestTypes = Array.isArray(t.requestTypes) && t.requestTypes.length > 0
      ? t.requestTypes
      : ['usageDetail'];

    const estimatedCost = requestTypes.reduce(
      (sum, rt) => sum + (ESTIMATED_COST[rt] ?? ESTIMATED_COST.default),
      0,
    );

    queue.push({ tenantId: t.tenantId, priority, requestTypes, estimatedCost });
  }

  queue.sort((a, b) => PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority));

  return { ok: true, queue, skipped };
}

// ---------------------------------------------------------------------------
// Rate-limit policy application
// ---------------------------------------------------------------------------

/**
 * Apply a rate-limit policy to an execution queue, producing a throttled plan.
 *
 * @param {object[]} queue   - from buildTenantQueue
 * @param {object}   [policy]
 * @returns {{ ok: true, plan: object[] } | { ok: false, code: string, errors: string[] }}
 */
export function applyRateLimitPolicy(queue, policy = {}) {
  if (!Array.isArray(queue)) {
    return { ok: false, code: 'invalid_input', errors: ['queue must be an array'] };
  }

  const p = { ...DEFAULT_RATE_LIMIT_POLICY, ...policy };

  let cumDelayMs = 0;
  const plan = queue.map((entry, i) => {
    const slot = i % p.maxConcurrent;
    const delayMs = slot === 0 && i > 0 ? cumDelayMs + p.tenantDelayMs : cumDelayMs;
    if (slot === 0 && i > 0) cumDelayMs += p.tenantDelayMs;

    return {
      ...entry,
      slotIndex: slot,
      scheduledDelayMs: delayMs,
      retryBudget: p.maxRetries,
      retryBackoffMs: p.retryBackoffMs,
    };
  });

  return { ok: true, plan };
}

// ---------------------------------------------------------------------------
// Orchestration summary
// ---------------------------------------------------------------------------

/**
 * @typedef {object} TenantResult
 * @property {string}   tenantId
 * @property {'ok' | 'error' | 'skipped'} status
 * @property {string}   [errorCode]
 * @property {number}   [durationMs]
 */

/**
 * Build an orchestration run summary from per-tenant results.
 *
 * @param {TenantResult[]} results
 * @returns {{ ok: true, summary: object } | { ok: false, code: string, errors: string[] }}
 */
export function buildOrchestrationSummary(results) {
  if (!Array.isArray(results)) {
    return { ok: false, code: 'invalid_input', errors: ['results must be an array'] };
  }

  const counts = { ok: 0, error: 0, skipped: 0 };
  const errorTenants = [];

  for (const r of results) {
    const s = r.status ?? 'error';
    counts[s] = (counts[s] ?? 0) + 1;
    if (s === 'error') errorTenants.push({ tenantId: r.tenantId, code: r.errorCode ?? 'unknown' });
  }

  const total = results.length;
  const successRate = total > 0 ? Number((counts.ok / total).toFixed(4)) : 0;

  return {
    ok: true,
    summary: {
      total,
      okCount: counts.ok,
      errorCount: counts.error,
      skippedCount: counts.skipped,
      successRate,
      errorTenants,
      health: successRate >= 0.95 ? 'healthy' : successRate >= 0.8 ? 'degraded' : 'critical',
    },
  };
}

// ---------------------------------------------------------------------------
// Readiness
// ---------------------------------------------------------------------------

/**
 * @param {{ tenants: unknown[], hasOrchestrationPermission: boolean }} config
 * @returns {{ ready: boolean, blockers: string[] }}
 */
export function checkOrchestratorReadiness(config) {
  const blockers = [];
  if (!Array.isArray(config.tenants) || config.tenants.length === 0) {
    blockers.push('at least one tenant must be configured');
  }
  if (!config.hasOrchestrationPermission) {
    blockers.push('orchestration permission not granted');
  }
  return { ready: blockers.length === 0, blockers };
}
