import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildOpenApiDocsLine,
  upsertOpenApiDocsLine,
  buildOpenApiDocsSyncBundle,
} from '../../src/optimize/delivery/openapi-docs-sync-contract.mjs';

describe('buildOpenApiDocsLine', () => {
  it('builds deterministic docs line', () => {
    const line = buildOpenApiDocsLine({
      fileName: 'frontieriq-openapi.json',
      routeCount: 10,
      generatedAt: '2026-01-01T00:00:00.000Z',
    });
    assert.ok(line.includes('frontieriq-openapi.json'));
    assert.ok(line.includes('routes: 10'));
  });
});

describe('upsertOpenApiDocsLine', () => {
  it('appends line when missing', () => {
    const update = upsertOpenApiDocsLine('# Docs', {
      fileName: 'frontieriq-openapi.json',
      routeCount: 5,
      generatedAt: '2026-01-01T00:00:00.000Z',
    });
    assert.equal(update.changed, true);
    assert.ok(update.content.includes('frontieriq-openapi.json'));
  });

  it('replaces existing line when present', () => {
    const initial = '- `frontieriq-openapi.json` - generated OpenAPI artifact metadata (routes: 1, generatedAt: x)';
    const update = upsertOpenApiDocsLine(initial, {
      fileName: 'frontieriq-openapi.json',
      routeCount: 8,
      generatedAt: '2026-01-01T00:00:00.000Z',
    });
    assert.equal(update.changed, true);
    assert.ok(update.content.includes('routes: 8'));
  });
});

describe('buildOpenApiDocsSyncBundle', () => {
  it('returns publication and updated docs content', () => {
    const bundle = buildOpenApiDocsSyncBundle({
      readmeContent: '# Docs',
      generatedAt: '2026-01-01T00:00:00.000Z',
    });
    assert.ok(bundle.publication.artifact.content.length > 0);
    assert.ok(bundle.updatedReadme.includes('frontieriq-openapi.json'));
  });
});
