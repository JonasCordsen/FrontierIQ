import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyRequestOutcome,
  buildRequestTelemetryEvent,
  buildRequestTelemetrySummary,
  buildRequestTelemetryEvidence,
} from '../../src/observe/api/request-telemetry-contract.mjs';

describe('classifyRequestOutcome', () => {
  it('classifies success responses', () => {
    assert.equal(classifyRequestOutcome(200), 'success');
  });

  it('classifies client errors', () => {
    assert.equal(classifyRequestOutcome(404), 'client_error');
  });

  it('classifies server errors', () => {
    assert.equal(classifyRequestOutcome(500), 'server_error');
  });
});

describe('buildRequestTelemetryEvent', () => {
  it('builds normalized event with explicit status code', () => {
    const event = buildRequestTelemetryEvent({
      requestId: 'r1',
      method: 'GET',
      path: '/api/v1/tenants',
      statusCode: 200,
      durationMs: 12.5,
      generatedAt: '2026-01-01T00:00:00.000Z',
    });
    assert.equal(event.requestId, 'r1');
    assert.equal(event.outcome, 'success');
    assert.equal(event.durationMs, 12.5);
  });

  it('falls back status code from response status', () => {
    const event = buildRequestTelemetryEvent({
      responseStatus: 'error',
    });
    assert.equal(event.statusCode, 500);
  });
});

describe('buildRequestTelemetrySummary', () => {
  it('aggregates totals and averages', () => {
    const summary = buildRequestTelemetrySummary([
      { outcome: 'success', durationMs: 10 },
      { outcome: 'client_error', durationMs: 30 },
      { outcome: 'success', durationMs: 20 },
    ]);
    assert.equal(summary.total, 3);
    assert.equal(summary.byOutcome.success, 2);
    assert.equal(summary.byOutcome.client_error, 1);
    assert.equal(summary.avgDurationMs, 20);
    assert.equal(summary.errorRate, 0.3333);
  });

  it('returns empty summary for missing events', () => {
    const summary = buildRequestTelemetrySummary(null);
    assert.equal(summary.total, 0);
  });
});

describe('buildRequestTelemetryEvidence', () => {
  it('wraps events and summary in evidence envelope', () => {
    const events = [buildRequestTelemetryEvent({ requestId: 'a', statusCode: 200 })];
    const envelope = buildRequestTelemetryEvidence(events, '2026-01-01T00:00:00.000Z');
    assert.equal(envelope.artifactType, 'api-request-telemetry');
    assert.equal(envelope.events.length, 1);
    assert.equal(envelope.summary.total, 1);
  });
});
