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
- `tests/govern/audit-readiness.test.mjs`
- `tests/govern/operator-playbooks.test.mjs`
- `tests/govern/support-model.test.mjs`
- `tests/govern/agent365-evaluation-roadmap.test.mjs`
- `tests/optimize/cost-value-model.test.mjs`
- `tests/optimize/maturity-and-priority.test.mjs`
- `tests/optimize/executive-report.test.mjs`
- `tests/optimize/metrics-dashboards.test.mjs`
- `tests/optimize/capacity-planning.test.mjs`
- `tests/optimize/scenario-usecase-management.test.mjs`
- `tests/secure/m365-copilot-privacy-posture.test.mjs`
- `tests/secure/overshare-detection.test.mjs`
- `tests/secure/siem-integration.test.mjs`

Run:

```bash
node --test $(find tests -name '*.test.mjs' | sort)
```
