# Govern

Purpose: implement guardrails, onboarding flows, compliance checks, and retention policies.

Implemented foundation (Phase 2 start):

- unified identity and permission graph model (`identity/identity-permission-graph.mjs`)
- graph construction from normalized observe signals (`identity/from-normalized-signals.mjs`)
- query helpers for principal-permission edges and risk scans
- policy baseline library (`policy/baseline-library.mjs`)
- control catalog and evidence mappings (`policy/control-catalog.mjs`, `policy/evidence-mapping.mjs`)
- shared machine-readable policy catalog for CI/CD, onboarding, and ingestion governance (`policy/policy-catalog.mjs`)
- AGT-aligned deterministic enforcement evaluator (`enforcement/policy-evaluator.mjs`)
- structured decision traces (`enforcement/audit-trace.mjs`)
- enterprise operating model kit (`operating-model/kit.mjs`)
- Agents CoE charter, role model, operating cadence, and onboarding templates (`operating-model/agents-coe.mjs`)
- training audience segmentation, curriculum contracts, enablement artifacts, and rollout communications readiness (`operating-model/training-and-communications.mjs`)
- organization role catalog and deterministic RACI matrix with fail-closed readiness checks (`operating-model/org-roles-raci.mjs`)
- approval board workflow model and reviewer gates (`operations/approval-board.mjs`)
- lifecycle transition and periodic attestation helpers (`operations/lifecycle-attestation.mjs`)
- deterministic operator runbook templates and execution contracts for onboarding, incident response, token rotation, index rehydration, and tenant suspend/revoke (`operations/operator-playbooks.mjs`)
- deterministic L1/L2/L3 support model, severity escalation policy, SLA targets, and readiness checks (`operations/support-model.mjs`)
- deterministic Agent 365 capability evaluation, weighted criteria, decision gates, and integration-roadmap readiness contracts (`operations/agent365-evaluation-roadmap.mjs`)
- deterministic governance matrix and risk taxonomy contracts for risk bands, review gates, policy mapping, and attestation cadence (`operations/governance-matrix-risk-taxonomy.mjs`)
- skill manifest CI/CD validator with high-risk scope checks (`validators/skill-manifest-validator.mjs`)
- M365 Copilot compliance certification inventory, control mapping, and evidence gap reporting (`compliance/m365-copilot-compliance.mjs`)
- compliance gap analysis, evidence automation planning, and audit readiness pack (`compliance/audit-readiness.mjs`)
- M365 Copilot Lesson 2 control-system posture, onboarding, RBAC, Key Vault, and CI/CD bundle (`control-system/m365-copilot-control-system.mjs`)
- deterministic tenant onboarding bundle for app registration, Key Vault provisioning, resource templates, and onboarding scripts (`onboarding/tenant-onboarding.mjs`)
- tenant onboarding workflow checkpoints and execution summary contract (`onboarding/tenant-onboarding-workflow-contract.mjs`)
- compliance evidence export bundle contract for attestation workflows (`compliance/compliance-evidence-export-contract.mjs`)
- attestation window scheduling and overdue classification contract (`compliance/attestation-window-contract.mjs`)
- deterministic governance rules engine contract for risk/control/reviewer decisioning (`operations/governance-rules-engine-contract.mjs`)
- governance exception lifecycle and approval workflow contract (`operations/governance-exception-workflow-contract.mjs`)

Current state:

- governance operations slice for approval + lifecycle is implemented and covered by tests
- governance operations now include deterministic operator playbook contracts for incident and lifecycle response workflows
- governance operating-model layer now includes deterministic cross-functional Agents CoE contracts
