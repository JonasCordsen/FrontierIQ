# Secure

Purpose: implement agent identity checks, access control evaluations, and oversharing detection.

Implemented baseline:

- high-risk permission matcher rules (`permissions/high-risk-rules.mjs`)
- M365 Copilot Lesson 3 privacy posture for residency, Purview labels, PII detection, consent, and retention (`privacy/m365-copilot-privacy-posture.mjs`)
- overshare detection contracts for ingestion scanning, query exposure scoring, and deterministic throttle/suspend workflows (`overshare/overshare-detection.mjs`)
- overshare incident priority scoring and triage queue contract (`overshare/incident-priority-contract.mjs`)
- SIEM integration contracts for governance decisions, overshare incidents, alert routing, and typed revocation/containment playbooks (`siem/siem-integration.mjs`)

Next:

- connect SIEM outputs into downstream dashboards and tenant-level incident reporting surfaces
