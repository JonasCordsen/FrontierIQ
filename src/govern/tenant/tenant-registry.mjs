/**
 * Tenant registry contract for FrontierIQ.
 * Pillar: GOVERN
 *
 * Pure/deterministic helpers to model tenant records and lifecycle transitions.
 */

export const TENANT_STATES = Object.freeze([
  'draft',
  'onboarding',
  'active',
  'suspended',
  'offboarded',
]);

export const DEFAULT_CAPABILITIES = Object.freeze({
  observe: true,
  govern: true,
  secure: true,
  optimize: true,
});

const TRANSITIONS = Object.freeze({
  draft: ['onboarding'],
  onboarding: ['active', 'suspended'],
  active: ['suspended', 'offboarded'],
  suspended: ['active', 'offboarded'],
  offboarded: [],
});

/**
 * Validate a tenant record.
 * @param {object} record
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateTenantRecord(record) {
  const errors = [];
  if (!record || typeof record !== 'object') {
    return { valid: false, errors: ['record_missing'] };
  }
  if (!record.tenantId || typeof record.tenantId !== 'string') {
    errors.push('tenant_id_missing');
  }
  if (!record.displayName || typeof record.displayName !== 'string') {
    errors.push('display_name_missing');
  }
  if (!record.region || typeof record.region !== 'string') {
    errors.push('region_missing');
  }
  if (!TENANT_STATES.includes(record.state)) {
    errors.push('state_invalid');
  }
  if (!record.createdAt || typeof record.createdAt !== 'string') {
    errors.push('created_at_missing');
  }
  if (!record.updatedAt || typeof record.updatedAt !== 'string') {
    errors.push('updated_at_missing');
  }
  if (!record.capabilities || typeof record.capabilities !== 'object') {
    errors.push('capabilities_missing');
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Build a normalized tenant record with defaults.
 * @param {{tenantId:string,displayName:string,region:string,state?:string,capabilities?:object,createdAt?:string,updatedAt?:string}} input
 * @returns {object}
 */
export function buildTenantRecord(input) {
  return {
    tenantId: input?.tenantId ?? null,
    displayName: input?.displayName ?? null,
    region: input?.region ?? null,
    state: input?.state ?? 'draft',
    capabilities: { ...DEFAULT_CAPABILITIES, ...(input?.capabilities ?? {}) },
    createdAt: input?.createdAt ?? null,
    updatedAt: input?.updatedAt ?? null,
  };
}

/**
 * Transition a tenant record to the next state.
 * @param {object} record
 * @param {'draft'|'onboarding'|'active'|'suspended'|'offboarded'} nextState
 * @param {string} updatedAt
 * @returns {{ ok: boolean, record?: object, reason?: string }}
 */
export function transitionTenantState(record, nextState, updatedAt) {
  const validation = validateTenantRecord(record);
  if (!validation.valid) return { ok: false, reason: 'invalid_record' };
  if (!TENANT_STATES.includes(nextState)) return { ok: false, reason: 'invalid_next_state' };

  const allowed = TRANSITIONS[record.state] ?? [];
  if (!allowed.includes(nextState)) {
    return { ok: false, reason: 'invalid_transition' };
  }
  return {
    ok: true,
    record: { ...record, state: nextState, updatedAt: updatedAt ?? record.updatedAt },
  };
}

/**
 * Build a registry summary grouped by lifecycle state.
 * @param {object[]} records
 * @returns {{ total:number, byState:Record<string,number>, activeTenantIds:string[] }}
 */
export function buildTenantRegistrySummary(records) {
  if (!Array.isArray(records)) return { total: 0, byState: {}, activeTenantIds: [] };
  const byState = Object.fromEntries(TENANT_STATES.map(s => [s, 0]));
  for (const record of records) {
    if (TENANT_STATES.includes(record?.state)) byState[record.state] += 1;
  }
  return {
    total: records.length,
    byState,
    activeTenantIds: records.filter(r => r?.state === 'active').map(r => r.tenantId),
  };
}
