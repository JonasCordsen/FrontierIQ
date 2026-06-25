/**
 * API host adapter contract.
 * Pillar: OBSERVE (delivery integration surface)
 *
 * Framework-agnostic route resolution and request dispatch contracts that map
 * route definitions to handler execution.
 */

import { formatError } from '../../optimize/delivery/api-response-formatter.mjs';

/**
 * Match a route path (supports :params) to a request path.
 * @param {string} routePath
 * @param {string} requestPath
 * @returns {{ matched: boolean, params: Record<string,string> }}
 */
export function matchRoutePath(routePath, requestPath) {
  if (typeof routePath !== 'string' || typeof requestPath !== 'string') {
    return { matched: false, params: {} };
  }

  const routeParts = routePath.split('/').filter(Boolean);
  const requestParts = requestPath.split('/').filter(Boolean);
  if (routeParts.length !== requestParts.length) {
    return { matched: false, params: {} };
  }

  const params = {};
  for (let i = 0; i < routeParts.length; i += 1) {
    const routePart = routeParts[i];
    const requestPart = requestParts[i];
    if (routePart.startsWith(':')) {
      params[routePart.slice(1)] = requestPart;
      continue;
    }
    if (routePart !== requestPart) {
      return { matched: false, params: {} };
    }
  }

  return { matched: true, params };
}

/**
 * Resolve route by method and request path.
 * @param {object[]} routes
 * @param {string} method
 * @param {string} requestPath
 * @returns {{ route: object|null, params: Record<string,string> }}
 */
export function resolveRoute(routes, method, requestPath) {
  if (!Array.isArray(routes)) return { route: null, params: {} };

  for (const route of routes) {
    if (route?.method !== method) continue;
    const matched = matchRoutePath(route.path, requestPath);
    if (matched.matched) return { route, params: matched.params };
  }
  return { route: null, params: {} };
}

/**
 * Build handler map key.
 * @param {string} method
 * @param {string} routePath
 * @returns {string}
 */
export function buildHandlerKey(method, routePath) {
  return `${method}:${routePath}`;
}

/**
 * Dispatch a request to a matched route handler.
 * @param {{routes: object[], handlers: Record<string,Function>, request: object, generatedAt: string}} input
 * @returns {object}
 */
export function dispatchApiRequest(input) {
  const routes = Array.isArray(input?.routes) ? input.routes : [];
  const handlers = input?.handlers ?? {};
  const request = input?.request ?? {};
  const method = request.method ?? 'GET';
  const path = request.path ?? '';
  const generatedAt = input?.generatedAt ?? null;
  const tenantId = request?.userContext?.tenantId ?? null;

  const { route, params } = resolveRoute(routes, method, path);
  if (!route) {
    return formatError({
      tenantId,
      generatedAt,
      pillar: 'OBSERVE',
      errors: { code: 'route_not_found', message: `No route for ${method} ${path}` },
    });
  }

  const handlerKey = buildHandlerKey(route.method, route.path);
  const handler = handlers[handlerKey];
  if (typeof handler !== 'function') {
    return formatError({
      tenantId,
      generatedAt,
      pillar: route.pillar ?? 'OBSERVE',
      errors: { code: 'handler_not_registered', message: `No handler for ${handlerKey}` },
    });
  }

  return handler({
    route,
    params,
    request,
    generatedAt,
  });
}
