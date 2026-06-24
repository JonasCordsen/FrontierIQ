# Overshare detection

Implements issue #6 by adding deterministic overshare detection contracts in `src/secure/overshare/overshare-detection.mjs`.

## What is implemented

- `buildOvershareDetectorCatalog()` publishes the sample detector set used for ingestion-time and query-time evaluation.
- `buildIngestionOvershareAssessment()` scans staged source documents and indexed chunks for hashed PII findings, ACL drift, and Purview label drift without persisting raw sensitive values.
- `buildQueryOvershareAssessment()` evaluates generated answers and returned hits separately from source risk so FrontierIQ can distinguish latent corpus risk from actual surfaced exposure.
- `evaluateOvershareEnforcement()` turns an overshare incident into a deterministic workflow recommendation: `allow`, `warn`, `review`, `throttle`, or `suspend`.

## Contract boundaries

- **Ingestion assessment** answers: "Is risky content present in source/indexed data, and are labels/ACLs drifting?"
- **Query assessment** answers: "Did a specific answer or hit actually surface sensitive data, and was it blocked or redacted?"
- **Enforcement decision** answers: "Given incident severity, exposure state, and prior workflow state, what should the next control action be?"

This split avoids double-counting the same risk across indexing and retrieval.

## Evidence alignment

Overshare outputs extend the governance evidence spine with:

- `evidence/overshare-incidents.ndjson`
- `evidence/overshare-enforcement-decisions.ndjson`

These artifacts are now included in audit-readiness automation so the privacy and access controls remain traceable.

## Validation

- `tests/secure/overshare-detection.test.mjs`
- updated `tests/observe/foundry-iq-connector.test.mjs` coverage through normalized hit-level enforcement fields
