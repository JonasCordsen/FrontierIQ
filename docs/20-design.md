# 20-design - Cross-solution Phase 1 MVP

## Scope

Phase 1 implements the cross-solution foundation for FrontierIQ with a focused MVP:

1. Microsoft 365 Copilot
2. Copilot Studio
3. Azure AI Foundry
4. Microsoft Fabric

This phase covers:

- canonical solution taxonomy
- normalized signal contract
- adapter interface and first four adapters
- adapter registry and unit tests

## Architecture slice

```text
Raw source payloads (solution-specific)
  -> adapter map(payload)
    -> normalized signal contract validation
      -> unified signal stream for OBSERVE/GOVERN/SECURE/OPTIMIZE
```

### Source-of-truth files

- `src/observe/foundation/solution-taxonomy.mjs`
- `src/observe/foundation/normalized-signal.mjs`
- `src/observe/adapters/types.mjs`
- `src/observe/adapters/index.mjs`
- `src/observe/adapters/{m365-copilot,copilot-studio,foundry,fabric}.mjs`

## Contract decisions

### Normalized signal (required fields)

- `tenantId`
- `solutionId`
- `workload`
- `resourceId`
- `source`
- `timestamp`
- `signalType`
- `severity`
- `confidence`
- `freshnessMinutes`
- `dimensions`
- `evidence`

### Adapter result contract

Adapters return a strict discriminated result:

- success: `{ ok: true, signals: [...] }`
- failure: `{ ok: false, code: "invalid_payload" | "mapping_error", errors: [...] }`

No silent drops or partial-success shape is allowed in this foundation layer.

## Extension checklist for new adapters

When adding a new Microsoft AI solution adapter:

1. Add the solution to `solution-taxonomy.mjs`.
2. Keep `solutionId` identical across taxonomy, adapter, and docs.
3. Implement adapter `map(payload)` using `types.mjs` base payload contract.
4. Validate output through `adapterSuccess()` so normalized signals are checked.
5. Register adapter in `adapters/index.mjs`.
6. Add tests:
   - one mapping success case
   - one invalid payload case
7. Update `docs/30-coverage-map.md`.

## Validation

Run unit tests:

```bash
node --test tests/observe/*.test.mjs
```

