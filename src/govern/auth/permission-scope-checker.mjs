/**
 * Permission scope checker — required Graph API scope verification.
 * Pillar: GOVERN
 *
 * Validates that an Entra token covers the minimum required Graph API
 * application roles or delegated scopes for each FrontierIQ pillar.
 * Fail-closed: any missing permission → blocked.
 */

/** Minimum Graph API permissions required per pillar (application roles). */
export const PILLAR_REQUIRED_PERMISSIONS = Object.freeze({
  OBSERVE: ['Reports.Read.All'],
  GOVERN: ['Reports.Read.All', 'User.Read.All'],
  SECURE: ['AuditLog.Read.All', 'User.Read.All'],
  OPTIMIZE: ['Reports.Read.All', 'User.Read.All'],
});

/** All unique permissions required across all pillars. */
export const ALL_REQUIRED_PERMISSIONS = Object.freeze(
  [...new Set(Object.values(PILLAR_REQUIRED_PERMISSIONS).flat())].sort()
);

/** Supported pillars for scope checking. */
export const SUPPORTED_PILLARS = Object.freeze(Object.keys(PILLAR_REQUIRED_PERMISSIONS));

/**
 * Check whether a set of granted permissions covers all required permissions
 * for a specific pillar.
 * @param {string} pillar - One of OBSERVE | GOVERN | SECURE | OPTIMIZE
 * @param {string[]} grantedPermissions - Application roles or delegated scopes
 * @returns {{ covered: boolean, pillar: string, required: string[], missing: string[] }}
 */
export function checkPillarPermissions(pillar, grantedPermissions) {
  const required = PILLAR_REQUIRED_PERMISSIONS[pillar];
  if (!required) {
    return {
      covered: false,
      pillar,
      required: [],
      missing: [],
      error: `unknown_pillar:${pillar}`,
    };
  }

  const granted = Array.isArray(grantedPermissions) ? grantedPermissions : [];
  const missing = required.filter(p => !granted.includes(p));

  return {
    covered: missing.length === 0,
    pillar,
    required: [...required],
    missing,
  };
}

/**
 * Check granted permissions against all four pillars.
 * @param {string[]} grantedPermissions
 * @returns {{ allCovered: boolean, results: Object[], uncoveredPillars: string[] }}
 */
export function checkAllPillarPermissions(grantedPermissions) {
  const results = SUPPORTED_PILLARS.map(pillar =>
    checkPillarPermissions(pillar, grantedPermissions)
  );
  const uncoveredPillars = results.filter(r => !r.covered).map(r => r.pillar);
  return {
    allCovered: uncoveredPillars.length === 0,
    results,
    uncoveredPillars,
  };
}

/**
 * Check whether a specific well-known Graph API permission is present.
 * @param {string} permission - Permission string to check
 * @param {string[]} grantedPermissions
 * @returns {boolean}
 */
export function hasPermission(permission, grantedPermissions) {
  if (!permission || !Array.isArray(grantedPermissions)) return false;
  return grantedPermissions.includes(permission);
}

/**
 * Build a human-readable scope gap report from pillar check results.
 * @param {{ results: Object[], uncoveredPillars: string[] }} checkResult
 * @returns {{ requiresAction: boolean, gaps: Array<{ pillar: string, missing: string[] }> }}
 */
export function buildScopeGapReport(checkResult) {
  if (!checkResult || !Array.isArray(checkResult.results)) {
    return { requiresAction: true, gaps: [], error: 'invalid_check_result' };
  }

  const gaps = checkResult.results
    .filter(r => !r.covered && r.missing && r.missing.length > 0)
    .map(r => ({ pillar: r.pillar, missing: r.missing }));

  return {
    requiresAction: gaps.length > 0,
    gaps,
  };
}
