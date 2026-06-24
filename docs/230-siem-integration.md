# SIEM integration

Implements issue #15 with deterministic SIEM forwarding and incident playbook contracts in `src/secure/siem/siem-integration.mjs`.

## What is implemented

- `buildSiemConnectorRegistration()` models Sentinel and other SIEM connector registrations, supported event kinds, and severity thresholds.
- `buildGovernanceDecisionSiemEvent()` normalizes governance decision traces into SIEM-ready audit or incident events.
- `buildOvershareIncidentSiemEvent()` normalizes overshare assessment outputs into containment-oriented SIEM events.
- `buildOvershareEnforcementSiemEvent()` keeps enforcement decisions separate from incidents so throttle and suspend actions can route independently.
- `buildIncidentRoutingPlan()` defines deterministic event-kind, outcome, and severity routing into audit or incident destinations.
- `buildIncidentPlaybookCatalog()` publishes typed revocation and containment playbooks with explicit responder actions.
- `summarizeSiemReadiness()` fails closed unless connector support, route coverage, and playbook coverage form a complete loop for produced event types.

## Contract boundaries

- **Connector registration** answers: "Which SIEM receives FrontierIQ events, and which event kinds and severities are allowed through?"
- **Event normalization** answers: "How do governance, overshare incident, and overshare enforcement records become stable SIEM payloads?"
- **Routing** answers: "Which queue, destination, and playbook should receive a given event kind and outcome?"
- **Playbooks** answers: "What typed operator actions must happen for containment or revocation?"
- **Readiness** answers: "Can every produced event type actually reach a route and a compatible playbook?"

The enforcement stream stays separate from the incident stream on purpose. Overshare detection already emits independent incident and enforcement artifacts, so the SIEM layer preserves that split instead of burying enforcement as optional nested data.

## Evidence alignment

SIEM operations extend the audit evidence spine with:

- `evidence/siem-connector-config.json`
- `evidence/siem-alert-routing.json`
- `evidence/incident-playbooks.json`

These artifacts are now mapped into audit traceability automation so compliance and operator response posture stay aligned.

## Validation

- `tests/secure/siem-integration.test.mjs`
- updated `tests/govern/audit-readiness.test.mjs`
