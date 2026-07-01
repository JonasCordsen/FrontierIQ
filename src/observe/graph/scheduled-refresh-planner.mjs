/**
 * Scheduled refresh planner — per-pillar data refresh schedules and staleness checks.
 *
 * Defines when and how often each pillar's data should be refreshed, and detects
 * stale or overdue pillars.
 *
 * Pillar: OBSERVE
 */

// ---------------------------------------------------------------------------
// Default policy
// ---------------------------------------------------------------------------

/**
 * @returns {{ intervalHours: Record<string, number> }} Default per-pillar refresh intervals.
 */
export function buildDefaultRefreshPolicy() {
  return {
    intervalHours: {
      OBSERVE: 6,
      GOVERN: 24,
      SECURE: 12,
      OPTIMIZE: 24,
    },
  };
}

// ---------------------------------------------------------------------------
// Schedule builder
// ---------------------------------------------------------------------------

/**
 * Build a refresh schedule for a tenant.
 *
 * @param {string} tenantId
 * @param {object} [policy]          - from buildDefaultRefreshPolicy or custom
 * @param {string} [anchorAt]        - ISO timestamp used as schedule anchor (deterministic sentinel by default)
 * @returns {{ ok: true, schedule: object } | { ok: false, code: string, errors: string[] }}
 */
export function buildRefreshSchedule(tenantId, policy, anchorAt = new Date(0).toISOString()) {
  if (!tenantId || typeof tenantId !== 'string') {
    return { ok: false, code: 'invalid_input', errors: ['tenantId is required'] };
  }

  const p = policy ?? buildDefaultRefreshPolicy();
  const intervalHours = p.intervalHours ?? buildDefaultRefreshPolicy().intervalHours;
  const anchorMs = new Date(anchorAt).getTime();

  const pillars = {};
  for (const [pillar, hours] of Object.entries(intervalHours)) {
    pillars[pillar] = {
      intervalHours: hours,
      nextRefreshAt: new Date(anchorMs + hours * 3600 * 1000).toISOString(),
    };
  }

  return { ok: true, schedule: { tenantId, pillars, createdAt: anchorAt } };
}

// ---------------------------------------------------------------------------
// Staleness check
// ---------------------------------------------------------------------------

/**
 * @typedef {object} StalenessStatus
 * @property {'fresh' | 'stale' | 'overdue'} status
 * @property {number} ageHours
 * @property {number} intervalHours
 */

/**
 * Check whether each pillar's data is fresh, stale, or overdue.
 * Fail-closed: missing lastRefreshedAt for a pillar → overdue.
 *
 * @param {object}                    schedule       - from buildRefreshSchedule
 * @param {Record<string, string|null>} lastRefreshedAt - pillar → ISO timestamp | null
 * @param {string}                    [now]          - ISO timestamp for age calculation
 * @returns {{ ok: true, staleness: Record<string, StalenessStatus> } | { ok: false, code: string, errors: string[] }}
 */
export function checkStaleness(schedule, lastRefreshedAt, now = new Date(0).toISOString()) {
  if (!schedule?.pillars) {
    return { ok: false, code: 'invalid_input', errors: ['schedule.pillars is required'] };
  }
  if (!lastRefreshedAt || typeof lastRefreshedAt !== 'object') {
    return { ok: false, code: 'invalid_input', errors: ['lastRefreshedAt must be an object'] };
  }

  const nowMs = new Date(now).getTime();
  const staleness = {};

  for (const [pillar, config] of Object.entries(schedule.pillars)) {
    const lastMs = lastRefreshedAt[pillar] ? new Date(lastRefreshedAt[pillar]).getTime() : null;

    if (lastMs === null) {
      staleness[pillar] = { status: 'overdue', ageHours: Infinity, intervalHours: config.intervalHours };
      continue;
    }

    const ageHours = (nowMs - lastMs) / 3600000;
    const intervalHours = config.intervalHours;

    let status;
    if (ageHours <= intervalHours) status = 'fresh';
    else if (ageHours <= intervalHours * 2) status = 'stale';
    else status = 'overdue';

    staleness[pillar] = { status, ageHours, intervalHours };
  }

  return { ok: true, staleness };
}

// ---------------------------------------------------------------------------
// Overdue list
// ---------------------------------------------------------------------------

/**
 * List pillars that are past their refresh window.
 *
 * @param {object}                    schedule
 * @param {Record<string, string|null>} lastRefreshedAt
 * @param {string}                    [now]
 * @returns {string[]}
 */
export function listOverduePillars(schedule, lastRefreshedAt, now = new Date(0).toISOString()) {
  const result = checkStaleness(schedule, lastRefreshedAt, now);
  if (!result.ok) return [];
  return Object.entries(result.staleness)
    .filter(([, s]) => s.status === 'overdue')
    .map(([pillar]) => pillar);
}
