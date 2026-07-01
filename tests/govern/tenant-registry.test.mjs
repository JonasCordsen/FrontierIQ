import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  TENANT_STATES,
  DEFAULT_CAPABILITIES,
  validateTenantRecord,
  buildTenantRecord,
  transitionTenantState,
  buildTenantRegistrySummary,
} from '../../src/govern/tenant/tenant-registry.mjs';

const TS = '2026-01-01T00:00:00.000Z';

function validRecord() {
  return buildTenantRecord({
    tenantId: 'tenant-a',
    displayName: 'Tenant A',
    region: 'westeurope',
    state: 'onboarding',
    createdAt: TS,
    updatedAt: TS,
  });
}

describe('tenant-registry constants', () => {
  it('defines all lifecycle states', () => {
    assert.deepEqual(TENANT_STATES, ['draft', 'onboarding', 'active', 'suspended', 'offboarded']);
  });

  it('enables all capabilities by default', () => {
    assert.equal(DEFAULT_CAPABILITIES.observe, true);
    assert.equal(DEFAULT_CAPABILITIES.optimize, true);
  });
});

describe('validateTenantRecord', () => {
  it('accepts a valid record', () => {
    const result = validateTenantRecord(validRecord());
    assert.equal(result.valid, true);
    assert.deepEqual(result.errors, []);
  });

  it('rejects missing required fields', () => {
    const result = validateTenantRecord({});
    assert.equal(result.valid, false);
    assert.ok(result.errors.includes('tenant_id_missing'));
    assert.ok(result.errors.includes('state_invalid'));
  });
});

describe('buildTenantRecord', () => {
  it('applies default state and capabilities', () => {
    const record = buildTenantRecord({
      tenantId: 'tenant-b',
      displayName: 'Tenant B',
      region: 'northeurope',
      createdAt: TS,
      updatedAt: TS,
    });
    assert.equal(record.state, 'draft');
    assert.equal(record.capabilities.secure, true);
  });

  it('allows capability overrides', () => {
    const record = buildTenantRecord({
      tenantId: 'tenant-c',
      displayName: 'Tenant C',
      region: 'swedencentral',
      capabilities: { secure: false },
      createdAt: TS,
      updatedAt: TS,
    });
    assert.equal(record.capabilities.secure, false);
    assert.equal(record.capabilities.observe, true);
  });
});

describe('transitionTenantState', () => {
  it('allows valid onboarding -> active transition', () => {
    const result = transitionTenantState(validRecord(), 'active', TS);
    assert.equal(result.ok, true);
    assert.equal(result.record.state, 'active');
  });

  it('blocks invalid transition', () => {
    const record = { ...validRecord(), state: 'active' };
    const result = transitionTenantState(record, 'draft', TS);
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'invalid_transition');
  });

  it('blocks transition for invalid record', () => {
    const result = transitionTenantState({}, 'active', TS);
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'invalid_record');
  });
});

describe('buildTenantRegistrySummary', () => {
  it('groups totals by state and lists active tenants', () => {
    const records = [
      { ...validRecord(), tenantId: 't1', state: 'active' },
      { ...validRecord(), tenantId: 't2', state: 'onboarding' },
      { ...validRecord(), tenantId: 't3', state: 'active' },
    ];
    const summary = buildTenantRegistrySummary(records);
    assert.equal(summary.total, 3);
    assert.equal(summary.byState.active, 2);
    assert.deepEqual(summary.activeTenantIds, ['t1', 't3']);
  });

  it('returns empty summary for non-array input', () => {
    assert.deepEqual(buildTenantRegistrySummary(null), {
      total: 0,
      byState: {},
      activeTenantIds: [],
    });
  });
});
