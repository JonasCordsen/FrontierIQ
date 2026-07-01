# 430-onboarding-assessment — Onboarding Assessment

## Purpose

First-run tenant baseline posture assessment across all four pillars. Fail-closed:
any critical gap blocks onboarding.

## Pillar: GOVERN

## Module

`src/govern/onboarding/onboarding-assessment.mjs`

## API

| Function | Description |
| --- | --- |
| `buildAssessmentChecklist(tenantId)` | 10-step ordered checklist covering all four pillars |
| `evaluateAssessmentStep(step, evidence)` | pass / partial / fail — critical steps cannot be partial |
| `buildBaselinePosture(tenantId, stepResults)` | Baseline score, gap list, readiness classification |
| `classifyOnboardingReadiness(posture)` | ready / partial / blocked |

## Readiness rules

| Condition | Readiness |
| --- | --- |
| Any critical gap | blocked |
| No critical gaps, score ≥ 80 | ready |
| No critical gaps, score < 80 | partial |

## Critical checklist items

- Entra app registration present
- Required Graph permissions granted
- Key Vault configured for secrets

## Tests

`tests/govern/onboarding-assessment.test.mjs`
