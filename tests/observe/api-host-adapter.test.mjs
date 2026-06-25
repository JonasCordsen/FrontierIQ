import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  matchRoutePath,
  resolveRoute,
  buildHandlerKey,
  dispatchApiRequest,
} from '../../src/observe/api/api-host-adapter.mjs';

const routes = [
  { method: 'GET', path: '/api/v1/tenants', pillar: 'GOVERN' },
  { method: 'GET', path: '/api/v1/tenants/:tenantId', pillar: 'GOVERN' },
];

describe('matchRoutePath', () => {
  it('matches static route paths', () => {
    const result = matchRoutePath('/api/v1/tenants', '/api/v1/tenants');
    assert.equal(result.matched, true);
    assert.deepEqual(result.params, {});
  });

  it('extracts path params from dynamic routes', () => {
    const result = matchRoutePath('/api/v1/tenants/:tenantId', '/api/v1/tenants/t1');
    assert.equal(result.matched, true);
    assert.deepEqual(result.params, { tenantId: 't1' });
  });

  it('does not match when path length differs', () => {
    const result = matchRoutePath('/api/v1/tenants/:tenantId', '/api/v1/tenants');
    assert.equal(result.matched, false);
  });
});

describe('resolveRoute', () => {
  it('resolves route and params for exact request', () => {
    const result = resolveRoute(routes, 'GET', '/api/v1/tenants/t2');
    assert.equal(result.route.path, '/api/v1/tenants/:tenantId');
    assert.equal(result.params.tenantId, 't2');
  });

  it('returns null when route is not found', () => {
    const result = resolveRoute(routes, 'POST', '/api/v1/tenants');
    assert.equal(result.route, null);
  });
});

describe('buildHandlerKey', () => {
  it('returns METHOD:path key', () => {
    assert.equal(buildHandlerKey('GET', '/x'), 'GET:/x');
  });
});

describe('dispatchApiRequest', () => {
  const generatedAt = '2026-01-01T00:00:00.000Z';

  it('dispatches to matching handler', () => {
    const handlers = {
      'GET:/api/v1/tenants/:tenantId': ({ params }) => ({
        status: 'success',
        data: { id: params.tenantId },
      }),
    };
    const response = dispatchApiRequest({
      routes,
      handlers,
      generatedAt,
      request: {
        method: 'GET',
        path: '/api/v1/tenants/t5',
        userContext: { tenantId: 'tenant-a' },
      },
    });
    assert.equal(response.status, 'success');
    assert.equal(response.data.id, 't5');
  });

  it('returns route_not_found error when no route matches', () => {
    const response = dispatchApiRequest({
      routes,
      handlers: {},
      generatedAt,
      request: {
        method: 'DELETE',
        path: '/api/v1/tenants/t5',
        userContext: { tenantId: 'tenant-a' },
      },
    });
    assert.equal(response.status, 'error');
    assert.equal(response.errors[0].code, 'route_not_found');
  });

  it('returns handler_not_registered error when route exists but no handler', () => {
    const response = dispatchApiRequest({
      routes,
      handlers: {},
      generatedAt,
      request: {
        method: 'GET',
        path: '/api/v1/tenants',
        userContext: { tenantId: 'tenant-a' },
      },
    });
    assert.equal(response.status, 'error');
    assert.equal(response.errors[0].code, 'handler_not_registered');
  });
});
