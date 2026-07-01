# FrontierIQ Module 4 Follow-Through: Governance Operations and Capacity Planning

This slice implements the remaining Module 4 stories #37, #39, #40, #41, and #42.

## Implemented modules

### GOVERN: Approval Board process (#37)

File: `src/govern/operations/approval-board.mjs`

- Required reviewer set for medium/high-risk changes:
  - `securityRepresentative`
  - `complianceRepresentative`
  - `responsibleAiLead`
  - `coeLead`
- Deterministic decision outcomes:
  - `approved`
  - `needs_more_review`
  - `rejected`
  - `escalate` (for high-risk requests after required approvals)
- Evidence reference enforcement on each request.

### GOVERN: Lifecycle + periodic attestation (#39)

File: `src/govern/operations/lifecycle-attestation.mjs`

- Lifecycle states:
  - `draft -> pilot -> approved -> production -> deprecated -> archived`
- Explicit allowed transition map with validation.
- Periodic attestation due finder based on `lastAttestedAt + cadenceDays`.

### OBSERVE/GOVERN: Agent registry and skills catalog (#40)

File: `src/observe/registry/agent-skill-registry.mjs`

- Agent-level registry with:
  - owner
  - solution
  - risk band
  - last attestation timestamp
  - skills list (permissions + status)
- Query filters for owner, risk band, and solution.

### SECURE/GOVERN: CI/CD skill validators (#41)

File: `src/govern/validators/skill-manifest-validator.mjs`

- Manifest shape validation for skill metadata and test status.
- High-risk scope detection using SECURE rules (`src/secure/permissions/high-risk-rules.mjs`).
- Enforces approval ticket for high-risk scopes/risk band.
- Risk summary helper for pipeline/reporting integration.

### OPTIMIZE: Cost and capacity planning (#42)

File: `src/optimize/planning/capacity-planning.mjs`

- Workload forecast for:
  - `work-iq`
  - `fabric-iq`
  - `foundry-iq`
- Multi-month request, capacity-unit, and cost projection.
- Budget pressure detection against configurable threshold.

## Test coverage

- `tests/govern/approval-board-and-lifecycle.test.mjs`
- `tests/govern/registry-and-validator.test.mjs`
- `tests/optimize/capacity-planning.test.mjs`

