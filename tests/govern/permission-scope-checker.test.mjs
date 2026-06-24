import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  PILLAR_REQUIRED_PERMISSIONS,
  ALL_REQUIRED_PERMISSIONS,
  SUPPORTED_PILLARS,
  checkPillarPermissions,
  checkAllPillarPermissions,
  hasPermission,
  buildScopeGapReport,
} from '../../src/govern/auth/permission-scope-checker.mjs';

const FULL_GRANT = ['Reports.Read.All', 'User.Read.All', 'AuditLog.Read.All'];

describe('constants', () => {
  it('SUPPORTED_PILLARS contains all four pillars', () => {
    assert.deepEqual([...SUPPORTED_PILLARS].sort(), ['GOVERN', 'OBSERVE', 'OPTIMIZE', 'SECURE']);
  });
  it('ALL_REQUIRED_PERMISSIONS contains the three known Graph permissions', () => {
    assert.ok(ALL_REQUIRED_PERMISSIONS.includes('Reports.Read.All'));
    assert.ok(ALL_REQUIRED_PERMISSIONS.includes('User.Read.All'));
    assert.ok(ALL_REQUIRED_PERMISSIONS.includes('AuditLog.Read.All'));
  });
  it('PILLAR_REQUIRED_PERMISSIONS is frozen', () => {
    assert.throws(() => { PILLAR_REQUIRED_PERMISSIONS.X = []; }, TypeError);
  });
});

describe('checkPillarPermissions', () => {
  it('covers OBSERVE with Reports.Read.All', () => {
    const r = checkPillarPermissions('OBSERVE', ['Reports.Read.All']);
    assert.equal(r.covered, true);
    assert.deepEqual(r.missing, []);
  });
  it('reports missing scope for SECURE without AuditLog', () => {
    const r = checkPillarPermissions('SECURE', ['User.Read.All']);
    assert.equal(r.covered, false);
    assert.ok(r.missing.includes('AuditLog.Read.All'));
  });
  it('returns error for unknown pillar', () => {
    const r = checkPillarPermissions('UNKNOWN', []);
    assert.equal(r.covered, false);
    assert.ok(r.error.startsWith('unknown_pillar'));
  });
  it('treats missing grantedPermissions as empty', () => {
    const r = checkPillarPermissions('OBSERVE', null);
    assert.equal(r.covered, false);
  });
  it('covers all pillars with full grant', () => {
    for (const pillar of SUPPORTED_PILLARS) {
      assert.equal(checkPillarPermissions(pillar, FULL_GRANT).covered, true);
    }
  });
});

describe('checkAllPillarPermissions', () => {
  it('allCovered true when full grant provided', () => {
    const r = checkAllPillarPermissions(FULL_GRANT);
    assert.equal(r.allCovered, true);
    assert.deepEqual(r.uncoveredPillars, []);
  });
  it('reports uncovered pillars when permissions missing', () => {
    const r = checkAllPillarPermissions(['Reports.Read.All']);
    assert.equal(r.allCovered, false);
    assert.ok(r.uncoveredPillars.includes('SECURE'));
  });
  it('all pillars uncovered when grant is empty', () => {
    const r = checkAllPillarPermissions([]);
    assert.equal(r.uncoveredPillars.length, 4);
  });
});

describe('hasPermission', () => {
  it('returns true when permission is present', () => {
    assert.equal(hasPermission('Reports.Read.All', FULL_GRANT), true);
  });
  it('returns false when permission is absent', () => {
    assert.equal(hasPermission('DirectoryRead.All', FULL_GRANT), false);
  });
  it('returns false for null permission', () => {
    assert.equal(hasPermission(null, FULL_GRANT), false);
  });
  it('returns false for null granted list', () => {
    assert.equal(hasPermission('Reports.Read.All', null), false);
  });
});

describe('buildScopeGapReport', () => {
  it('requiresAction false when all pillars covered', () => {
    const check = checkAllPillarPermissions(FULL_GRANT);
    const r = buildScopeGapReport(check);
    assert.equal(r.requiresAction, false);
    assert.deepEqual(r.gaps, []);
  });
  it('reports gap entries for uncovered pillars', () => {
    const check = checkAllPillarPermissions(['Reports.Read.All']);
    const r = buildScopeGapReport(check);
    assert.equal(r.requiresAction, true);
    assert.ok(r.gaps.some(g => g.pillar === 'SECURE'));
  });
  it('handles invalid check result gracefully', () => {
    const r = buildScopeGapReport(null);
    assert.equal(r.requiresAction, true);
    assert.ok(r.error);
  });
});
