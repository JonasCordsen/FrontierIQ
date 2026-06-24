/**
 * Graph audit client — on-demand Graph API request builders and response
 * validators for Microsoft 365 audit log access.
 *
 * No HTTP is performed here. All functions produce deterministic descriptors
 * or validate payloads returned by the caller's HTTP layer.
 *
 * Pillar: OBSERVE
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SUPPORTED_WORKLOADS = Object.freeze([
  'MicrosoftTeams',
  'SharePoint',
  'OneDrive',
  'Exchange',
  'AzureActiveDirectory',
  'MicrosoftForms',
  'Copilot',
  'CopilotStudio',
]);

const EVENT_SEVERITY_MAP = Object.freeze({
  SignIn: 'low',
  FileAccessed: 'low',
  FileDownloaded: 'medium',
  FileShared: 'medium',
  SensitiveFileSeen: 'high',
  PolicyViolation: 'high',
  AdminConsentGranted: 'high',
  RoleAssigned: 'high',
  AgentInvoked: 'low',
  AgentPolicyViolation: 'critical',
  OvershareDetected: 'critical',
  UnauthorizedAccess: 'critical',
});

const PILLAR_MAP = Object.freeze({
  SignIn: 'SECURE',
  FileAccessed: 'OBSERVE',
  FileDownloaded: 'SECURE',
  FileShared: 'SECURE',
  SensitiveFileSeen: 'SECURE',
  PolicyViolation: 'GOVERN',
  AdminConsentGranted: 'GOVERN',
  RoleAssigned: 'GOVERN',
  AgentInvoked: 'OBSERVE',
  AgentPolicyViolation: 'GOVERN',
  OvershareDetected: 'SECURE',
  UnauthorizedAccess: 'SECURE',
});

const REQUIRED_AUDIT_EVENT_FIELDS = Object.freeze([
  'Id',
  'CreationTime',
  'Operation',
  'Workload',
  'UserId',
]);

const GRAPH_BASE_URL = 'https://graph.microsoft.com/v1.0';

// ---------------------------------------------------------------------------
// Workload support
// ---------------------------------------------------------------------------

/** @returns {string[]} */
export function listSupportedWorkloads() {
  return [...SUPPORTED_WORKLOADS];
}

/** @returns {boolean} */
export function isSupportedWorkload(workload) {
  return SUPPORTED_WORKLOADS.includes(workload);
}

// ---------------------------------------------------------------------------
// Request builder
// ---------------------------------------------------------------------------

/**
 * @typedef {object} AuditFilter
 * @property {string}  [workload]   - one of SUPPORTED_WORKLOADS (omit for all)
 * @property {string}  [startDate]  - ISO date string YYYY-MM-DD
 * @property {string}  [endDate]    - ISO date string YYYY-MM-DD
 * @property {string}  [userId]     - filter to a specific UPN
 */

/**
 * Build a request descriptor for the auditLogs/directoryAudits or
 * auditLogs/signIns endpoint with OData filters.
 *
 * @param {string}      tenantId
 * @param {AuditFilter} [filter]
 * @returns {{ ok: true, request: object } | { ok: false, code: string, errors: string[] }}
 */
export function buildAuditLogRequest(tenantId, filter = {}) {
  const errors = [];
  if (!tenantId || typeof tenantId !== 'string') errors.push('tenantId is required');
  if (filter.workload && !isSupportedWorkload(filter.workload)) {
    errors.push(`workload '${filter.workload}' is not supported; use listSupportedWorkloads()`);
  }
  if (errors.length) return { ok: false, code: 'invalid_input', errors };

  const filterParts = [];
  if (filter.workload) filterParts.push(`Workload eq '${filter.workload}'`);
  if (filter.startDate) filterParts.push(`activityDateTime ge ${filter.startDate}T00:00:00Z`);
  if (filter.endDate) filterParts.push(`activityDateTime le ${filter.endDate}T23:59:59Z`);
  if (filter.userId) filterParts.push(`initiatedBy/user/userPrincipalName eq '${filter.userId}'`);

  const params = filterParts.length ? { '$filter': filterParts.join(' and '), '$top': 1000 } : { '$top': 1000 };

  return {
    ok: true,
    request: {
      method: 'GET',
      url: `${GRAPH_BASE_URL}/auditLogs/directoryAudits`,
      headers: {
        Accept: 'application/json',
        'X-FrontierIQ-TenantId': tenantId,
      },
      params,
      tenantId,
      filter,
    },
  };
}

// ---------------------------------------------------------------------------
// Response validator
// ---------------------------------------------------------------------------

/**
 * Validate a raw audit log response payload.
 *
 * @param {unknown} payload
 * @returns {{ ok: true, events: object[] } | { ok: false, code: string, errors: string[] }}
 */
export function validateAuditLogResponse(payload) {
  if (!payload || typeof payload !== 'object') {
    return { ok: false, code: 'invalid_payload', errors: ['payload must be an object'] };
  }

  const value = payload.value;
  if (!Array.isArray(value)) {
    return { ok: false, code: 'invalid_payload', errors: ['payload.value must be an array'] };
  }

  const errors = [];
  const events = [];

  for (let i = 0; i < value.length; i++) {
    const row = value[i];
    const missing = REQUIRED_AUDIT_EVENT_FIELDS.filter((f) => !(f in row));
    if (missing.length) {
      errors.push(`event[${i}] missing fields: ${missing.join(', ')}`);
    } else {
      const classified = classifyAuditEvent(row);
      events.push({
        id: row.Id,
        creationTime: row.CreationTime,
        operation: row.Operation,
        workload: row.Workload,
        userId: row.UserId,
        severity: classified.severity,
        category: classified.category,
        pillar: classified.pillar,
      });
    }
  }

  if (errors.length) return { ok: false, code: 'validation_error', errors };
  return { ok: true, events };
}

// ---------------------------------------------------------------------------
// Event classifier
// ---------------------------------------------------------------------------

/**
 * Classify an audit event into category, severity, and primary pillar.
 *
 * @param {{ Operation: string, Workload: string }} event
 * @returns {{ category: string, severity: string, pillar: string }}
 */
export function classifyAuditEvent(event) {
  const op = event?.Operation ?? 'Unknown';
  const workload = event?.Workload ?? 'Unknown';

  const severity = EVENT_SEVERITY_MAP[op] ?? 'low';
  const pillar = PILLAR_MAP[op] ?? 'OBSERVE';

  let category = 'general';
  if (op.toLowerCase().includes('policy') || op === 'AdminConsentGranted') category = 'governance';
  else if (op.toLowerCase().includes('file') || op === 'SensitiveFileSeen') category = 'data-access';
  else if (op === 'RoleAssigned' || op === 'SignIn' || op === 'UnauthorizedAccess') category = 'identity';
  else if (workload === 'Copilot' || workload === 'CopilotStudio') category = 'agent-activity';

  return { category, severity, pillar };
}

// ---------------------------------------------------------------------------
// Readiness
// ---------------------------------------------------------------------------

/**
 * @param {{ tenantId: string, hasCredential: boolean, hasAuditPermission: boolean }} config
 * @returns {{ ready: boolean, blockers: string[] }}
 */
export function checkAuditClientReadiness(config) {
  const blockers = [];
  if (!config.tenantId) blockers.push('tenantId is required');
  if (!config.hasCredential) blockers.push('tenant credential not configured');
  if (!config.hasAuditPermission) blockers.push('AuditLog.Read.All permission not granted');
  return { ready: blockers.length === 0, blockers };
}
