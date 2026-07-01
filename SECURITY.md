# Security policy

## Supported code

FrontierIQ is currently maintained from the `main` branch. Security fixes are
applied there first and then flow into the next tagged release.

## Reporting a vulnerability

If you have found a vulnerability, use GitHub private vulnerability reporting as
the primary channel:

- <https://github.com/JonasCordsen/FrontierIQ/security/advisories/new>

Please include:

- the affected area or file path
- a short description of the issue
- impact and realistic exploitation conditions
- reproduction steps or a proof of concept
- suggested mitigations, if known

Do **not** open a public issue for a suspected vulnerability.

## What to expect

- We will acknowledge new reports as quickly as possible.
- We will validate impact before discussing remediation timelines.
- We may ask follow-up questions to confirm tenant, data, or release impact.
- Coordinated disclosure is preferred after a fix or mitigation is ready.

## Handling expectations

FrontierIQ is designed for Microsoft 365 Copilot governance and security
coaching. Please avoid including real tenant secrets, production tokens, or
customer data in any report. Redacted examples are preferred unless an exact
artifact is required to reproduce the issue.
