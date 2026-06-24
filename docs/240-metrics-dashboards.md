# Metrics dashboards

Implements issue #10 with deterministic dashboard contracts in `src/optimize/reporting/metrics-dashboards.mjs`.

## What is implemented

- `summarizeSignalFreshness()` extends the normalized signal layer with stale/fresh counts and workload freshness rollups.
- `summarizeAgentInvocations()` extends the agent registry layer with validated invocation totals, failure rates, and per-agent rollups.
- `summarizeLicenseUtilization()` introduces a dedicated optimization model for assigned, active, and provisioned seat analysis.
- `summarizeOvershareMetrics()` and `summarizeIngestionOperations()` turn existing incident and runtime outputs into dashboard KPI summaries.
- `buildOperationsDashboard()` assembles ingestion lag, index freshness, agent invocation, overshare, and readiness KPIs.
- `buildValueDashboard()` assembles ROI, license utilization, and KPI coverage/value-tracking metrics.
- `buildDashboardApiPayload()` publishes a Power BI / Fabric and REST-oriented integration contract.
- `validateDashboardApiPayload()` rejects incomplete or non-numeric KPI payloads before downstream rendering.

## Contract boundaries

- **Observe helpers** keep signal freshness and invocation rollups close to the contracts they summarize.
- **Optimization model** keeps license utilization validation and rate calculation outside the reporting layer.
- **Dashboard assembly** combines already-normalized summaries into operations and value views instead of recomputing raw platform logic.
- **API payload** wraps the two dashboards into one integration contract while preserving the distinct operations and value slices.

This split avoids shallow "dashboard" objects that simply mirror raw inputs without proving KPI calculations.

## Validation

- `tests/optimize/metrics-dashboards.test.mjs`
