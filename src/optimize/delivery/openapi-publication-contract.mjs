/**
 * OpenAPI publication contract.
 * Pillar: OPTIMIZE (delivery)
 *
 * Deterministic artifact generation contracts for OpenAPI publication.
 */

import { buildAllRoutes } from './api-route-builder.mjs';
import { buildOpenApiSpec } from './openapi-spec-builder.mjs';

/**
 * Build publication artifact metadata and content.
 * @param {{title?:string,version?:string,serverUrl?:string,routes?:object[],generatedAt?:string}} input
 * @returns {{ fileName:string, mediaType:string, content:string, generatedAt:string }}
 */
export function buildOpenApiArtifact(input = {}) {
  const routes = Array.isArray(input.routes) ? input.routes : buildAllRoutes();
  const generatedAt = input.generatedAt ?? '1970-01-01T00:00:00.000Z';
  const spec = buildOpenApiSpec({
    title: input.title ?? 'FrontierIQ API',
    version: input.version ?? '1.0.0',
    serverUrl: input.serverUrl ?? 'http://localhost:7071',
    routes,
  });

  return {
    fileName: 'frontieriq-openapi.json',
    mediaType: 'application/json',
    content: JSON.stringify(spec, null, 2),
    generatedAt,
  };
}

/**
 * Build publication summary for docs/client tooling.
 * @param {{ content:string, fileName:string, generatedAt:string }} artifact
 * @returns {{ fileName:string, bytes:number, generatedAt:string, routeCount:number }}
 */
export function buildOpenApiPublicationSummary(artifact) {
  if (!artifact || typeof artifact.content !== 'string') {
    return { fileName: null, bytes: 0, generatedAt: null, routeCount: 0 };
  }
  const parsed = JSON.parse(artifact.content);
  const routeCount = Object.values(parsed.paths ?? {}).reduce(
    (sum, methods) => sum + Object.keys(methods).length,
    0
  );
  return {
    fileName: artifact.fileName ?? null,
    bytes: artifact.content.length,
    generatedAt: artifact.generatedAt ?? null,
    routeCount,
  };
}

/**
 * Build publication bundle consumed by release/CI workflows.
 * @param {object} input
 * @returns {{ artifact: object, summary: object }}
 */
export function buildOpenApiPublicationBundle(input = {}) {
  const artifact = buildOpenApiArtifact(input);
  const summary = buildOpenApiPublicationSummary(artifact);
  return { artifact, summary };
}
