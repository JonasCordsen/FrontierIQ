import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { initializeTenantRepository } from '../../src/govern/tenant/inmemory-tenant-repository.mjs';
import { buildTenantRecord } from '../../src/govern/tenant/tenant-registry.mjs';
import {
  serializeRepositorySnapshot,
  deserializeRepositorySnapshot,
  buildRepositorySnapshotArtifact,
} from '../../src/govern/tenant/tenant-repository-persistence-adapter.mjs';

const TS = '2026-01-01T00:00:00.000Z';

function record(id) {
  return buildTenantRecord({
    tenantId: id,
    displayName: `Tenant ${id}`,
    region: 'westeurope',
    state: 'active',
    createdAt: TS,
    updatedAt: TS,
  });
}

describe('serializeRepositorySnapshot', () => {
  it('serializes valid repository to snapshot json', () => {
    const repository = initializeTenantRepository([record('t1')]);
    const result = serializeRepositorySnapshot(repository, TS);
    assert.equal(result.ok, true);
    assert.ok(result.snapshot.includes('"schemaVersion": "1.0"'));
  });

  it('fails for invalid repository shape', () => {
    const result = serializeRepositorySnapshot({}, TS);
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'invalid_repository');
  });
});

describe('deserializeRepositorySnapshot', () => {
  it('deserializes valid snapshot', () => {
    const repository = initializeTenantRepository([record('t2')]);
    const snapshot = serializeRepositorySnapshot(repository, TS).snapshot;
    const result = deserializeRepositorySnapshot(snapshot);
    assert.equal(result.ok, true);
    assert.equal(result.repository.records.length, 1);
    assert.equal(result.metadata.recordCount, 1);
  });

  it('fails for invalid json', () => {
    const result = deserializeRepositorySnapshot('{');
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'snapshot_invalid_json');
  });
});

describe('buildRepositorySnapshotArtifact', () => {
  it('builds json artifact wrapper', () => {
    const repository = initializeTenantRepository([record('t3')]);
    const result = buildRepositorySnapshotArtifact(repository, TS);
    assert.equal(result.ok, true);
    assert.equal(result.artifact.fileName, 'tenant-repository-snapshot.json');
  });
});
