/**
 * API route builder — typed route definitions per pillar with scope requirements.
 * Pillar: OPTIMIZE (delivery)
 *
 * Pure/deterministic: builds route definition objects. No HTTP server coupling.
 * Consumer layers (Express, Azure Functions, etc.) bind these definitions at startup.
 */

import { PILLAR_REQUIRED_PERMISSIONS } from '../../../src/govern/auth/permission-scope-checker.mjs';

/** HTTP methods allowed in route definitions. */
export const ALLOWED_METHODS = Object.freeze(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']);

/** Version prefix used by all FrontierIQ API routes. */
export const API_VERSION_PREFIX = '/api/v1';

/**
 * Build a single route definition.
 * @param {Object} opts
 * @param {string} opts.pillar - OBSERVE|GOVERN|SECURE|OPTIMIZE
 * @param {string} opts.path - Route path (without version prefix)
 * @param {'GET'|'POST'|'PUT'|'DELETE'|'PATCH'} opts.method
 * @param {string} opts.description
 * @param {string[]} [opts.requiredPermissions] - Defaults to pillar permissions
 * @param {string[]} [opts.queryParams] - Documented query parameter names
 * @param {string[]} [opts.pathParams] - Documented path parameter names
 * @returns {Object} Route definition
 */
export function buildRoute(opts) {
  const { pillar, path, method, description, requiredPermissions, queryParams = [], pathParams = [] } = opts ?? {};

  if (!PILLAR_REQUIRED_PERMISSIONS[pillar]) {
    throw new Error(`unknown_pillar:${pillar}`);
  }
  if (!ALLOWED_METHODS.includes(method)) {
    throw new Error(`invalid_method:${method}`);
  }
  if (!path || !path.startsWith('/')) {
    throw new Error('path_must_start_with_slash');
  }

  return {
    pillar,
    method,
    path: `${API_VERSION_PREFIX}${path}`,
    description: description ?? '',
    requiredPermissions: requiredPermissions ?? [...PILLAR_REQUIRED_PERMISSIONS[pillar]],
    queryParams: [...queryParams],
    pathParams: [...pathParams],
  };
}

/**
 * Build the full set of FrontierIQ API routes for all four pillars.
 * @returns {Object[]} Array of route definitions
 */
export function buildAllRoutes() {
  return [
    // OBSERVE
    buildRoute({
      pillar: 'OBSERVE',
      path: '/observe/usage',
      method: 'GET',
      description: 'Retrieve Copilot usage detail report for a tenant',
      queryParams: ['tenantId', 'period'],
    }),
    buildRoute({
      pillar: 'OBSERVE',
      path: '/observe/agents',
      method: 'GET',
      description: 'Retrieve agent activity signals for a tenant',
      queryParams: ['tenantId'],
    }),
    buildRoute({
      pillar: 'OBSERVE',
      path: '/observe/signals/correlate',
      method: 'POST',
      description: 'Run cross-pillar signal correlation for a tenant',
      queryParams: ['tenantId'],
    }),

    // GOVERN
    buildRoute({
      pillar: 'GOVERN',
      path: '/govern/onboarding',
      method: 'GET',
      description: 'Retrieve onboarding assessment for a tenant',
      queryParams: ['tenantId'],
    }),
    buildRoute({
      pillar: 'GOVERN',
      path: '/govern/compliance',
      method: 'GET',
      description: 'Retrieve compliance posture summary for a tenant',
      queryParams: ['tenantId'],
    }),
    buildRoute({
      pillar: 'GOVERN',
      path: '/govern/remediation/:actionId',
      method: 'PUT',
      description: 'Update remediation record state',
      pathParams: ['actionId'],
    }),

    // SECURE
    buildRoute({
      pillar: 'SECURE',
      path: '/secure/audit',
      method: 'GET',
      description: 'Retrieve classified audit log events for a tenant',
      queryParams: ['tenantId', 'severity'],
    }),
    buildRoute({
      pillar: 'SECURE',
      path: '/secure/alerts',
      method: 'GET',
      description: 'Retrieve active threshold alerts for a tenant',
      queryParams: ['tenantId'],
    }),

    // OPTIMIZE
    buildRoute({
      pillar: 'OPTIMIZE',
      path: '/optimize/scorecard',
      method: 'GET',
      description: 'Retrieve tenant health scorecard',
      queryParams: ['tenantId'],
    }),
    buildRoute({
      pillar: 'OPTIMIZE',
      path: '/optimize/actions',
      method: 'GET',
      description: 'Retrieve prioritized coach actions for a tenant',
      queryParams: ['tenantId', 'maxResults'],
    }),
    buildRoute({
      pillar: 'OPTIMIZE',
      path: '/optimize/briefing',
      method: 'GET',
      description: 'Retrieve IT admin briefing for a tenant',
      queryParams: ['tenantId'],
    }),
    buildRoute({
      pillar: 'OPTIMIZE',
      path: '/optimize/export/powerbi',
      method: 'GET',
      description: 'Export scorecard data in Power BI dataset format',
      queryParams: ['tenantId'],
    }),
    buildRoute({
      pillar: 'OPTIMIZE',
      path: '/optimize/export/fabric',
      method: 'GET',
      description: 'Export signal data in Microsoft Fabric lakehouse format',
      queryParams: ['tenantId'],
    }),
  ];
}

/**
 * Look up a route by method and path (with version prefix included).
 * @param {Object[]} routes
 * @param {string} method
 * @param {string} fullPath - Including version prefix
 * @returns {Object|null}
 */
export function findRoute(routes, method, fullPath) {
  if (!Array.isArray(routes)) return null;
  return routes.find(r => r.method === method && r.path === fullPath) ?? null;
}

/**
 * Filter routes by pillar.
 * @param {Object[]} routes
 * @param {string} pillar
 * @returns {Object[]}
 */
export function routesByPillar(routes, pillar) {
  if (!Array.isArray(routes)) return [];
  return routes.filter(r => r.pillar === pillar);
}

/**
 * Build a route index keyed by `METHOD:path`.
 * @param {Object[]} routes
 * @returns {Object}
 */
export function buildRouteIndex(routes) {
  if (!Array.isArray(routes)) return {};
  return Object.fromEntries(routes.map(r => [`${r.method}:${r.path}`, r]));
}
