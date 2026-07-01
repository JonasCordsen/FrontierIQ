import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  API_VERSION_PREFIX,
  buildRoute,
  buildAllRoutes,
  findRoute,
  routesByPillar,
  buildRouteIndex,
} from '../../src/optimize/delivery/api-route-builder.mjs';

describe('buildRoute', () => {
  it('builds a valid OBSERVE GET route', () => {
    const r = buildRoute({ pillar: 'OBSERVE', path: '/test', method: 'GET', description: 'test' });
    assert.equal(r.pillar, 'OBSERVE');
    assert.equal(r.method, 'GET');
    assert.equal(r.path, `${API_VERSION_PREFIX}/test`);
    assert.ok(Array.isArray(r.requiredPermissions));
    assert.ok(r.requiredPermissions.includes('Reports.Read.All'));
  });
  it('accepts custom requiredPermissions override', () => {
    const r = buildRoute({ pillar: 'OBSERVE', path: '/x', method: 'GET', requiredPermissions: ['Custom.Permission'] });
    assert.deepEqual(r.requiredPermissions, ['Custom.Permission']);
  });
  it('throws for unknown pillar', () => {
    assert.throws(() => buildRoute({ pillar: 'UNKNOWN', path: '/x', method: 'GET' }), /unknown_pillar/);
  });
  it('throws for invalid method', () => {
    assert.throws(() => buildRoute({ pillar: 'OBSERVE', path: '/x', method: 'CONNECT' }), /invalid_method/);
  });
  it('throws when path does not start with slash', () => {
    assert.throws(() => buildRoute({ pillar: 'OBSERVE', path: 'noslash', method: 'GET' }), /path_must_start_with_slash/);
  });
  it('includes queryParams and pathParams in definition', () => {
    const r = buildRoute({ pillar: 'GOVERN', path: '/y/:id', method: 'PUT', pathParams: ['id'], queryParams: ['q'] });
    assert.deepEqual(r.pathParams, ['id']);
    assert.deepEqual(r.queryParams, ['q']);
  });
  it('supports POST method', () => {
    const r = buildRoute({ pillar: 'SECURE', path: '/z', method: 'POST', description: 'd' });
    assert.equal(r.method, 'POST');
  });
});

describe('buildAllRoutes', () => {
  const routes = buildAllRoutes();
  it('returns an array of route objects', () => {
    assert.ok(Array.isArray(routes));
    assert.ok(routes.length >= 12);
  });
  it('all routes have required fields', () => {
    for (const r of routes) {
      assert.ok(r.pillar, `missing pillar on ${r.path}`);
      assert.ok(r.method, `missing method on ${r.path}`);
      assert.ok(r.path.startsWith(API_VERSION_PREFIX), `path missing prefix: ${r.path}`);
      assert.ok(Array.isArray(r.requiredPermissions));
    }
  });
  it('covers all four pillars', () => {
    const pillars = new Set(routes.map(r => r.pillar));
    assert.ok(pillars.has('OBSERVE'));
    assert.ok(pillars.has('GOVERN'));
    assert.ok(pillars.has('SECURE'));
    assert.ok(pillars.has('OPTIMIZE'));
  });
  it('includes Power BI and Fabric export routes', () => {
    assert.ok(routes.some(r => r.path.includes('powerbi')));
    assert.ok(routes.some(r => r.path.includes('fabric')));
  });
});

describe('findRoute', () => {
  const routes = buildAllRoutes();
  it('finds an existing route by method and full path', () => {
    const r = findRoute(routes, 'GET', `${API_VERSION_PREFIX}/observe/usage`);
    assert.ok(r);
    assert.equal(r.pillar, 'OBSERVE');
  });
  it('returns null for unknown route', () => {
    assert.equal(findRoute(routes, 'GET', '/api/v1/nonexistent'), null);
  });
  it('returns null for wrong method', () => {
    assert.equal(findRoute(routes, 'DELETE', `${API_VERSION_PREFIX}/observe/usage`), null);
  });
  it('returns null when routes is not an array', () => {
    assert.equal(findRoute(null, 'GET', '/anything'), null);
  });
});

describe('routesByPillar', () => {
  const routes = buildAllRoutes();
  it('returns only SECURE routes', () => {
    const sec = routesByPillar(routes, 'SECURE');
    assert.ok(sec.length >= 2);
    assert.ok(sec.every(r => r.pillar === 'SECURE'));
  });
  it('returns empty array for unknown pillar', () => {
    assert.deepEqual(routesByPillar(routes, 'UNKNOWN'), []);
  });
  it('returns empty array when routes is null', () => {
    assert.deepEqual(routesByPillar(null, 'OBSERVE'), []);
  });
});

describe('buildRouteIndex', () => {
  const routes = buildAllRoutes();
  it('index keys are METHOD:path', () => {
    const idx = buildRouteIndex(routes);
    const key = `GET:${API_VERSION_PREFIX}/observe/usage`;
    assert.ok(idx[key]);
    assert.equal(idx[key].pillar, 'OBSERVE');
  });
  it('index has same count as routes array', () => {
    const idx = buildRouteIndex(routes);
    assert.equal(Object.keys(idx).length, routes.length);
  });
  it('returns empty object for null input', () => {
    assert.deepEqual(buildRouteIndex(null), {});
  });
});
