import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSmokeFixtures,
  buildTenantHandlerMap,
  runTenantApiSmoke,
} from '../../src/observe/api/tenant-api-smoke-fixture-runner.mjs';

describe('buildSmokeFixtures', () => {
  it('builds deterministic fixture object', () => {
    const fixtures = buildSmokeFixtures('2026-01-01T00:00:00.000Z');
    assert.equal(fixtures.records.length, 1);
    assert.equal(fixtures.records[0].tenantId, 'tenant-a');
    assert.ok(fixtures.grantedPermissions.includes('User.Read.All'));
  });
});

describe('buildTenantHandlerMap', () => {
  it('contains handlers for all tenant API routes', () => {
    const handlers = buildTenantHandlerMap();
    assert.equal(typeof handlers['GET:/api/v1/tenants'], 'function');
    assert.equal(typeof handlers['GET:/api/v1/tenants/:tenantId'], 'function');
    assert.equal(typeof handlers['PUT:/api/v1/tenants/:tenantId'], 'function');
    assert.equal(typeof handlers['GET:/api/v1/tenants/:tenantId/readiness'], 'function');
  });
});

describe('runTenantApiSmoke', () => {
  it('runs all four smoke scenarios successfully', () => {
    const fixtures = buildSmokeFixtures('2026-01-01T00:00:00.000Z');
    const results = runTenantApiSmoke(fixtures);
    assert.equal(results.list.status, 'success');
    assert.equal(results.get.status, 'success');
    assert.equal(results.upsert.status, 'success');
    assert.equal(results.readiness.status, 'success');
    assert.equal(results.allPassed, true);
  });

  it('fails smoke pass flag when permissions are missing', () => {
    const fixtures = buildSmokeFixtures('2026-01-01T00:00:00.000Z');
    fixtures.grantedPermissions = [];
    const results = runTenantApiSmoke(fixtures);
    assert.equal(results.allPassed, false);
    assert.equal(results.list.status, 'error');
  });
});
