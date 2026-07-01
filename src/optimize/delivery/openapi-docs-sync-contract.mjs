/**
 * OpenAPI docs sync contract.
 * Pillar: OPTIMIZE (delivery)
 *
 * Publishes generated OpenAPI metadata into docs index content contracts.
 */

import { buildOpenApiPublicationBundle } from './openapi-publication-contract.mjs';

/**
 * Build docs metadata line for docs/README.md.
 * @param {{ fileName:string, routeCount:number, generatedAt:string }} summary
 * @returns {string}
 */
export function buildOpenApiDocsLine(summary) {
  return `- \`${summary.fileName}\` - generated OpenAPI artifact metadata (routes: ${summary.routeCount}, generatedAt: ${summary.generatedAt})`;
}

/**
 * Upsert OpenAPI docs metadata line in docs README content.
 * @param {string} readmeContent
 * @param {object} summary
 * @returns {{ content:string, changed:boolean }}
 */
export function upsertOpenApiDocsLine(readmeContent, summary) {
  const content = typeof readmeContent === 'string' ? readmeContent : '';
  const line = buildOpenApiDocsLine(summary);
  const lines = content.split('\n');
  const existingIndex = lines.findIndex(item => item.startsWith('- `frontieriq-openapi.json` - '));
  if (existingIndex >= 0) {
    if (lines[existingIndex] === line) return { content, changed: false };
    lines[existingIndex] = line;
    return { content: lines.join('\n'), changed: true };
  }
  lines.push(line);
  return { content: lines.join('\n'), changed: true };
}

/**
 * Build docs sync artifact bundle.
 * @param {{ readmeContent:string, generatedAt?:string }} input
 * @returns {{ publication:object, updatedReadme:string, changed:boolean, docsLine:string }}
 */
export function buildOpenApiDocsSyncBundle(input = {}) {
  const publication = buildOpenApiPublicationBundle({
    generatedAt: input.generatedAt ?? '1970-01-01T00:00:00.000Z',
  });
  const update = upsertOpenApiDocsLine(input.readmeContent ?? '', {
    fileName: publication.artifact.fileName,
    routeCount: publication.summary.routeCount,
    generatedAt: publication.summary.generatedAt,
  });
  return {
    publication,
    updatedReadme: update.content,
    changed: update.changed,
    docsLine: buildOpenApiDocsLine({
      fileName: publication.artifact.fileName,
      routeCount: publication.summary.routeCount,
      generatedAt: publication.summary.generatedAt,
    }),
  };
}
