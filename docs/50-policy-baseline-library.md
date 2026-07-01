# 50-policy-baseline-library - Cross-solution governance baselines

This document defines the Phase 2 policy baseline library and evidence mapping model.

## Goal

Provide reusable policy baseline profiles per Microsoft AI solution so governance controls are:

- consistent across solutions
- explicitly versioned
- mapped to auditable evidence artifacts

## Source files

- `src/govern/policy/control-catalog.mjs`
- `src/govern/policy/evidence-mapping.mjs`
- `src/govern/policy/baseline-library.mjs`

## Baseline structure

Each profile contains:

- `solutionId`
- `profileVersion`
- `controls[]` where each control includes:
  - `controlId`
  - `enforcementLevel`
  - `rationale`
  - `evidenceArtifacts[]`

## Required baseline controls

1. least privilege
2. owner accountability
3. data residency enforcement
4. retention policy
5. audit traceability
6. approval gates
7. responsible AI review

## Evidence mapping

Each control maps to one or more evidence artifacts such as:

- access review exports
- owner registry
- residency config
- retention policy
- audit logs
- approval decision logs
- RAI assessment report

## Validation

```bash
node --test tests/observe/*.test.mjs tests/govern/*.test.mjs
```

