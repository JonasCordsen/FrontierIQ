import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSmokeCommandSpec,
  parseSmokeCommandArgs,
  formatSmokeCommandOutput,
  executeSmokeCommand,
} from '../../src/observe/api/cli-smoke-command-contract.mjs';

describe('buildSmokeCommandSpec', () => {
  it('defines command and options', () => {
    const spec = buildSmokeCommandSpec();
    assert.equal(spec.command, 'frontieriq smoke tenant-api');
    assert.ok(spec.options.length >= 3);
  });
});

describe('parseSmokeCommandArgs', () => {
  it('parses generated-at and tenant-id and json', () => {
    const parsed = parseSmokeCommandArgs([
      '--generated-at',
      '2026-01-01T00:00:00.000Z',
      '--tenant-id',
      'tenant-b',
      '--json',
    ]);
    assert.equal(parsed.generatedAt, '2026-01-01T00:00:00.000Z');
    assert.equal(parsed.tenantId, 'tenant-b');
    assert.equal(parsed.json, true);
  });
});

describe('formatSmokeCommandOutput', () => {
  const sample = {
    allPassed: true,
    list: { status: 'success' },
    get: { status: 'success' },
    upsert: { status: 'success' },
    readiness: { status: 'success' },
  };

  it('formats text output', () => {
    const output = formatSmokeCommandOutput(sample, { json: false });
    assert.ok(output.includes('allPassed: true'));
  });

  it('formats json output', () => {
    const output = formatSmokeCommandOutput(sample, { json: true });
    assert.ok(output.includes('"allPassed": true'));
  });
});

describe('executeSmokeCommand', () => {
  it('returns successful execution for default fixtures', () => {
    const result = executeSmokeCommand([]);
    assert.equal(result.exitCode, 0);
    assert.equal(result.result.allPassed, true);
  });

  it('returns json output when --json is provided', () => {
    const result = executeSmokeCommand(['--json']);
    assert.ok(result.stdout.startsWith('{'));
  });
});
