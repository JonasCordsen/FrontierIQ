# 20-design - FrontierIQ Enterprise Architecture

## Purpose

FrontierIQ is a coaching platform for IT administrators managing Microsoft 365 Copilot and Copilot agents. It surfaces deterministic, evidence-backed recommendations across four pillars:

- **OBSERVE** — usage visibility, agent activity, and performance signals
- **GOVERN** — guardrails, onboarding, compliance, and retention policies
- **SECURE** — agent identity, access control, oversharing prevention, and threat defense
- **OPTIMIZE** — cost/value mapping, license utilization, and prioritized recommendations

## System architecture

```text
Microsoft Graph / Solution APIs (per-tenant, on-demand)
  |
  v
OBSERVE — normalized signal ingestion + adapter layer
  |
  +-> GOVERN  — policy evaluation, approval gates, lifecycle attestation
  |
  +-> SECURE  — identity graph, oversharing detection, privacy posture, SIEM
  |
  +-> OPTIMIZE — cost/value model, maturity scorecard, executive reporting
```

All data access is on-demand. No raw tenant payload is stored permanently.
FrontierIQ may persist its own control-plane metadata (for example tenant
registry, RBAC mappings, waiver state, and refresh checkpoints) without
persisting customer-source raw payloads.

---

## Pillar: OBSERVE (`src/observe/`)

### Foundation

| Module | Purpose |
| --- | --- |
| `foundation/solution-taxonomy.mjs` | Canonical 12-solution catalog, MVP phase flags, `isKnownSolution()` |
| `foundation/normalized-signal.mjs` | Normalized signal contract, validator, freshness rollup |

### Adapters (`adapters/`)

Each adapter accepts a solution-specific raw payload and emits `NormalizedSignal[]`.

| Adapter | Solution |
| --- | --- |
| `m365-copilot.mjs` | Microsoft 365 Copilot — Graph Reports/Audit |
| `copilot-studio.mjs` | Copilot Studio — agent metadata |
| `foundry.mjs` | Azure AI Foundry — ARM + Foundry APIs |
| `fabric.mjs` | Microsoft Fabric — Fabric/capacity APIs |
| `scenario-library.mjs` | Microsoft Scenario Library use-case catalog |
| `index.mjs` | Adapter registry map with `isKnownAdapter()` |

Adapter result contract: `{ ok: true, signals } | { ok: false, code, errors }`. No silent drops.

### Ingestion (`ingestion/`)

| Module | Purpose |
| --- | --- |
| `runtime-pipeline.mjs` | Webhook intake, delta reconciliation, raw staging, Foundry handoff, duplicate suppression |
| `foundry-iq-connector.mjs` | Knowledge base/index/source contracts, ACL/Purview validation, query response |
| `scenario-library-ingestion.mjs` | Scenario Library snapshot, deduplication, use-case tracking |

### Integration (`integration/`)

| Module | Purpose |
| --- | --- |
| `fabric-iq.mjs` | Fabric registration, NL2Ontology validation, semantic model access, readiness |
| `work-iq.mjs` | Work IQ OBO/delegated access, Ask validation, user-context query contracts |

### Registry

| Module | Purpose |
| --- | --- |
| `registry/agent-skill-registry.mjs` | Agent/skill registry, invocation summary, manifest validation |

---

## Pillar: GOVERN (`src/govern/`)

### Policy

| Module | Purpose |
| --- | --- |
| `policy/control-catalog.mjs` | 17 canonical control IDs and descriptions |
| `policy/evidence-mapping.mjs` | Control → evidence artifact mappings |
| `policy/baseline-library.mjs` | Per-solution baseline profiles, `validatePolicyProfile()` |
| `policy/policy-catalog.mjs` | Machine-readable governance policy catalog for CI/CD, onboarding, ingestion |

### Enforcement

| Module | Purpose |
| --- | --- |
| `enforcement/policy-evaluator.mjs` | AGT-aligned deterministic policy evaluator (allow/deny/escalate) |
| `enforcement/audit-trace.mjs` | Structured governance decision traces |

### Identity

| Module | Purpose |
| --- | --- |
| `identity/identity-permission-graph.mjs` | Permission graph nodes/edges, high-risk matcher, principal query |
| `identity/from-normalized-signals.mjs` | Identity graph construction from normalized signals |

### Onboarding

| Module | Purpose |
| --- | --- |
| `onboarding/tenant-onboarding.mjs` | Deterministic onboarding bundle, Key Vault manifest, script pack, readiness summary |

### Compliance

| Module | Purpose |
| --- | --- |
| `compliance/m365-copilot-compliance.mjs` | Certification inventory, control mapping, evidence gap reporting |
| `compliance/audit-readiness.mjs` | Gap analysis, evidence automation planning, audit readiness pack |

### Control system

