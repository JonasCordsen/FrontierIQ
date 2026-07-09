/**
 * Cosmos-backed tenant repository contract.
 * Pillar: GOVERN
 *
 * Deterministic helpers to map FrontierIQ tenant repository records to
 * Azure Cosmos DB document operations without binding the repo to a live SDK.
 */

import { initializeTenantRepository } from './inmemory-tenant-repository.mjs';
import { validateTenantRecord } from './tenant-registry.mjs';

export const COSMOS_SCHEMA_VERSION = '1.0';
export const TENANT_RECORD_DOCUMENT_TYPE = 'tenant-registry-record';

/**
 * Validate Cosmos repository configuration.
 * @param {object} config
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateCosmosRepositoryConfig(config) {
  const errors = [];
  if (!config || typeof config !== 'object') {
    return { valid: false, errors: ['config_missing'] };
  }
  if (!config.endpoint || typeof config.endpoint !== 'string') {
    errors.push('endpoint_missing');
  }
  if (!config.databaseId || typeof config.databaseId !== 'string') {
    errors.push('database_id_missing');
  }
  if (!config.containerId || typeof config.containerId !== 'string') {
    errors.push('container_id_missing');
  }
  if (config.partitionKeyPath && config.partitionKeyPath !== '/tenantId') {
    errors.push('partition_key_path_invalid');
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Build recommended Cosmos container layout for FrontierIQ control-plane metadata.
 * @param {string} prefix
 * @returns {{ databaseId: string, containers: object[] }}
 */
export function buildCosmosContainerLayout(prefix = 'frontieriq') {
  const base = typeof prefix === 'string' && prefix.length > 0 ? prefix : 'frontieriq';
  return {
    databaseId: `${base}-control-plane`,
    containers: [
      { containerId: 'tenant-registry', partitionKeyPath: '/tenantId' },
      { containerId: 'tenant-access', partitionKeyPath: '/tenantId' },
      { containerId: 'governance-waivers', partitionKeyPath: '/tenantId' },
      { containerId: 'evidence-summaries', partitionKeyPath: '/tenantId' },
      { containerId: 'refresh-checkpoints', partitionKeyPath: '/tenantId' },
    ],
  };
}

/**
 * Map a tenant record to a Cosmos document.
 * @param {object} record
 * @returns {{ ok: boolean, document?: object, reason?: string, errors?: string[] }}
 */
export function mapTenantRecordToCosmosDocument(record) {
  const validation = validateTenantRecord(record);
  if (!validation.valid) {
    return { ok: false, reason: 'invalid_record', errors: validation.errors };
  }

  return {
    ok: true,
    document: {
      id: `tenant:${record.tenantId}`,
      tenantId: record.tenantId,
      type: TENANT_RECORD_DOCUMENT_TYPE,
      schemaVersion: COSMOS_SCHEMA_VERSION,
      updatedAt: record.updatedAt,
      record,
    },
  };
}

/**
 * Map a Cosmos document back to a tenant record.
 * @param {object} document
 * @returns {{ ok: boolean, record?: object, reason?: string, errors?: string[] }}
 */
export function mapCosmosDocumentToTenantRecord(document) {
  if (!document || typeof document !== 'object') {
    return { ok: false, reason: 'document_missing' };
  }
  if (document.type !== TENANT_RECORD_DOCUMENT_TYPE) {
    return { ok: false, reason: 'document_type_invalid' };
  }
  const validation = validateTenantRecord(document.record);
  if (!validation.valid) {
    return { ok: false, reason: 'invalid_record', errors: validation.errors };
  }
  return { ok: true, record: document.record };
}

/**
 * Build a deterministic upsert operation descriptor for a tenant record.
 * @param {object} config
 * @param {object} record
 * @returns {{ ok: boolean, operation?: object, reason?: string, errors?: string[] }}
 */
export function buildUpsertTenantOperation(config, record) {
  const configValidation = validateCosmosRepositoryConfig(config);
  if (!configValidation.valid) {
    return { ok: false, reason: 'invalid_config', errors: configValidation.errors };
  }

  const mapped = mapTenantRecordToCosmosDocument(record);
  if (!mapped.ok) return mapped;

  return {
    ok: true,
    operation: {
      kind: 'upsert',
      databaseId: config.databaseId,
      containerId: config.containerId,
      partitionKey: record.tenantId,
      document: mapped.document,
    },
  };
}

/**
 * Build a query descriptor for tenant document reads.
 * @param {object} config
 * @param {{ tenantId?: string }} options
 * @returns {{ ok: boolean, query?: object, reason?: string, errors?: string[] }}
 */
export function buildListTenantDocumentsQuery(config, options = {}) {
  const configValidation = validateCosmosRepositoryConfig(config);
  if (!configValidation.valid) {
    return { ok: false, reason: 'invalid_config', errors: configValidation.errors };
  }

  const parameters = [
    { name: '@type', value: TENANT_RECORD_DOCUMENT_TYPE },
  ];
  let query = 'SELECT * FROM c WHERE c.type = @type';

  if (options?.tenantId) {
    query += ' AND c.tenantId = @tenantId';
    parameters.push({ name: '@tenantId', value: options.tenantId });
  }

  query += ' ORDER BY c.record.displayName';

  return {
    ok: true,
    query: {
      databaseId: config.databaseId,
      containerId: config.containerId,
      partitionKey: options?.tenantId ?? null,
      querySpec: {
        query,
        parameters,
      },
    },
  };
}

/**
 * Hydrate an in-memory repository from Cosmos tenant documents.
 * Fails closed if any document cannot be mapped back to a valid tenant record.
 * @param {object[]} documents
 * @returns {{ ok: boolean, repository?: { records: object[] }, reason?: string, errors?: string[] }}
 */
export function hydrateRepositoryFromCosmosDocuments(documents) {
  if (!Array.isArray(documents)) {
    return { ok: false, reason: 'documents_missing' };
  }

  const records = [];
  const errors = [];
  for (const document of documents) {
    const mapped = mapCosmosDocumentToTenantRecord(document);
    if (!mapped.ok) {
      errors.push(`${document?.id ?? 'unknown'}:${mapped.reason}`);
      continue;
    }
    records.push(mapped.record);
  }

  if (errors.length > 0) {
    return { ok: false, reason: 'invalid_documents', errors };
  }

  return {
    ok: true,
    repository: initializeTenantRepository(records),
  };
}
