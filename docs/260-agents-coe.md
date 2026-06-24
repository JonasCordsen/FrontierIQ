# Agents Center of Excellence (CoE)

Implements issue #16 with deterministic CoE contracts in `src/govern/operating-model/agents-coe.mjs`.

## What is implemented

- `buildAgentsCoeCharter()` defines mission, scope, and value/risk success measures for the CoE.
- `buildAgentsCoeRoleModel()` defines cross-disciplinary role assignments and responsibilities for security, compliance, data, engineering, change management, and business ownership.
- `buildAgentsCoeOperatingCadence()` defines weekly, monthly, and quarterly CoE ceremonies.
- `buildAgentsCoeOnboardingTemplate()` defines mandatory onboarding template sections, artifacts, and required approval roles.
- `summarizeAgentsCoeReadiness()` provides fail-closed readiness checks for charter approval, role coverage, operating cadence, and onboarding-template completeness.

## Contract boundaries

- **Charter** answers: why the CoE exists and which outcomes it owns.
- **Role model** answers: who owns each cross-functional governance and delivery responsibility.
- **Operating cadence** answers: when CoE governance and value/risk reviews run.
- **Onboarding template** answers: what every new agent use case must provide before progression.
- **Readiness** answers: whether the CoE is actually operational vs partially defined.

## Validation

- `tests/govern/agents-coe.test.mjs`
