# 930-access-anomaly-triage-contract — Access Anomaly Triage Contract

## Purpose

Deterministic identity anomaly severity scoring and response playbook mapping.

## Pillar: SECURE

## Module

`src/secure/permissions/access-anomaly-triage-contract.mjs`

## API

| Function | Description |
| --- | --- |
| `scoreAccessAnomaly(anomaly)` | Produces deterministic severity score and band per anomaly |
| `mapAccessAnomalyResponse(scored)` | Maps severity band to deterministic response playbook and SLA |
| `summarizeAccessAnomalyTriage(anomalies)` | Summarizes triage portfolio readiness and top anomaly |

## Tests

`tests/secure/access-anomaly-triage-contract.test.mjs`

