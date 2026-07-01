import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyTenantPriority,
  buildTenantQueue,
  applyRateLimitPolicy,
  buildOrchestrationSummary,
  checkOrchestratorReadiness,
} from '../../src/observe/graph/multi-tenant-orchestrator.mjs';

describe('classifyTenantPriority', () => {
  it('is urgent when hasOpenIncident', () => {
    assert.equal(classifyTenantPriority({ hasOpenIncident: true }), 'urgent');
  });
  it('is urgent when isNew', () => {
    assert.equal(classifyTenantPriority({ isNew: true }), 'urgent');
  });
  it('is standard by default', () => {
    assert.equal(classifyTenantPriority({}), 'standard');
  });
  it('is standard for enterprise tier', () => {
    assert.equal(classifyTenantPriority({ tier: 'enterprise' }), 'standard');
  });
  it('is low for trial tier', () => {
    assert.equal(classifyTenantPriority({ tier: 'trial' }), 'low');
  });
  it('handles null gracefully', () => {
    assert.equal(classifyTenantPriority(null), 'standard');
  });
});

describe('buildTenantQueue', () => {
  const tenants = [
    { tenantId: 't1', hasCredential: true, requestTypes: ['usageDetail'], meta: { tier: 'trial' } },
    { tenantId: 't2', hasCredential: true, requestTypes: ['auditLog'], meta: { hasOpenIncident: true } },
    { tenantId: 't3', hasCredential: false, requestTypes: ['usageDetail'] },
    { tenantId: 't4', hasCredential: true, requestTypes: ['userCountSummary'] },
  ];

  it('returns ok with queue and skipped', () => {
    const r = buildTenantQueue(tenants);
    assert.ok(r.ok);
    assert.ok(Array.isArray(r.queue));
    assert.ok(Array.isArray(r.skipped));
  });
  it('excludes tenants without credentials', () => {
    const r = buildTenantQueue(tenants);
    assert.ok(!r.queue.some((e) => e.tenantId === 't3'));
    assert.ok(r.skipped.some((s) => s.tenantId === 't3' && s.reason === 'no_credential'));
  });
  it('orders urgent before standard before low', () => {
    const r = buildTenantQueue(tenants);
    const priorities = r.queue.map((e) => e.priority);
    const urgentIdx = priorities.indexOf('urgent');
    const lowIdx = priorities.indexOf('low');
    if (urgentIdx !== -1 && lowIdx !== -1) assert.ok(urgentIdx < lowIdx);
  });
  it('estimates cost based on requestTypes', () => {
    const r = buildTenantQueue([{ tenantId: 'x', hasCredential: true, requestTypes: ['usageDetail', 'auditLog'] }]);
    assert.equal(r.queue[0].estimatedCost, 5);
  });
  it('defaults requestTypes to usageDetail when empty', () => {
    const r = buildTenantQueue([{ tenantId: 'x', hasCredential: true, requestTypes: [] }]);
    assert.deepEqual(r.queue[0].requestTypes, ['usageDetail']);
  });
  it('skips tenants with missing tenantId', () => {
    const r = buildTenantQueue([{ hasCredential: true }]);
    assert.equal(r.skipped[0].reason, 'missing_tenant_id');
  });
  it('rejects non-array input', () => {
    assert.ok(!buildTenantQueue(null).ok);
    assert.ok(!buildTenantQueue('string').ok);
  });
});

