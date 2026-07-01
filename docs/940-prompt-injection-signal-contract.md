# 940-prompt-injection-signal-contract — Prompt Injection Signal Contract

## Purpose

Deterministic prompt-injection signal normalization, risk classification, and
containment action mapping.

## Pillar: SECURE

## Module

`src/secure/overshare/prompt-injection-signal-contract.mjs`

## API

| Function | Description |
| --- | --- |
| `normalizePromptInjectionSignal(event)` | Normalizes raw prompt events to deterministic signal shape |
| `classifyPromptInjectionRisk(signal)` | Classifies score and risk band for injection signals |
| `buildPromptInjectionContainment(signal)` | Maps risk band to deterministic containment action and playbook |
| `summarizePromptInjectionSignals(events)` | Summarizes blocked/high-risk signal volume and readiness |

## Tests

`tests/secure/prompt-injection-signal-contract.test.mjs`

