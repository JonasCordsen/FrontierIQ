# 380-tenant-briefing — Tenant Briefing

## Purpose

Assembles the IT admin-facing daily briefing payload from health scorecard,
ranked coach actions, and risk/compliance flags. The final delivery artifact
of the OPTIMIZE pillar.

## Pillar: OPTIMIZE

## Module

`src/optimize/delivery/tenant-briefing.mjs`

## API

| Function | Description |
| --- | --- |
| `buildHealthHeadline(scorecard)` | One-line health status string with optional trend indicator |
| `buildRiskHighlights(flags, n?)` | Top N risks sorted by severity |
| `buildComplianceAlert(flags)` | Critical/high compliance gaps + `requiresImmediateAction` flag |
| `buildTenantBriefing(input)` | Complete briefing payload: headline, topActions, highlights, alerts |
| `buildBriefingSummary(briefing)` | Token-efficient string for notification / email delivery |

## Briefing payload shape

```json
{
  "tenantId": "...",
  "headline": "Tenant foo: FAIR (73/100) ↑ improving",
  "overallScore": 73,
  "band": "fair",
  "topActions": [...],
  "riskHighlights": [...],
  "complianceAlerts": [...],
  "requiresImmediateAction": true,
  "generatedAt": "..."
}
```

## Fail-closed rules

- Missing tenantId / scorecard / actions / flags → validation error
- `requiresImmediateAction` true only when a flag with `severity: critical` is present
- `topActions` capped at 5; `riskHighlights` capped at 3 by default

## Tests

`tests/optimize/tenant-briefing.test.mjs` — 30 assertions
