/**
 * Tenant repository persistence adapter contract.
 * Pillar: GOVERN
 *
 * Deterministic serialization and deserialization contracts for repository
 * snapshots used by local/dev flows.
 */

import { initializeTenantRepository } from './inmemory-tenant-repository.mjs';
import { validateTenantRecord } from './tenant-registry.mjs';

/**
 * Serialize repository to snapshot JSON.
 * @param {{ records: object[] }} repository
 * @param {string} generatedAt
 * @returns {{ ok:boolean, snapshot?:string, reason?:string }}
 */
export function serializeRepositorySnapshot(repository, generatedAt) {
  if (!Array.isArray(repository?.records)) {
    return { ok: false, reason: 'invalid_repository' };
  }
  const invalidCount = repository.records.filter(record => !validateTenantRecord(record).valid).length;
  if (invalidCount > 0) return { ok: false, reason: 'invalid_records' };

  const payload = {
    schemaVersion: '1.0',
    generatedAt: generatedAt ?? null,
    recordCount: repository.records.length,
    records: repository.records,
  };
  return { ok: true, snapshot: JSON.stringify(payload, null, 2) };
}

/**
 * Deserialize repository snapshot JSON.
 * @param {string} snapshot
 * @returns {{ ok:boolean, repository?:{records:object[]}, metadata?:object, reason?:string }}
 */
export function deserializeRepositorySnapshot(snapshot) {
  if (typeof snapshot !== 'string' || snapshot.length === 0) {
    return { ok: false, reason: 'snapshot_missing' };
  }

  let parsed;
  try {
    parsed = JSON.parse(snapshot);
  } catch {
    return { ok: false, reason: 'snapshot_invalid_json' };
  }

  const records = Array.isArray(parsed.records) ? parsed.records : [];
  const invalidCount = records.filter(record => !validateTenantRecord(record).valid).length;
  if (invalidCount > 0) return { ok: false, reason: 'invalid_records' };

  return {
    ok: true,
    repository: initializeTenantRepository(records),
    metadata: {
      schemaVersion: parsed.schemaVersion ?? 'unknown',
      generatedAt: parsed.generatedAt ?? null,
      recordCount: records.length,
    },
  };
}

/**
 * Build file artifact descriptor for snapshot publication.
 * @param {{ records: object[] }} repository
 * @param {string} generatedAt
 * @returns {{ ok:boolean, artifact?:object, reason?:string }}
 */
export function buildRepositorySnapshotArtifact(repository, generatedAt) {
  const serialized = serializeRepositorySnapshot(repository, generatedAt);
  if (!serialized.ok) return serialized;
  return {
    ok: true,
    artifact: {
      fileName: 'tenant-repository-snapshot.json',
      mediaType: 'application/json',
      content: serialized.snapshot,
      generatedAt: generatedAt ?? null,
    },
  };
}
