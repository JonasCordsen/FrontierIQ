/**
 * Local dev server scaffold.
 * Pillar: OPTIMIZE (delivery)
 *
 * Framework-agnostic config contracts for local API hosting.
 */

import { buildAllRoutes } from './api-route-builder.mjs';
import { buildOpenApiSpec } from './openapi-spec-builder.mjs';

export const DEFAULT_DEV_SERVER = Object.freeze({
  host: '127.0.0.1',
  port: 7071,
  environment: 'development',
});

/**
 * Build local dev server config.
 * @param {{host?:string,port?:number,environment?:string}} overrides
 * @returns {{host:string,port:number,environment:string}}
 */
export function buildDevServerConfig(overrides = {}) {
  const host = overrides.host ?? DEFAULT_DEV_SERVER.host;
  const port = Number(overrides.port ?? DEFAULT_DEV_SERVER.port);
  const environment = overrides.environment ?? DEFAULT_DEV_SERVER.environment;

  if (!host || typeof host !== 'string') throw new Error('invalid_host');
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('invalid_port');
  if (!environment || typeof environment !== 'string') throw new Error('invalid_environment');

  return { host, port, environment };
}

/**
 * Build middleware stack contract for local server.
 * @param {{enableCors?: boolean, enableRequestLogging?: boolean, enableJsonBody?: boolean}} options
 * @returns {Array<{name:string,enabled:boolean}>}
 */
export function buildMiddlewareStack(options = {}) {
  return [
    { name: 'request-id', enabled: true },
    { name: 'request-logging', enabled: options.enableRequestLogging !== false },
    { name: 'json-body', enabled: options.enableJsonBody !== false },
    { name: 'cors', enabled: options.enableCors !== false },
    { name: 'error-handler', enabled: true },
  ];
}

/**
 * Build startup contract including routes and OpenAPI summary.
 * @param {{host?:string,port?:number,environment?:string}} configOverrides
 * @returns {object}
 */
export function buildDevServerStartupPlan(configOverrides = {}) {
  const config = buildDevServerConfig(configOverrides);
  const routes = buildAllRoutes();
  const openapi = buildOpenApiSpec({
    title: 'FrontierIQ Local API',
    version: '1.0.0-dev',
    serverUrl: `http://${config.host}:${config.port}`,
    routes,
  });
  const middleware = buildMiddlewareStack();

  return {
    config,
    routeCount: routes.length,
    middleware,
    openapi: {
      title: openapi.info.title,
      version: openapi.info.version,
      pathCount: Object.keys(openapi.paths).length,
    },
  };
}
