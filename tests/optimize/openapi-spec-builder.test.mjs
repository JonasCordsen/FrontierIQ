import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildAllRoutes } from '../../src/optimize/delivery/api-route-builder.mjs';
import {
  toOpenApiPath,
  buildPathParameters,
  buildQueryParameters,
  buildOperation,
  buildOpenApiSpec,
} from '../../src/optimize/delivery/openapi-spec-builder.mjs';

describe('toOpenApiPath', () => {
  it('converts :param segments to {param}', () => {
    assert.equal(toOpenApiPath('/api/v1/tenants/:tenantId'), '/api/v1/tenants/{tenantId}');
  });

  it('returns empty string for non-string input', () => {
    assert.equal(toOpenApiPath(null), '');
  });
});

describe('buildPathParameters', () => {
  it('creates OpenAPI path parameter objects', () => {
    const params = buildPathParameters(['tenantId']);
    assert.equal(params.length, 1);
    assert.equal(params[0].in, 'path');
    assert.equal(params[0].required, true);
  });
});

describe('buildQueryParameters', () => {
  it('creates OpenAPI query parameter objects', () => {
    const params = buildQueryParameters(['period', 'severity']);
    assert.equal(params.length, 2);
    assert.equal(params[0].in, 'query');
    assert.equal(params[0].required, false);
  });
});

describe('buildOperation', () => {
  it('includes tags, parameters, security, and responses', () => {
    const operation = buildOperation({
      pillar: 'GOVERN',
      description: 'Test op',
      pathParams: ['tenantId'],
      queryParams: ['period'],
      requiredPermissions: ['User.Read.All'],
    });
    assert.equal(operation.tags[0], 'GOVERN');
    assert.equal(operation.parameters.length, 2);
    assert.ok(operation.security.length > 0);
    assert.ok(operation.responses['200']);
  });
});

describe('buildOpenApiSpec', () => {
  it('builds valid OpenAPI doc from route contracts', () => {
    const spec = buildOpenApiSpec({
      title: 'FrontierIQ API',
      version: '1.0.0',
      serverUrl: 'http://localhost:7071',
      routes: buildAllRoutes(),
    });
    assert.equal(spec.openapi, '3.1.0');
    assert.equal(spec.info.title, 'FrontierIQ API');
    assert.ok(spec.paths['/api/v1/observe/usage']);
    assert.ok(spec.paths['/api/v1/govern/remediation/{actionId}']);
  });

  it('returns minimal doc when routes is missing', () => {
    const spec = buildOpenApiSpec({});
    assert.equal(typeof spec.paths, 'object');
    assert.equal(Object.keys(spec.paths).length, 0);
  });
});
