import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  initializeTenantRepository,
  listTenants,
  getTenantById,
  upsertTenantRecord,
  transitionTenant,
  summarizeRepository,
} from '../../src/govern/tenant/inmemory-tenant-repository.mjs';
import { buildTenantRecord } from '../../src/govern/tenant/tenant-registry.mjs';

const TS = '2026-01-01T00:00:00.000Z';

function tenant(id, state = 'onboarding') {
  return buildTenantRecord({
    tenantId: id,
    displayName: `Tenant ${id}`,
    region: 'westeurope',
    state,
    createdAt: TS,
    updatedAt: TS,
  });
}

describe('initializeTenantRepository', () => {
  it('creates repository with copied records', () => {
    const original = [tenant('t1')];
    const repo = initializeTenantRepository(original);
    assert.equal(repo.records.length, 1);
    assert.notEqual(repo.records, original);
  });
});

describe('listTenants and getTenantById', () => {
  const repo = initializeTenantRepository([tenant('t1'), tenant('t2')]);

  it('lists repository records', () => {
    const listed = listTenants(repo);
    assert.equal(listed.length, 2);
  });

  it('gets tenant by id', () => {
    const record = getTenantById(repo, 't2');
    assert.equal(record.tenantId, 't2');
  });

  it('returns null for unknown tenant', () => {
    assert.equal(getTenantById(repo, 'none'), null);
  });
});

describe('upsertTenantRecord', () => {
  it('inserts a new tenant', () => {
    const repo = initializeTenantRepository([]);
    const result = upsertTenantRecord(repo, tenant('t3', 'active'));
    assert.equal(result.ok, true);
    assert.equal(result.repository.records.length, 1);
  });

  it('updates existing tenant', () => {
    const repo = initializeTenantRepository([tenant('t1', 'onboarding')]);
    const result = upsertTenantRecord(
      repo,
      tenant('t1', 'active')
    );
    assert.equal(result.ok, true);
    assert.equal(result.repository.records.length, 1);
    assert.equal(result.repository.records[0].state, 'active');
  });

  it('rejects invalid payload', () => {
    const repo = initializeTenantRepository([]);
    const result = upsertTenantRecord(repo, { tenantId: 'x' });
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'invalid_record');
  });
});

describe('transitionTenant', () => {
  it('transitions known tenant to active', () => {
    const repo = initializeTenantRepository([tenant('t1', 'onboarding')]);
    const result = transitionTenant(repo, 't1', 'active', TS);
    assert.equal(result.ok, true);
    assert.equal(result.record.state, 'active');
  });

  it('returns tenant_not_found for missing tenant', () => {
    const repo = initializeTenantRepository([]);
    const result = transitionTenant(repo, 'none', 'active', TS);
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'tenant_not_found');
  });

  it('blocks invalid transition', () => {
    const repo = initializeTenantRepository([tenant('t1', 'active')]);
    const result = transitionTenant(repo, 't1', 'draft', TS);
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'invalid_transition');
  });
});

describe('summarizeRepository', () => {
  it('returns state summary', () => {
    const repo = initializeTenantRepository([tenant('t1', 'active'), tenant('t2', 'onboarding')]);
    const summary = summarizeRepository(repo);
    assert.equal(summary.total, 2);
    assert.equal(summary.byState.active, 1);
  });
});
