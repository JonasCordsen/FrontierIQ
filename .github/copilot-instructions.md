# FrontierIQ — Copilot Instructions

## Product context

FrontierIQ is a coaching platform for IT administrators managing Microsoft 365 Copilot 
and Copilot agents. It surfaces actionable recommendations across four pillars:

- **OBSERVE** — visibility into agent and Copilot usage, performance, and behavior signals
- **GOVERN** — guardrails, agent onboarding with IT oversight, compliance, and data retention
- **SECURE** — agent identity security, access control, data oversharing prevention, threat defense
- **OPTIMIZE** — cost and value mapping, license utilization, prioritized change recommendations

## Architecture (planned)

- **Data layer**: Microsoft Graph API
  - `/reports/getMicrosoft365CopilotUsageUserDetail`
  - `/reports/getMicrosoft365CopilotUserCountSummary`
  - Agent activity and security signal endpoints
- **Auth**: Entra app registration with application permissions
  - `Reports.Read.All`, `User.Read.All`, `AuditLog.Read.All`
- **Delivery**: TBD — web dashboard, CLI, or API
- **Tenancy**: Single-tenant and multi-tenant support required from the start

## Folder structure

```
src/
  observe/     # Usage ingestion, activity signals, performance metrics
  govern/      # Policy checks, agent onboarding, compliance posture
  secure/      # Identity checks, access control, oversharing detection
  optimize/    # Cost mapping, value analysis, recommendation engine
docs/
tests/
```

## Key conventions

- Every feature must map to one of the four pillars (OBSERVE / GOVERN / SECURE / OPTIMIZE)
- Single-tenant and multi-tenant support must be considered in every data access decision
- No customer tenant data is ever stored permanently — all processing is on-demand
- Auth tokens and secrets never in source code — use environment variables or managed identity
- Recommendations must always include: what to change, why, and expected impact

## Terminology

- **Tenant**: a customer's Microsoft 365 environment
- **Agent**: a Microsoft 365 Copilot agent (declarative or custom)
- **Pillar**: one of the four coaching dimensions (OBSERVE / GOVERN / SECURE / OPTIMIZE)
- **Coach action**: a prioritized recommendation generated from data signals
- **Signal**: a raw data point from Graph API used to derive a coach action

## What NOT to do

- Do not hardcode tenant IDs, client IDs, or secrets
- Do not add mock/stub data that could be mistaken for real customer data
- Do not implement features that span pillars without a clear primary pillar assignment
- Do not store or log personally identifiable user data beyond what Graph already exposes
