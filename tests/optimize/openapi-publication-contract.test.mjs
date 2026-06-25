import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildOpenApiArtifact,
  buildOpenApiPublicationSummary,
  buildOpenApiPublicationBundle,
} from '../../src/optimize/delivery/openapi-publication-contract.mjs';

describe('buildOpenApiArtifact', () => {
  it('builds JSON artifact content and metadata', () => {
    const artifact = buildOpenApiArtifact({
      generatedAt: '2026-01-01T00:00:00.000Z',
    });
    assert.equal(artifact.fileName, 'frontieriq-openapi.json');
    assert.equal(artifact.mediaType, 'application/json');
    assert.ok(artifact.content.includes('"openapi": "3.1.0"'));
  });
});

describe('buildOpenApiPublicationSummary', () => {
  it('returns summary with route count and size', () => {
    const artifact = buildOpenApiArtifact({
      generatedAt: '2026-01-01T00:00:00.000Z',
    });
    const summary = buildOpenApiPublicationSummary(artifact);
    assert.equal(summary.fileName, 'frontieriq-openapi.json');
    assert.ok(summary.bytes > 0);
    assert.ok(summary.routeCount > 0);
  });

  it('returns empty summary for invalid artifact', () => {
    const summary = buildOpenApiPublicationSummary(null);
    assert.equal(summary.routeCount, 0);
  });
});

describe('buildOpenApiPublicationBundle', () => {
  it('returns artifact and summary objects', () => {
    const bundle = buildOpenApiPublicationBundle({
      generatedAt: '2026-01-01T00:00:00.000Z',
    });
    assert.ok(bundle.artifact.content.length > 0);
    assert.ok(bundle.summary.routeCount > 0);
  });
});