| Module | Purpose |
| --- | --- |
| `control-system/m365-copilot-control-system.mjs` | Lesson 2 RBAC, Key Vault, CI/CD, and onboarding control posture |

### Validators

| Module | Purpose |
| --- | --- |
| `validators/skill-manifest-validator.mjs` | CI/CD manifest validator, high-risk scope enforcement |

### Operations

| Module | Purpose |
| --- | --- |
| `operations/approval-board.mjs` | Approval request model, reviewer gates, escalation decision |
| `operations/lifecycle-attestation.mjs` | Lifecycle state machine, `findDueAttestations()` |
| `operations/operator-playbooks.mjs` | Deterministic runbooks: onboarding, incident, token rotation, index rehydration, suspend/revoke |
| `operations/support-model.mjs` | L1/L2/L3 tier model, severity escalation, SLA catalog |
| `operations/agent365-evaluation-roadmap.mjs` | Agent 365 capability catalog, evaluation criteria, decision gates, roadmap |
| `operations/governance-matrix-risk-taxonomy.mjs` | Risk bands, governance matrix, attestation cadence policy |

### Operating model

| Module | Purpose |
| --- | --- |
| `operating-model/kit.mjs` | Enterprise operating model kit, CoE/RACI/attestation/exception/audit-pack baseline |
| `operating-model/agents-coe.mjs` | CoE charter, role model, operating cadence, onboarding template, readiness |
| `operating-model/training-and-communications.mjs` | Audience segmentation, curriculum, enablement artifacts, rollout phases |
| `operating-model/org-roles-raci.mjs` | Organization role catalog, RACI workstream assignments |

---

## Pillar: SECURE (`src/secure/`)

| Module | Purpose |
| --- | --- |
| `permissions/high-risk-rules.mjs` | High-risk permission rules, role segregation checks |
| `privacy/m365-copilot-privacy-posture.mjs` | Lesson 3 privacy profile, PII detection/redaction, residency/Purview/consent/retention posture |
| `overshare/overshare-detection.mjs` | Ingestion/query overshare scanning, risk scoring, enforcement (warn/throttle/suspend) |
| `siem/siem-integration.mjs` | SIEM connector registration, event normalization, routing, incident playbooks, readiness |

---

## Pillar: OPTIMIZE (`src/optimize/`)

### Model

| Module | Purpose |
| --- | --- |
| `model/cost-value-model.mjs` | Cost attribution, value mapping, aggregate cost/value summary |
| `model/showback-dimensions.mjs` | Showback dimension validation |
| `model/license-utilization.mjs` | Assigned/active/provisioned seat analytics |
| `model/maturity-scorecard.mjs` | Maturity scoring by pillar |
| `model/next-best-action-engine.mjs` | Prioritized recommendation engine (impact × risk × effort × confidence) |

### Planning

| Module | Purpose |
| --- | --- |
| `planning/capacity-planning.mjs` | Capacity forecasting, budget pressure detection, anomaly detection |
| `planning/scenario-usecase-management.mjs` | Use-case portfolio tracking, scenario library integration |

### Reporting

| Module | Purpose |
| --- | --- |
| `reporting/executive-report.mjs` | Executive summary payload, topline KPIs, top recommendations |
| `reporting/metrics-dashboards.mjs` | Operations/value dashboard assembly, overshare/ingestion/license KPIs, API payload |

---

## Key design decisions

1. **No persistent customer data.** All processing is on-demand per tenant.
   Raw source payloads are never stored. Only FrontierIQ-owned control-plane
   metadata and derived evidence summaries may be persisted when needed.
2. **Deterministic contracts.** Every module exports pure functions with explicit validated inputs and outputs. No implicit side effects.
3. **Fail-closed readiness.** Every readiness summary defaults to `blocked` unless all required checks pass.
4. **Single-tenant and multi-tenant from the start.** Every signal and contract carries `tenantId`.
5. **Pillar mapping required.** Every feature maps to exactly one primary pillar: OBSERVE / GOVERN / SECURE / OPTIMIZE.
6. **Evidence-backed controls.** Every governance control maps to at least one auditable evidence artifact.
7. **Adapter discriminated results.** No silent drops — adapters return `ok: true | ok: false` explicitly.

## Tenancy model

```text
Tenant = customer Microsoft 365 environment
  tenantId carried on every signal, decision trace, and evidence artifact
  No cross-tenant data sharing
  Single-tenant and multi-tenant auth modes both supported from initial design
```

## Auth and API surface

| Layer | Mechanism |
| --- | --- |
| Entra app registration | Application permissions (`Reports.Read.All`, `User.Read.All`, `AuditLog.Read.All`) |
| Credentials | Key Vault-managed secrets with rotation policy |
| Token scope | On-demand token acquisition per tenant, never persisted |
| Ingestion trigger | Webhook or scheduled delta reconciliation |

## Validation

```bash
node --test
```

155 tests, 0 failures as of 2026-06-24.
