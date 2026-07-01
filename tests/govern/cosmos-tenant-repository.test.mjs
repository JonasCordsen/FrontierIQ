import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildTenantRecord } from '../../src/govern/tenant/tenant-registry.mjs';
import {
  validateCosmosRepositoryConfig,
  buildCosmosContainerLayout,
  mapTenantRecordToCosmosDocument,
  mapCosmosDocumentToTenantRecord,
  buildUpsertTenantOperation,
  buildListTenantDocumentsQuery,
  hydrateRepositoryFromCosmosDocuments,
  COSMOS_SCHEMA_VERSION,
} from '../../src/govern/tenant/cosmos-tenant-repository.mjs';

const TS = '2026-01-01T00:00:00.000Z';

function record(id, state = 'active') {
  return buildTenantRecord({
    tenantId: id,
    displayName: `Tenant ${id}`,
    region: 'westeurope',
    state,
    createdAt: TS,
    updatedAt: TS,
  });
}

const CONFIG = {
  endpoint: 'https://frontieriq.documents.azure.com:443/',
  databaseId: 'frontieriq-control-plane',
  containerId: 'tenant-registry',
  partitionKeyPath: '/tenantId',
};

describe('validateCosmosRepositoryConfig', () => {
  it('accepts valid config', () => {
    const result = validateCosmosRepositoryConfig(CONFIG);
    assert.equal(result.valid, true);
  });

  it('rejects invalid partition key path', () => {
    const result = validateCosmosRepositoryConfig({ ...CONFIG, partitionKeyPath: '/region' });
    assert.equal(result.valid, false);
    assert.deepEqual(result.errors, ['partition_key_path_invalid']);
  });
});

describe('buildCosmosContainerLayout', () => {
  it('returns recommended tenant-partitioned layout', () => {
    const result = buildCosmosContainerLayout('fiq');
    assert.equal(result.databaseId, 'fiq-control-plane');
    assert.equal(result.containers[0].partitionKeyPath, '/tenantId');
    assert.equal(result.containers.length, 5);
  });
});

describe('tenant record mapping', () => {
  it('maps a valid record to a Cosmos document', () => {
    const result = mapTenantRecordToCosmosDocument(record('t1'));
    assert.equal(result.ok, true);
    assert.equal(result.document.id, 'tenant:t1');
    assert.equal(result.document.schemaVersion, COSMOS_SCHEMA_VERSION);
  });

  it('round-trips a valid document back to a record', () => {
    const document = mapTenantRecordToCosmosDocument(record('t2')).document;
    const result = mapCosmosDocumentToTenantRecord(document);
    assert.equal(result.ok, true);
    assert.equal(result.record.tenantId, 't2');
  });
});

describe('buildUpsertTenantOperation', () => {
  it('builds a deterministic upsert descriptor', () => {
    const result = buildUpsertTenantOperation(CONFIG, record('t3'));
    assert.equal(result.ok, true);
    assert.equal(result.operation.kind, 'upsert');
    assert.equal(result.operation.partitionKey, 't3');
    assert.equal(result.operation.containerId, 'tenant-registry');
  });
});

describe('buildListTenantDocumentsQuery', () => {
  it('builds an all-tenants query', () => {
    const result = buildListTenantDocumentsQuery(CONFIG);
    assert.equal(result.ok, true);
    assert.equal(result.query.partitionKey, null);
    assert.match(result.query.querySpec.query, /WHERE c.type = @type/);
  });

  it('builds a tenant-scoped query', () => {
    const result = buildListTenantDocumentsQuery(CONFIG, { tenantId: 't9' });
    assert.equal(result.ok, true);
    assert.equal(result.query.partitionKey, 't9');
    assert.equal(result.query.querySpec.parameters[1].value, 't9');
  });
});

describe('hydrateRepositoryFromCosmosDocuments', () => {
  it('hydrates a repository from valid tenant documents', () => {
    const documents = [
      mapTenantRecordToCosmosDocument(record('t4')).document,
      mapTenantRecordToCosmosDocument(record('t5', 'onboarding')).document,
    ];
    const result = hydrateRepositoryFromCosmosDocuments(documents);
    assert.equal(result.ok, true);
    assert.equal(result.repository.records.length, 2);
  });

  it('fails closed for invalid documents', () => {
    const result = hydrateRepositoryFromCosmosDocuments([
      { id: 'tenant:bad', type: 'tenant-registry-record', record: { tenantId: 'bad' } },
    ]);
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'invalid_documents');
  });
});
