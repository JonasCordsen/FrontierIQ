import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_DEV_SERVER,
  buildDevServerConfig,
  buildMiddlewareStack,
  buildDevServerStartupPlan,
} from '../../src/optimize/delivery/local-dev-server-scaffold.mjs';

describe('buildDevServerConfig', () => {
  it('returns defaults when overrides are not provided', () => {
    const config = buildDevServerConfig();
    assert.deepEqual(config, DEFAULT_DEV_SERVER);
  });

  it('applies host/port/environment overrides', () => {
    const config = buildDevServerConfig({
      host: '0.0.0.0',
      port: 3000,
      environment: 'test',
    });
    assert.equal(config.host, '0.0.0.0');
    assert.equal(config.port, 3000);
    assert.equal(config.environment, 'test');
  });

  it('throws for invalid port', () => {
    assert.throws(() => buildDevServerConfig({ port: 70000 }), /invalid_port/);
  });
});

describe('buildMiddlewareStack', () => {
  it('includes core middleware by default', () => {
    const stack = buildMiddlewareStack();
    assert.ok(stack.find(item => item.name === 'request-id' && item.enabled));
    assert.ok(stack.find(item => item.name === 'error-handler' && item.enabled));
  });

  it('allows disabling optional middleware', () => {
    const stack = buildMiddlewareStack({
      enableCors: false,
      enableRequestLogging: false,
      enableJsonBody: false,
    });
    assert.equal(stack.find(item => item.name === 'cors').enabled, false);
    assert.equal(stack.find(item => item.name === 'request-logging').enabled, false);
    assert.equal(stack.find(item => item.name === 'json-body').enabled, false);
  });
});

describe('buildDevServerStartupPlan', () => {
  it('returns startup plan with config/routes/openapi summary', () => {
    const plan = buildDevServerStartupPlan({ port: 8080 });
    assert.equal(plan.config.port, 8080);
    assert.ok(plan.routeCount > 0);
    assert.ok(plan.openapi.pathCount > 0);
    assert.equal(plan.middleware.length, 5);
  });
});
