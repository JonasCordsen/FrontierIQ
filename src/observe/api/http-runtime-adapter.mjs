/**
 * HTTP runtime adapter contract.
 * Pillar: OBSERVE
 *
 * Binds route resolution, auth middleware, host dispatch, and telemetry into a
 * single executable request pipeline contract.
 */

import { resolveRoute, dispatchApiRequest } from './api-host-adapter.mjs';
import { authorizeRequest } from '../../govern/auth/auth-middleware-contract.mjs';
import { formatError } from '../../optimize/delivery/api-response-formatter.mjs';
import { buildRequestTelemetryEvent } from './request-telemetry-contract.mjs';

/**
 * Convert response envelope status to status code.
 * @param {object} response
 * @returns {number}
 */
export function inferStatusCode(response) {
  if (!response || typeof response !== 'object') return 500;
  if (response.status === 'success') return 200;
  if (response.status === 'partial') return 207;
  const code = response?.errors?.[0]?.code;
  if (code === 'route_not_found') return 404;
  if (code === 'bearer_missing' || code === 'tenant_id_mismatch') return 401;
  if (code === 'insufficient_permissions' || code === 'missing_permissions') return 403;
  return 500;
}

/**
 * Execute request through runtime pipeline.
 * @param {{ routes:object[], handlers:Record<string,Function>, request:object, generatedAt:string, durationMs?:number }} input
 * @returns {{ response:object, telemetry:object }}
 */
export function executeRuntimeRequest(input) {
  const routes = Array.isArray(input?.routes) ? input.routes : [];
  const request = input?.request ?? {};
  const generatedAt = input?.generatedAt ?? null;
  const durationMs = Number.isFinite(input?.durationMs) ? input.durationMs : 0;

  const resolved = resolveRoute(routes, request.method ?? 'GET', request.path ?? '');
  if (!resolved.route) {
    const response = dispatchApiRequest({
      routes,
      handlers: input?.handlers ?? {},
      request,
      generatedAt,
    });
    const telemetry = buildRequestTelemetryEvent({
      requestId: request.requestId ?? null,
      tenantId: request.userContext?.tenantId ?? null,
      userId: request.userContext?.userId ?? null,
      method: request.method ?? null,
      path: request.path ?? null,
      routePath: null,
      pillar: null,
      statusCode: inferStatusCode(response),
      durationMs,
      errorCode: response?.errors?.[0]?.code ?? null,
      generatedAt,
    });
    return { response, telemetry };
  }

  const authDecision = authorizeRequest({
    ...request,
    route: resolved.route,
  });
  if (!authDecision.allowed) {
    const response = formatError({
      tenantId: request.userContext?.tenantId ?? null,
      generatedAt,
      pillar: resolved.route.pillar ?? 'OBSERVE',
      errors: { code: authDecision.reason, message: 'Authorization failed' },
    });
    const telemetry = buildRequestTelemetryEvent({
      requestId: request.requestId ?? null,
      tenantId: request.userContext?.tenantId ?? null,
      userId: request.userContext?.userId ?? null,
      method: request.method ?? null,
      path: request.path ?? null,
      routePath: resolved.route.path,
      pillar: resolved.route.pillar ?? null,
      statusCode: inferStatusCode(response),
      durationMs,
      errorCode: authDecision.reason ?? null,
      generatedAt,
    });
    return { response, telemetry };
  }

  const response = dispatchApiRequest({
    routes,
    handlers: input?.handlers ?? {},
    request,
    generatedAt,
  });
  const telemetry = buildRequestTelemetryEvent({
    requestId: request.requestId ?? null,
    tenantId: request.userContext?.tenantId ?? null,
    userId: request.userContext?.userId ?? null,
    method: request.method ?? null,
    path: request.path ?? null,
    routePath: resolved.route.path,
    pillar: resolved.route.pillar ?? null,
    statusCode: inferStatusCode(response),
    durationMs,
    errorCode: response?.errors?.[0]?.code ?? null,
    generatedAt,
  });
  return { response, telemetry };
}
