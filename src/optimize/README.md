# Optimize

Purpose: implement cost/value mapping, license utilization analysis, and prioritized recommendations.

Implemented foundation:

- unified showback dimensions (`model/showback-dimensions.mjs`)
- cost/value record model and summary builder (`model/cost-value-model.mjs`)
- license utilization record model and rate summary builder (`model/license-utilization.mjs`)
- anomaly detection helper for budget guardrails
- maturity scorecard (`model/maturity-scorecard.mjs`)
- next-best-action prioritization (`model/next-best-action-engine.mjs`)
- executive reporting payload (`reporting/executive-report.mjs`)
- metrics dashboard payloads for operations, value, Fabric/Power BI export, and REST integration (`reporting/metrics-dashboards.mjs`)
- capacity and cost forecasting for Work IQ/Fabric IQ/Foundry IQ (`planning/capacity-planning.mjs`)
- scenario use-case tracker + advisor (`planning/scenario-usecase-management.mjs`)
- tenant health trends contract for multi-period scorecard deltas and trend evidence (`reporting/tenant-health-trends-contract.mjs`)
- cost attribution adapter contract to map usage records to pillar-level cost/value evidence (`model/cost-attribution-adapter-contract.mjs`)
- coach action delivery contract for deterministic API/email/Teams packaging and routing (`delivery/coach-action-delivery-contract.mjs`)
- value realization contract for realized-vs-expected value trend health scoring (`reporting/value-realization-contract.mjs`)
- recommendation explainability contract for deterministic rationale traces and scoring-factor evidence (`delivery/recommendation-explainability-contract.mjs`)
- executive delta briefing contract for deterministic period-over-period variance briefings (`reporting/executive-delta-briefing-contract.mjs`)
- cross-tenant benchmark contract for deterministic cohort percentile benchmarking (`reporting/cross-tenant-benchmark-contract.mjs`)
- recommendation impact simulation contract for deterministic before/after KPI projection (`model/recommendation-impact-simulation-contract.mjs`)

Current state:

- optimization planning includes deterministic capacity forecast and budget pressure alerts
- executive reporting can include scenario portfolio, compliance, control-system, and privacy posture summaries
