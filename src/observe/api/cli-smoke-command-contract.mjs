/**
 * CLI smoke command contract.
 * Pillar: OBSERVE
 *
 * Deterministic command contract and execution wrapper for tenant API smoke
 * runs. No process execution side-effects.
 */

import {
  buildSmokeFixtures,
  runTenantApiSmoke,
} from './tenant-api-smoke-fixture-runner.mjs';

/**
 * Build CLI command specification.
 * @returns {{ command:string, description:string, options:object[] }}
 */
export function buildSmokeCommandSpec() {
  return {
    command: 'frontieriq smoke tenant-api',
    description: 'Run deterministic tenant API smoke scenarios',
    options: [
      { name: '--generated-at', required: false, type: 'string' },
      { name: '--tenant-id', required: false, type: 'string' },
      { name: '--json', required: false, type: 'boolean' },
    ],
  };
}

/**
 * Parse argv list into command options.
 * @param {string[]} argv
 * @returns {{ generatedAt:string|null, tenantId:string|null, json:boolean }}
 */
export function parseSmokeCommandArgs(argv = []) {
  const args = Array.isArray(argv) ? argv : [];
  const read = name => {
    const index = args.indexOf(name);
    if (index < 0) return null;
    return args[index + 1] ?? null;
  };

  return {
    generatedAt: read('--generated-at'),
    tenantId: read('--tenant-id'),
    json: args.includes('--json'),
  };
}

/**
 * Format smoke result for CLI output.
 * @param {object} result
 * @param {{json:boolean}} options
 * @returns {string}
 */
export function formatSmokeCommandOutput(result, options = {}) {
  if (options.json) {
    return JSON.stringify(result, null, 2);
  }
  return [
    `allPassed: ${result.allPassed}`,
    `list: ${result.list.status}`,
    `get: ${result.get.status}`,
    `upsert: ${result.upsert.status}`,
    `readiness: ${result.readiness.status}`,
  ].join('\n');
}

/**
 * Execute smoke command contract.
 * @param {string[]} argv
 * @returns {{ exitCode:number, stdout:string, stderr:string, result:object }}
 */
export function executeSmokeCommand(argv = []) {
  const parsed = parseSmokeCommandArgs(argv);
  const generatedAt = parsed.generatedAt ?? '1970-01-01T00:00:00.000Z';
  const fixtures = buildSmokeFixtures(generatedAt);

  if (parsed.tenantId) {
    fixtures.userContext = { ...fixtures.userContext, tenantId: parsed.tenantId };
    fixtures.records = fixtures.records.map(record => ({
      ...record,
      tenantId: parsed.tenantId,
    }));
    fixtures.upsertPayload = { ...fixtures.upsertPayload, tenantId: parsed.tenantId };
  }

  const result = runTenantApiSmoke(fixtures);
  const stdout = formatSmokeCommandOutput(result, { json: parsed.json });
  return {
    exitCode: result.allPassed ? 0 : 1,
    stdout,
    stderr: '',
    result,
  };
}
