/**
 * OpenAPI spec builder.
 * Pillar: OPTIMIZE (delivery)
 *
 * Deterministic OpenAPI 3.1 document generation from route contracts.
 */

/**
 * Convert route path with :params to OpenAPI path format.
 * @param {string} path
 * @returns {string}
 */
export function toOpenApiPath(path) {
  if (typeof path !== 'string') return '';
  return path.replace(/:([A-Za-z0-9_]+)/g, '{$1}');
}

/**
 * Build path parameters from route pathParams.
 * @param {string[]} pathParams
 * @returns {object[]}
 */
export function buildPathParameters(pathParams) {
  if (!Array.isArray(pathParams)) return [];
  return pathParams.map(name => ({
    name,
    in: 'path',
    required: true,
    schema: { type: 'string' },
  }));
}

/**
 * Build query parameters from route queryParams.
 * @param {string[]} queryParams
 * @returns {object[]}
 */
export function buildQueryParameters(queryParams) {
  if (!Array.isArray(queryParams)) return [];
  return queryParams.map(name => ({
    name,
    in: 'query',
    required: false,
    schema: { type: 'string' },
  }));
}

/**
 * Build operation object for a route.
 * @param {object} route
 * @returns {object}
 */
export function buildOperation(route) {
  const parameters = [
    ...buildPathParameters(route.pathParams),
    ...buildQueryParameters(route.queryParams),
  ];
  return {
    summary: route.description ?? '',
    tags: [route.pillar ?? 'General'],
    parameters,
    security: route.requiredPermissions?.length
      ? [{ entraBearerAuth: route.requiredPermissions }]
      : [],
    responses: {
      '200': { description: 'Success response envelope' },
      '400': { description: 'Bad request' },
      '401': { description: 'Unauthorized' },
      '403': { description: 'Forbidden' },
      '500': { description: 'Server error' },
    },
  };
}

/**
 * Build an OpenAPI 3.1 document from route contracts.
 * @param {{title:string,version:string,serverUrl:string,routes:object[]}} input
 * @returns {object}
 */
export function buildOpenApiSpec(input) {
  const routes = Array.isArray(input?.routes) ? input.routes : [];
  const paths = {};

  for (const route of routes) {
    const openApiPath = toOpenApiPath(route.path);
    const method = String(route.method ?? '').toLowerCase();
    if (!openApiPath || !method) continue;
    if (!paths[openApiPath]) paths[openApiPath] = {};
    paths[openApiPath][method] = buildOperation(route);
  }

  return {
    openapi: '3.1.0',
    info: {
      title: input?.title ?? 'FrontierIQ API',
      version: input?.version ?? '1.0.0',
      description: 'Deterministic API contract generated from route definitions.',
    },
    servers: [{ url: input?.serverUrl ?? 'http://localhost:7071' }],
    components: {
      securitySchemes: {
        entraBearerAuth: {
          type: 'oauth2',
          flows: {
            clientCredentials: {
              tokenUrl: 'https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token',
              scopes: {},
            },
          },
        },
      },
    },
    paths,
  };
}
