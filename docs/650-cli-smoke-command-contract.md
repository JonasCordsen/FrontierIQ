# 650-cli-smoke-command-contract — CLI Smoke Command Contract

## Purpose

Deterministic command contract for local execution of tenant API smoke scenarios.

## Pillar: OBSERVE

## Module

`src/observe/api/cli-smoke-command-contract.mjs`

## API

| Function | Description |
| --- | --- |
| `buildSmokeCommandSpec()` | Defines CLI command metadata and options |
| `parseSmokeCommandArgs(argv)` | Parses deterministic command options |
| `formatSmokeCommandOutput(result, options)` | Formats text or JSON output |
| `executeSmokeCommand(argv)` | Executes fixture-based smoke run and returns exit payload |

## Command

`frontieriq smoke tenant-api`

## Supported options

- `--generated-at`
- `--tenant-id`
- `--json`

## Tests

`tests/observe/cli-smoke-command-contract.test.mjs`

