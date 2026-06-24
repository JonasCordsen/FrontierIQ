# 100-executive-reporting - Executive summary output contract

This document defines the executive reporting output introduced after Phase 1-3 model delivery.

## Objective

Provide a compact reporting payload that combines:

1. maturity summary
2. cost/value topline
3. prioritized next-best-actions
4. scenario portfolio adoption and KPI coverage (optional)
5. M365 Copilot compliance posture summary (optional)

## Source files

- `src/optimize/reporting/executive-report.mjs`
- `src/optimize/reporting/index.mjs`
- `tests/optimize/executive-report.test.mjs`

## Report payload

`buildExecutiveReport()` returns:

- `version`
- `generatedAt`
- `topline`:
  - `tenants`
  - `maturityOverall`
  - `totalCost`
  - `totalValuePoints`
  - `roiIndex`
- `keyRecommendations[]` (top 5 by priority)
- `scenarioPortfolio` (optional):
  - `tenantId`
  - `businessUnit`
  - `totalUseCases`
  - `byStatus`
  - `withKpi`
  - `kpiCoverage`
  - `byScenarioLevel`
- `complianceSummary` (optional):
  - `solutionId`
  - `totalCertifications`
  - `mappedCertifications`
  - `controlCoveragePercent`
  - `requiredControls`
  - `missingControls`
  - `keyGaps`

## Validation

`validateExecutiveReport()` enforces:

- version presence
- valid ISO timestamp
- topline object presence
- recommendation array shape
- scenario portfolio numeric fields when provided (`totalUseCases`, `kpiCoverage`)
- compliance summary numeric fields when provided (`totalCertifications`, `controlCoveragePercent`)

## Validation command

```bash
node --test tests/observe/*.test.mjs tests/govern/*.test.mjs tests/optimize/*.test.mjs
```
