/**
 * In-memory tenant repository contract.
 * Pillar: GOVERN
 *
 * Deterministic immutable repository helpers for local/dev execution flows.
 */

import {
  buildTenantRecord,
  validateTenantRecord,
  transitionTenantState,
  buildTenantRegistrySummary,
} from './tenant-registry.mjs';

/**
 * Initialize repository state.
 * @param {object[]} records
 * @returns {{ records: object[] }}
 */
export function initializeTenantRepository(records = []) {
  return {
    records: Array.isArray(records) ? [...records] : [],
  };
}

/**
 * List all tenant records.
 * @param {{ records: object[] }} repository
 * @returns {object[]}
 */
export function listTenants(repository) {
  return Array.isArray(repository?.records) ? [...repository.records] : [];
}

/**
 * Get tenant by id.
 * @param {{ records: object[] }} repository
 * @param {string} tenantId
 * @returns {object|null}
 */
export function getTenantById(repository, tenantId) {
  if (!tenantId || !Array.isArray(repository?.records)) return null;
  return repository.records.find(record => record?.tenantId === tenantId) ?? null;
}

/**
 * Upsert tenant record and return next repository state.
 * @param {{ records: object[] }} repository
 * @param {object} payload
 * @returns {{ ok: boolean, repository?: {records:object[]}, record?: object, reason?: string, errors?: string[] }}
 */
export function upsertTenantRecord(repository, payload) {
  const candidate = buildTenantRecord(payload);
  const validation = validateTenantRecord(candidate);
  if (!validation.valid) {
    return { ok: false, reason: 'invalid_record', errors: validation.errors };
  }

  const records = listTenants(repository);
  const existingIndex = records.findIndex(record => record.tenantId === candidate.tenantId);
  if (existingIndex >= 0) {
    records[existingIndex] = candidate;
  } else {
    records.push(candidate);
  }
  return { ok: true, repository: { records }, record: candidate };
}

/**
 * Transition tenant state and return next repository state.
 * @param {{ records: object[] }} repository
 * @param {string} tenantId
 * @param {string} nextState
 * @param {string} updatedAt
 * @returns {{ ok: boolean, repository?: {records:object[]}, record?: object, reason?: string }}
 */
export function transitionTenant(repository, tenantId, nextState, updatedAt) {
  const current = getTenantById(repository, tenantId);
  if (!current) return { ok: false, reason: 'tenant_not_found' };

  const transition = transitionTenantState(current, nextState, updatedAt);
  if (!transition.ok) return transition;

  const records = listTenants(repository).map(record =>
    record.tenantId === tenantId ? transition.record : record
  );
  return { ok: true, repository: { records }, record: transition.record };
}

/**
 * Build repository health summary.
 * @param {{ records: object[] }} repository
 * @returns {{ total:number, byState:Record<string,number>, activeTenantIds:string[] }}
 */
export function summarizeRepository(repository) {
  return buildTenantRegistrySummary(listTenants(repository));
}
