# 820-policy-drift-detector-contract — Policy Drift Detector Contract

## Purpose

Deterministic baseline/runtime policy-control drift detection and readiness
summary.

## Pillar: GOVERN

## Module

`src/govern/policy/policy-drift-detector-contract.mjs`

## API

| Function | Description |
| --- | --- |
| `detectPolicyDrift(baselinePolicies, runtimePolicies)` | Computes missing/unexpected controls per policy |
| `summarizePolicyDrift(drifts)` | Builds drift posture summary and status |
| `buildPolicyDriftEvidence(drifts, generatedAt)` | Generates evidence envelope for drift review |

## Tests

`tests/govern/policy-drift-detector-contract.test.mjs`

