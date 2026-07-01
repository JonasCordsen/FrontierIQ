# Scenario Library Integration (Include, Track, Advise)

FrontierIQ can operationalize Microsoft Scenario Library use cases as a tenant coaching input, not just a static slide source.

## What was analyzed

From `https://copilotscenarios.microsoft.com`:

- Scenario generation/download path is backed by:
  - `/ScenarioIndustryRoleLogic`
  - `/_api/cr974_copilotscenarios`
- Use cases are filterable by:
  - function/industry
  - product
  - scenario level (effort rating): Start, Buy, Extend, Build
  - asset type
  - frontline worker
  - prompt gallery linkage
  - demo video availability
- Product feature flags include:
  - Azure AI Foundry
  - M365 Copilot
  - Security Copilot
  - Copilot Studio Agents
  - Power Platform
  - Dynamics 365 Copilot
  - GitHub Copilot

## FrontierIQ integration model

### 1) Include (OBSERVE)

File: `src/observe/adapters/scenario-library.mjs`

- Normalizes scenario rows into a canonical `useCase` shape.
- Maps product feature flags to FrontierIQ `solutionId` taxonomy.
- Projects normalized use cases into FrontierIQ `NormalizedSignal` records.

Live ingestion implementation:

- `src/observe/ingestion/scenario-library-ingestion.mjs`
  - API client for:
    - `/_api/cr974_copilotscenarios`
    - `/ScenarioIndustryRoleLogic`
  - ingestion cycle that builds snapshots (use cases, signals, tracker)
  - checksum-based deduplication
  - scheduler helper for periodic ingestion jobs
  - runtime pipeline wrapper that stages raw artifacts, prepares Foundry handoff batches, and emits latency/cost telemetry

- `src/observe/ingestion/runtime-pipeline.mjs`
  - shared tenant-scoped trigger contracts for webhook and reconciliation flows
  - Blob/OneLake raw-staging targets
  - Graph delta checkpoint reconciliation helper
  - Foundry handoff batch contract
  - runtime latency/cost summary helper

### 2) Track (OPTIMIZE)

File: `src/optimize/planning/scenario-usecase-management.mjs`

- Initializes tenant/business-unit use case trackers.
- Tracks lifecycle status: `candidate`, `planned`, `in_progress`, `adopted`, `retired`.
- Stores KPI linkage (name, baseline, target) per selected use case.
- Summarizes adoption and KPI coverage for leadership reporting.
- Preserves tracker lifecycle/KPI state across refreshed ingestions (`mergeUseCaseTracker`).

### 3) Advise (OPTIMIZE + GOVERN/SECURE weighting)

File: `src/optimize/planning/scenario-usecase-management.mjs`

- Converts tracked scenarios into prioritized actions with existing FrontierIQ priority scoring.
- Weights recommendations by:
  - scenario effort level (Start/Buy/Extend/Build)
  - inferred pillar relevance from functional area
  - confidence proxy from prompt-gallery/demo availability

## Why this is the right fit

- Keeps Scenario Library as an input source while FrontierIQ remains the coaching/governance layer.
- Aligns directly to existing FrontierIQ foundations:
  - normalized signals
  - maturity/prioritization engine
  - multi-solution taxonomy
- Supports business unit value plans with measurable KPI targets instead of static content downloads.

## Test coverage

- `tests/observe/scenario-library-adapter.test.mjs`
- `tests/observe/scenario-library-ingestion.test.mjs`
- `tests/observe/runtime-pipeline.test.mjs`
- `tests/optimize/scenario-usecase-management.test.mjs`