describe('applyRateLimitPolicy', () => {
  const queue = [
    { tenantId: 't1', priority: 'urgent', requestTypes: ['usageDetail'], estimatedCost: 2 },
    { tenantId: 't2', priority: 'standard', requestTypes: ['auditLog'], estimatedCost: 3 },
    { tenantId: 't3', priority: 'low', requestTypes: ['usageDetail'], estimatedCost: 2 },
  ];

  it('returns a plan for each queue entry', () => {
    const r = applyRateLimitPolicy(queue);
    assert.ok(r.ok);
    assert.equal(r.plan.length, 3);
  });
  it('adds scheduledDelayMs, retryBudget, retryBackoffMs', () => {
    const r = applyRateLimitPolicy(queue);
    for (const entry of r.plan) {
      assert.ok('scheduledDelayMs' in entry);
      assert.ok('retryBudget' in entry);
      assert.ok('retryBackoffMs' in entry);
    }
  });
  it('first entry has delay 0', () => {
    const r = applyRateLimitPolicy(queue);
    assert.equal(r.plan[0].scheduledDelayMs, 0);
  });
  it('respects custom policy maxRetries', () => {
    const r = applyRateLimitPolicy(queue, { maxRetries: 1 });
    assert.equal(r.plan[0].retryBudget, 1);
  });
  it('rejects non-array queue', () => {
    assert.ok(!applyRateLimitPolicy(null).ok);
  });
});

describe('buildOrchestrationSummary', () => {
  it('counts ok/error/skipped', () => {
    const results = [
      { tenantId: 't1', status: 'ok' },
      { tenantId: 't2', status: 'ok' },
      { tenantId: 't3', status: 'error', errorCode: 'auth_failed' },
      { tenantId: 't4', status: 'skipped' },
    ];
    const r = buildOrchestrationSummary(results);
    assert.ok(r.ok);
    assert.equal(r.summary.okCount, 2);
    assert.equal(r.summary.errorCount, 1);
    assert.equal(r.summary.skippedCount, 1);
    assert.equal(r.summary.total, 4);
  });
  it('computes successRate', () => {
    const r = buildOrchestrationSummary([
      { tenantId: 't1', status: 'ok' },
      { tenantId: 't2', status: 'ok' },
      { tenantId: 't3', status: 'error' },
      { tenantId: 't4', status: 'error' },
    ]);
    assert.equal(r.summary.successRate, 0.5);
  });
  it('lists error tenants with codes', () => {
    const r = buildOrchestrationSummary([{ tenantId: 't1', status: 'error', errorCode: 'timeout' }]);
    assert.equal(r.summary.errorTenants[0].code, 'timeout');
  });
  it('health is healthy when >=95% success', () => {
    const results = Array.from({ length: 100 }, (_, i) => ({ tenantId: `t${i}`, status: i < 96 ? 'ok' : 'error' }));
    const r = buildOrchestrationSummary(results);
    assert.equal(r.summary.health, 'healthy');
  });
  it('health is critical when <80% success', () => {
    const results = Array.from({ length: 10 }, (_, i) => ({ tenantId: `t${i}`, status: i < 7 ? 'error' : 'ok' }));
    const r = buildOrchestrationSummary(results);
    assert.equal(r.summary.health, 'critical');
  });
  it('successRate is 0 for empty results', () => {
    const r = buildOrchestrationSummary([]);
    assert.equal(r.summary.successRate, 0);
  });
  it('rejects non-array input', () => {
    assert.ok(!buildOrchestrationSummary(null).ok);
  });
});

describe('checkOrchestratorReadiness', () => {
  it('is ready when configured', () => {
    const r = checkOrchestratorReadiness({ tenants: [{}], hasOrchestrationPermission: true });
    assert.ok(r.ready);
  });
  it('blocks when no tenants', () => {
    const r = checkOrchestratorReadiness({ tenants: [], hasOrchestrationPermission: true });
    assert.ok(!r.ready);
    assert.ok(r.blockers.some((b) => b.includes('tenant')));
  });
  it('blocks when permission missing', () => {
    const r = checkOrchestratorReadiness({ tenants: [{}], hasOrchestrationPermission: false });
    assert.ok(!r.ready);
  });
  it('accumulates multiple blockers', () => {
    const r = checkOrchestratorReadiness({ tenants: [], hasOrchestrationPermission: false });
    assert.equal(r.blockers.length, 2);
  });
});
