# 30-coverage-map - Microsoft AI solution coverage

This map tracks FrontierIQ coverage across Microsoft AI solutions.

## Status legend

- `Implemented (MVP)` - adapter and normalized contract implemented now
- `Planned` - included in roadmap, not yet implemented

## Coverage matrix

| Solution | Category | Primary API surface | OBSERVE | GOVERN | SECURE | OPTIMIZE | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Microsoft 365 Copilot | M365 | Microsoft Graph reports + audit | Yes | Yes | Yes | Yes | Implemented (MVP) |
| Copilot Studio | M365 | Copilot Studio APIs | Yes | Yes | Yes | Yes | Implemented (MVP) |
| Azure AI Foundry | Azure | Foundry APIs + ARM | Yes | Yes | Yes | Yes | Implemented (MVP) |
| Microsoft Fabric | Azure | Fabric APIs + capacity metrics | Yes | Yes | Yes | Yes | Implemented (MVP) |
| Security Copilot | M365 Security | Security/Defender APIs | Planned | Planned | Planned | Planned | Planned |
| Azure OpenAI | Azure | Azure OpenAI APIs | Planned | Planned | Planned | Planned | Planned |
| Azure AI Search | Azure | AI Search APIs | Planned | Planned | Planned | Planned | Planned |
| Document Intelligence | Azure | Document Intelligence APIs | Planned | Planned | Planned | Planned | Planned |
| Speech | Azure | Speech APIs | Planned | Planned | Planned | Planned | Planned |
| Power Platform | Power Platform | Admin APIs | Planned | Planned | Planned | Planned | Planned |
| Dynamics 365 | Dynamics | Dynamics/Dataverse APIs | Planned | Planned | Planned | Planned | Planned |
| GitHub Copilot | GitHub | Copilot metrics + GitHub APIs | Planned | Planned | Planned | Planned | Planned |

## Phase sequencing

1. Phase 1: taxonomy, normalized schema, four MVP adapters.
2. Phase 2: identity graph + policy baseline library + AGT-aligned enforcement.
3. Phase 3: unified cost/value model + maturity engine + enterprise operating kit.

