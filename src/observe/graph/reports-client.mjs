/**
 * Graph reports client — on-demand Graph API request builders and response
 * validators for Microsoft 365 Copilot usage reporting.
 *
 * No HTTP is performed here. All functions produce deterministic descriptors
 * or validate payloads returned by the caller's HTTP layer.
 *
 * Pillar: OBSERVE
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SUPPORTED_PERIODS = Object.freeze(['D7', 'D30', 'D90', 'D180']);

const REQUIRED_USAGE_DETAIL_FIELDS = Object.freeze([
  'reportRefreshDate',
  'userPrincipalName',
  'displayName',
  'lastActivityDate',
  'copilotActivityCount',
]);

const REQUIRED_USER_COUNT_FIELDS = Object.freeze([
  'reportRefreshDate',
  'reportDate',
  'enabledUserCount',
  'activeUserCount',
]);

const GRAPH_BASE_URL = 'https://graph.microsoft.com/v1.0';

// ---------------------------------------------------------------------------
// Period support
// ---------------------------------------------------------------------------

/** @returns {string[]} Reporting periods supported by the Graph Reports API. */
export function listSupportedPeriods() {
  return [...SUPPORTED_PERIODS];
}

/** @returns {boolean} */
export function isSupportedPeriod(period) {
  return SUPPORTED_PERIODS.includes(period);
}

// ---------------------------------------------------------------------------
// Request builders
// ---------------------------------------------------------------------------

/**
 * Build a request descriptor for getMicrosoft365CopilotUsageUserDetail.
 *
 * @param {string} tenantId
 * @param {string} period  - One of D7 / D30 / D90 / D180
 * @param {object} [opts]
 * @param {string} [opts.format] - 'JSON' (default) | 'CSV'
 * @returns {{ ok: true, request: object } | { ok: false, code: string, errors: string[] }}
 */
export function buildUsageDetailRequest(tenantId, period, opts = {}) {
  const errors = [];
  if (!tenantId || typeof tenantId !== 'string') errors.push('tenantId is required');
  if (!isSupportedPeriod(period)) errors.push(`period must be one of ${SUPPORTED_PERIODS.join(', ')}`);
  if (errors.length) return { ok: false, code: 'invalid_input', errors };

  const format = opts.format ?? 'JSON';
  const url = `${GRAPH_BASE_URL}/reports/getMicrosoft365CopilotUsageUserDetail(period='${period}')`;

  return {
    ok: true,
    request: {
      method: 'GET',
      url,
      headers: {
        Accept: format === 'CSV' ? 'text/csv' : 'application/json',
        'X-FrontierIQ-TenantId': tenantId,
      },
      params: { '$format': format },
      tenantId,
      period,
    },
  };
}

/**
 * Build a request descriptor for getMicrosoft365CopilotUserCountSummary.
 *
 * @param {string} tenantId
 * @param {string} period
 * @returns {{ ok: true, request: object } | { ok: false, code: string, errors: string[] }}
 */
export function buildUserCountSummaryRequest(tenantId, period) {
  const errors = [];
  if (!tenantId || typeof tenantId !== 'string') errors.push('tenantId is required');
  if (!isSupportedPeriod(period)) errors.push(`period must be one of ${SUPPORTED_PERIODS.join(', ')}`);
  if (errors.length) return { ok: false, code: 'invalid_input', errors };

  return {
    ok: true,
    request: {
      method: 'GET',
      url: `${GRAPH_BASE_URL}/reports/getMicrosoft365CopilotUserCountSummary(period='${period}')`,
      headers: {
        Accept: 'application/json',
        'X-FrontierIQ-TenantId': tenantId,
      },
      params: {},
      tenantId,
      period,
    },
  };
}

// ---------------------------------------------------------------------------
// Response validators
// ---------------------------------------------------------------------------

/**
 * Validate a raw response payload from getMicrosoft365CopilotUsageUserDetail.
 *
 * @param {unknown} payload
 * @returns {{ ok: true, records: object[] } | { ok: false, code: string, errors: string[] }}
 */
export function validateUsageDetailResponse(payload) {
  if (!payload || typeof payload !== 'object') {
    return { ok: false, code: 'invalid_payload', errors: ['payload must be an object'] };
  }

  const value = payload.value;
  if (!Array.isArray(value)) {
    return { ok: false, code: 'invalid_payload', errors: ['payload.value must be an array'] };
  }

  const errors = [];
  const records = [];

  for (let i = 0; i < value.length; i++) {
    const row = value[i];
    const missing = REQUIRED_USAGE_DETAIL_FIELDS.filter((f) => !(f in row));
    if (missing.length) {
      errors.push(`record[${i}] missing fields: ${missing.join(', ')}`);
    } else {
      records.push({
        reportRefreshDate: row.reportRefreshDate,
        userPrincipalName: row.userPrincipalName,
        displayName: row.displayName,
        lastActivityDate: row.lastActivityDate,
        copilotActivityCount: Number(row.copilotActivityCount),
        assignedProducts: Array.isArray(row.assignedProducts) ? row.assignedProducts : [],
      });
    }
  }

  if (errors.length) return { ok: false, code: 'validation_error', errors };
  return { ok: true, records };
}

/**
 * Validate a raw response payload from getMicrosoft365CopilotUserCountSummary.
 *
 * @param {unknown} payload
 * @returns {{ ok: true, records: object[] } | { ok: false, code: string, errors: string[] }}
 */
export function validateUserCountSummaryResponse(payload) {
  if (!payload || typeof payload !== 'object') {
    return { ok: false, code: 'invalid_payload', errors: ['payload must be an object'] };
  }

  const value = payload.value;
  if (!Array.isArray(value)) {
    return { ok: false, code: 'invalid_payload', errors: ['payload.value must be an array'] };
  }

  const errors = [];
  const records = [];

  for (let i = 0; i < value.length; i++) {
    const row = value[i];
    const missing = REQUIRED_USER_COUNT_FIELDS.filter((f) => !(f in row));
    if (missing.length) {
      errors.push(`record[${i}] missing fields: ${missing.join(', ')}`);
    } else {
      records.push({
        reportRefreshDate: row.reportRefreshDate,
        reportDate: row.reportDate,
        enabledUserCount: Number(row.enabledUserCount),
        activeUserCount: Number(row.activeUserCount),
        utilizationRate: row.activeUserCount > 0
          ? Number((row.activeUserCount / row.enabledUserCount).toFixed(4))
          : 0,
      });
    }
  }

  if (errors.length) return { ok: false, code: 'validation_error', errors };
  return { ok: true, records };
}

// ---------------------------------------------------------------------------
// Readiness
// ---------------------------------------------------------------------------

/**
 * Check whether the client configuration is ready for a given tenant.
 *
 * @param {{ tenantId: string, hasCredential: boolean, hasReportsPermission: boolean }} config
 * @returns {{ ready: boolean, blockers: string[] }}
 */
export function checkClientReadiness(config) {
  const blockers = [];
  if (!config.tenantId) blockers.push('tenantId is required');
  if (!config.hasCredential) blockers.push('tenant credential not configured');
  if (!config.hasReportsPermission) blockers.push('Reports.Read.All permission not granted');
  return { ready: blockers.length === 0, blockers };
}
