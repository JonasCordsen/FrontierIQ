# 640-tenant-repository-persistence-adapter — Tenant Repository Persistence Adapter

## Purpose

Deterministic snapshot serialization/deserialization contract for in-memory
tenant repository data.

## Pillar: GOVERN

## Module

`src/govern/tenant/tenant-repository-persistence-adapter.mjs`

## API

| Function | Description |
| --- | --- |
| `serializeRepositorySnapshot(repository, generatedAt)` | Serializes validated records to snapshot JSON |
| `deserializeRepositorySnapshot(snapshot)` | Restores repository and metadata from snapshot JSON |
| `buildRepositorySnapshotArtifact(repository, generatedAt)` | Wraps serialized snapshot as publishable artifact |

## Snapshot properties

- `schemaVersion`
- `generatedAt`
- `recordCount`
- `records[]`

## Tests

`tests/govern/tenant-repository-persistence-adapter.test.mjs`

