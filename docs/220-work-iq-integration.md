# Work IQ integration

Implements issue #9 with deterministic contracts in `src/observe/integration/work-iq.mjs`.

## What is implemented

- `buildWorkIqRegistration()` models Work IQ registration, supported user-context sources, delegated scopes, and the derived admin-consent URL for onboarding.
- `buildWorkIqUserContextAccessContract()` combines OBO token flow, delegated scope type, principal binding, and consent state into one user-context access contract.
- `validateWorkIqAskRequest()` verifies `WorkIQAgent.Ask` request shape, user-context requirements, and requested sources.
- `validateWorkIqUserContextQuery()` checks source-specific user-context authorization for:
  - mail
  - calendar
  - Teams
- `buildWorkIqRegistryEntry()` produces a registry-compatible entry through the existing agent/skill registry layer.
- `summarizeWorkIqReadiness()` rolls the integration into ready/blocked checks linked to governance controls and shared policy version metadata.

## Contract boundaries

- **Registration** covers tool metadata, supported sources, and onboarding consent shape.
- **User-context access** covers principal type, OBO flow, delegated scope kind, and consent satisfaction.
- **Ask validation** covers `WorkIQAgent.Ask` request semantics.
- **Query validation** covers source-specific permission matching for mail, calendar, and Teams.

This split keeps A2A-style registration separate from actual delegated user-context readiness.

## Validation

- `tests/observe/work-iq.test.mjs`
