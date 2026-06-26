# FrontierIQ

> Your guide to the Microsoft 365 Copilot frontier.

FrontierIQ is a coaching platform for IT administrators managing Microsoft 365 Copilot and Copilot agents. It turns visibility, governance, security, and cost data into clear, prioritized recommendations — so IT teams always know what to act on next.

---

## Why FrontierIQ?

Organizations deploying Microsoft 365 Copilot face the same hard questions:

- Are my agents and Copilot performing as expected?
- Do I have the right guardrails and compliance posture in place?
- Are identities, data access, and security risks under control?
- Am I getting value from my investment — and where should I change?

FrontierIQ coaches IT teams through all four dimensions, continuously.

---

## Four coaching pillars

### 🔭 OBSERVE
Gain visibility into agents and Copilot usage. Understand how they're used, by whom, and how often. Act quickly on performance, behavior, and risk signals before they become problems.

### 🛡️ GOVERN
Establish guardrails for agents and people. Onboard agents with full IT oversight. Govern agent access to resources and data. Stay audit-ready with built-in compliance tracking and data retention guidance.

### 🔒 SECURE
Secure agent identities and control access to resources. Prevent data oversharing and leaks. Defend against threats and vulnerabilities with enterprise-grade security coaching tailored to your Copilot environment.

### 💡 OPTIMIZE
Map costs to actual usage and value delivered. Identify underutilized licenses, over-provisioned access, and low-ROI agents. Receive specific, prioritized recommendations on what to change — and what impact to expect.

---

## Who it's for

IT administrators and adoption leads responsible for Microsoft 365 Copilot and Copilot agent deployments — in single-tenant and multi-tenant environments.

---

## Built on

- [Microsoft Graph API](https://learn.microsoft.com/en-us/graph/overview) — Copilot usage reports, agent activity, and user data
- Microsoft 365 Copilot usage analytics
- Designed for single-tenant and multi-tenant deployments

---

## Getting started

Run the full deterministic test suite:

```bash
node --test $(find tests -name '*.test.mjs' | sort)
```

View a deterministic current-state snapshot:

```bash
node src/observe/api/current-state-view-cli.mjs
node src/observe/api/current-state-view-cli.mjs --json
```

---

## Roadmap

- [ ] Microsoft Graph authentication setup
- [ ] Tenant usage data ingestion (OBSERVE)
- [ ] Governance posture checks (GOVERN)
- [ ] Security signal ingestion (SECURE)
- [ ] Cost and value mapping (OPTIMIZE)
- [ ] Recommendation engine (v1)
- [ ] Multi-tenant support
- [ ] Executive reporting

---

## Contributing

Contributions, ideas, and feedback are welcome.  
Please open an issue to start a discussion before submitting a pull request.

---

## License

[MIT](LICENSE)
