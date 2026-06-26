# 990-current-state-view-contract — Current State View Contract

## Purpose

Provide a deterministic, runnable current-state snapshot so operators can view
cross-pillar state quickly from local CLI.

## Pillar: OBSERVE

## Modules

- `src/observe/api/current-state-view-contract.mjs`
- `src/observe/api/current-state-view-cli.mjs`

## API

| Function | Description |
| --- | --- |
| `buildCurrentStateFixtures(generatedAt)` | Builds deterministic sample fixtures for snapshot generation |
| `buildCurrentStateSnapshot(fixtures)` | Produces cross-pillar current-state snapshot object |
| `formatCurrentStateSnapshot(snapshot, options)` | Formats snapshot as text or JSON |
| `executeCurrentStateViewCommand(argv)` | Executes deterministic command contract for current-state view |

## Run

```bash
node src/observe/api/current-state-view-cli.mjs
node src/observe/api/current-state-view-cli.mjs --json
```

## Tests

`tests/observe/current-state-view-contract.test.mjs`

