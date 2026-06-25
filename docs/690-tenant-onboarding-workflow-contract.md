# 690-tenant-onboarding-workflow-contract — Tenant Onboarding Workflow Contract

## Purpose

Deterministic onboarding workflow planning and checkpoint execution summary for
tenant setup readiness.

## Pillar: GOVERN

## Module

`src/govern/onboarding/tenant-onboarding-workflow-contract.mjs`

## API

| Function | Description |
| --- | --- |
| `buildOnboardingWorkflowPlan(requestInput, generatedAt)` | Validates onboarding request and builds checkpoint plan |
| `evaluateOnboardingWorkflowCheckpoints(plan, executions)` | Resolves checkpoint execution statuses with fail-closed unknown checkpoint handling |
| `summarizeOnboardingWorkflowOutcome(plan, evaluation)` | Produces checkpoint counts and activation readiness summary |

## Workflow checkpoints

- validate-request
- approval-gate
- provisioning-bundle
- evidence-bundle

## Tests

`tests/govern/tenant-onboarding-workflow-contract.test.mjs`

