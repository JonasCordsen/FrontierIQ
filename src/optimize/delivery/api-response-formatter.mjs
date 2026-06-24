/**
 * API response formatter — consistent response envelope.
 * Pillar: OPTIMIZE (delivery)
 *
 * All FrontierIQ API responses are wrapped in a standard envelope:
 *   { data, meta: { tenantId, generatedAt, version, ... }, errors, pagination }
 *
 * Pure/deterministic: uses injected timestamps (no Date.now()).
 */

/** Current API version embedded in every response meta. */
export const API_RESPONSE_VERSION = '1.0';

/** Success status string. */
export const STATUS_SUCCESS = 'success';

/** Error status string. */
export const STATUS_ERROR = 'error';

/** Partial status string — some data returned but errors present. */
export const STATUS_PARTIAL = 'partial';

/**
 * Build a success response envelope.
 * @param {Object} opts
 * @param {*} opts.data - Response payload (any serialisable value)
 * @param {string} opts.tenantId
 * @param {string} opts.generatedAt - ISO timestamp
 * @param {string} [opts.pillar] - OBSERVE|GOVERN|SECURE|OPTIMIZE
 * @param {Object} [opts.pagination] - { page, pageSize, totalCount, hasNextPage }
 * @returns {Object} Formatted response envelope
 */
export function formatSuccess(opts) {
  const { data, tenantId, generatedAt, pillar, pagination } = opts ?? {};
  const meta = buildMeta({ tenantId, generatedAt, pillar });
  const envelope = {
    status: STATUS_SUCCESS,
    data: data ?? null,
    meta,
    errors: [],
  };
  if (pagination) {
    envelope.pagination = buildPagination(pagination);
  }
  return envelope;
}

/**
 * Build an error response envelope.
 * @param {Object} opts
 * @param {string|Object|Object[]} opts.errors - Error string(s) or error objects
 * @param {string} opts.tenantId
 * @param {string} opts.generatedAt - ISO timestamp
 * @param {string} [opts.pillar]
 * @returns {Object} Formatted error envelope
 */
export function formatError(opts) {
  const { errors, tenantId, generatedAt, pillar } = opts ?? {};
  const normalizedErrors = normalizeErrors(errors);
  return {
    status: STATUS_ERROR,
    data: null,
    meta: buildMeta({ tenantId, generatedAt, pillar }),
    errors: normalizedErrors,
  };
}

/**
 * Build a partial response envelope — data present but with non-fatal errors.
 * @param {Object} opts
 * @param {*} opts.data
 * @param {string|Object|Object[]} opts.errors
 * @param {string} opts.tenantId
 * @param {string} opts.generatedAt
 * @param {string} [opts.pillar]
 * @param {Object} [opts.pagination]
 * @returns {Object}
 */
export function formatPartial(opts) {
  const { data, errors, tenantId, generatedAt, pillar, pagination } = opts ?? {};
  const normalizedErrors = normalizeErrors(errors);
  const envelope = {
    status: STATUS_PARTIAL,
    data: data ?? null,
    meta: buildMeta({ tenantId, generatedAt, pillar }),
    errors: normalizedErrors,
  };
  if (pagination) {
    envelope.pagination = buildPagination(pagination);
  }
  return envelope;
}

/**
 * Build the response meta block.
 * @param {Object} opts
 * @param {string} opts.tenantId
 * @param {string} opts.generatedAt - ISO timestamp
 * @param {string} [opts.pillar]
 * @returns {Object}
 */
export function buildMeta({ tenantId, generatedAt, pillar } = {}) {
  return {
    version: API_RESPONSE_VERSION,
    tenantId: tenantId ?? null,
    generatedAt: generatedAt ?? null,
    ...(pillar ? { pillar } : {}),
  };
}

/**
 * Build a pagination block, ensuring all required fields are present.
 * @param {Object} opts
 * @param {number} opts.page
 * @param {number} opts.pageSize
 * @param {number} opts.totalCount
 * @returns {Object}
 */
export function buildPagination({ page, pageSize, totalCount } = {}) {
  const p = Number(page ?? 1);
  const ps = Number(pageSize ?? 20);
  const tc = Number(totalCount ?? 0);
  return {
    page: p,
    pageSize: ps,
    totalCount: tc,
    totalPages: ps > 0 ? Math.ceil(tc / ps) : 0,
    hasNextPage: p * ps < tc,
  };
}

/**
 * Normalise errors to an array of { code, message } objects.
 * @param {string|Object|Object[]|null} errors
 * @returns {Object[]}
 */
export function normalizeErrors(errors) {
  if (!errors) return [];
  const list = Array.isArray(errors) ? errors : [errors];
  return list.map(e => {
    if (typeof e === 'string') return { code: 'error', message: e };
    if (typeof e === 'object' && e !== null) {
      return { code: e.code ?? 'error', message: e.message ?? String(e) };
    }
    return { code: 'error', message: String(e) };
  });
}

/**
 * Determine the response status from data and errors.
 * @param {*} data
 * @param {Array} errors
 * @returns {'success'|'error'|'partial'}
 */
export function deriveStatus(data, errors) {
  const hasErrors = Array.isArray(errors) && errors.length > 0;
  const hasData = data !== null && data !== undefined;
  if (hasErrors && hasData) return STATUS_PARTIAL;
  if (hasErrors) return STATUS_ERROR;
  return STATUS_SUCCESS;
}
