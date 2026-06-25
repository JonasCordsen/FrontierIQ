# Tests

Test harness and fixtures. Add unit/integration tests for Graph ingestion and recommendation logic.

Current unit suites:

- `tests/observe/solution-taxonomy.test.mjs`
- `tests/observe/normalized-signal.test.mjs`
- `tests/observe/adapters.test.mjs`
- `tests/observe/scenario-library-adapter.test.mjs`
- `tests/observe/scenario-library-ingestion.test.mjs`
- `tests/observe/fabric-iq.test.mjs`
- `tests/observe/work-iq.test.mjs`
- `tests/observe/runtime-pipeline.test.mjs`
- `tests/observe/foundry-iq-connector.test.mjs`
- `tests/observe/performance-metrics-contract.test.mjs`
- `tests/observe/signal-quality-gate-contract.test.mjs`
- `tests/observe/source-health-contract.test.mjs`
- `tests/observe/tenant-insights-api-contract.test.mjs`
- `tests/observe/tenant-insights-diff-contract.test.mjs`
- `tests/govern/identity-permission-graph.test.mjs`
- `tests/govern/policy-baseline-library.test.mjs`
- `tests/govern/policy-evaluator.test.mjs`
- `tests/govern/operating-model-kit.test.mjs`
- `tests/govern/agents-coe.test.mjs`
- `tests/govern/training-and-communications.test.mjs`
- `tests/govern/approval-board-and-lifecycle.test.mjs`
- `tests/govern/registry-and-validator.test.mjs`
- `tests/govern/m365-copilot-compliance.test.mjs`
- `tests/govern/m365-copilot-control-system.test.mjs`
- `tests/govern/policy-catalog.test.mjs`
- `tests/govern/tenant-onboarding.test.mjs`
- `tests/govern/tenant-onboarding-workflow-contract.test.mjs`
- `tests/govern/audit-readiness.test.mjs`
- `tests/govern/compliance-evidence-export-contract.test.mjs`
- `tests/govern/attestation-window-contract.test.mjs`
- `tests/govern/operator-playbooks.test.mjs`
- `tests/govern/support-model.test.mjs`
- `tests/govern/agent365-evaluation-roadmap.test.mjs`
- `tests/govern/org-roles-raci.test.mjs`
- `tests/govern/governance-matrix-risk-taxonomy.test.mjs`
- `tests/govern/governance-rules-engine-contract.test.mjs`
- `tests/govern/governance-exception-workflow-contract.test.mjs`
- `tests/govern/policy-drift-detector-contract.test.mjs`
- `tests/govern/review-cadence-orchestrator-contract.test.mjs`
- `tests/optimize/cost-value-model.test.mjs`
- `tests/optimize/cost-attribution-adapter-contract.test.mjs`
- `tests/optimize/maturity-and-priority.test.mjs`
- `tests/optimize/executive-report.test.mjs`
- `tests/optimize/metrics-dashboards.test.mjs`
- `tests/optimize/capacity-planning.test.mjs`
- `tests/optimize/scenario-usecase-management.test.mjs`
- `tests/optimize/tenant-health-trends-contract.test.mjs`
- `tests/optimize/coach-action-delivery-contract.test.mjs`
- `tests/optimize/value-realization-contract.test.mjs`
- `tests/secure/m365-copilot-privacy-posture.test.mjs`
- `tests/secure/overshare-detection.test.mjs`
- `tests/secure/incident-priority-contract.test.mjs`
- `tests/secure/data-minimization-contract.test.mjs`
- `tests/secure/siem-integration.test.mjs`

Run:

```bash
node --test $(find tests -name '*.test.mjs' | sort)
```
