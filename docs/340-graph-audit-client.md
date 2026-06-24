# 340-graph-audit-client — Graph Audit Client

## Purpose

On-demand request builders, response validators, and event classifier for
Microsoft Graph audit log access. No HTTP is performed.

## Pillar: OBSERVE

## Module

`src/observe/graph/audit-client.mjs`

## API

| Function | Description |
| --- | --- |
| `listSupportedWorkloads()` | 8+ supported workloads including Copilot and CopilotStudio |
| `isSupportedWorkload(w)` | Boolean workload check |
| `buildAuditLogRequest(tenantId, filter?)` | Builds request descriptor with OData filter |
| `validateAuditLogResponse(payload)` | Validates response and classifies each event |
| `classifyAuditEvent(event)` | Returns `{ category, severity, pillar }` for an audit event |
| `checkAuditClientReadiness(config)` | Fail-closed readiness check (tenantId, credential, AuditLog.Read.All) |

## Event classification

| Operation | Severity | Pillar | Category |
| --- | --- | --- | --- |
| PolicyViolation | high | GOVERN | governance |
| OvershareDetected | critical | SECURE | data-access |
| AgentPolicyViolation | critical | GOVERN | governance |
| AgentInvoked | low | OBSERVE | agent-activity |
| UnauthorizedAccess | critical | SECURE | identity |
| FileShared | medium | SECURE | data-access |
| RoleAssigned | high | GOVERN | identity |

## Tests

`tests/observe/graph-audit-client.test.mjs` — 30 assertions
