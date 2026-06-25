/**
 * Request telemetry contract.
 * Pillar: OBSERVE
 *
 * Normalized request/response audit event contracts for API observability and
 * governance evidence.
 */

/**
 * Classify request outcome from HTTP-like status code.
 * @param {number} statusCode
 * @returns {'success'|'client_error'|'server_error'|'unknown'}
 */
export function classifyRequestOutcome(statusCode) {
  if (!Number.isInteger(statusCode)) return 'unknown';
  if (statusCode >= 200 && statusCode < 300) return 'success';
  if (statusCode >= 400 && statusCode < 500) return 'client_error';
  if (statusCode >= 500) return 'server_error';
  return 'unknown';
}

/**
 * Build a normalized telemetry event.
 * @param {object} input
 * @returns {object}
 */
export function buildRequestTelemetryEvent(input = {}) {
  const statusCode = Number.isInteger(input.statusCode)
    ? input.statusCode
    : input.responseStatus === 'success'
      ? 200
      : 500;
  const outcome = classifyRequestOutcome(statusCode);

  return {
    eventType: 'api_request',
    requestId: input.requestId ?? null,
    tenantId: input.tenantId ?? null,
    userId: input.userId ?? null,
    method: input.method ?? null,
    path: input.path ?? null,
    routePath: input.routePath ?? null,
    pillar: input.pillar ?? null,
    statusCode,
    outcome,
    durationMs: Number.isFinite(input.durationMs) ? input.durationMs : 0,
    errorCode: input.errorCode ?? null,
    generatedAt: input.generatedAt ?? null,
  };
}

/**
 * Build telemetry summary from event list.
 * @param {object[]} events
 * @returns {{ total:number, byOutcome:Record<string,number>, avgDurationMs:number, errorRate:number }}
 */
export function buildRequestTelemetrySummary(events) {
  if (!Array.isArray(events) || events.length === 0) {
    return {
      total: 0,
      byOutcome: { success: 0, client_error: 0, server_error: 0, unknown: 0 },
      avgDurationMs: 0,
      errorRate: 0,
    };
  }

  const byOutcome = { success: 0, client_error: 0, server_error: 0, unknown: 0 };
  let durationTotal = 0;

  for (const event of events) {
    const outcome = event?.outcome ?? 'unknown';
    if (!(outcome in byOutcome)) {
      byOutcome.unknown += 1;
    } else {
      byOutcome[outcome] += 1;
    }
    durationTotal += Number.isFinite(event?.durationMs) ? event.durationMs : 0;
  }

  const errorCount = byOutcome.client_error + byOutcome.server_error;
  return {
    total: events.length,
    byOutcome,
    avgDurationMs: Number((durationTotal / events.length).toFixed(2)),
    errorRate: Number((errorCount / events.length).toFixed(4)),
  };
}

/**
 * Build governance evidence envelope from request telemetry events.
 * @param {object[]} events
 * @param {string} generatedAt
 * @returns {{ artifactType:string, generatedAt:string, summary:object, events:object[] }}
 */
export function buildRequestTelemetryEvidence(events, generatedAt) {
  const list = Array.isArray(events) ? events : [];
  return {
    artifactType: 'api-request-telemetry',
    generatedAt: generatedAt ?? null,
    summary: buildRequestTelemetrySummary(list),
    events: list,
  };
}
