/**
 * Prompt injection signal contract.
 * Pillar: SECURE
 *
 * Deterministic unsafe prompt signal detection and containment action mapping.
 */

/**
 * Normalize raw prompt event into deterministic signal shape.
 * @param {{ id:string, tenantId:string, prompt:string, detectorHits?:string[], containsCredentialPattern?:boolean, toolEscalationAttempt?:boolean, sensitiveDataContext?:boolean }} event
 * @returns {object}
 */
export function normalizePromptInjectionSignal(event) {
  const prompt = typeof event?.prompt === "string" ? event.prompt : "";
  const detectorHits = Array.isArray(event?.detectorHits) ? [...new Set(event.detectorHits)] : [];
  return {
    id: event?.id ?? null,
    tenantId: event?.tenantId ?? null,
    promptLength: prompt.length,
    detectorHits,
    containsCredentialPattern: Boolean(event?.containsCredentialPattern),
    toolEscalationAttempt: Boolean(event?.toolEscalationAttempt),
    sensitiveDataContext: Boolean(event?.sensitiveDataContext),
  };
}

/**
 * Classify normalized prompt-injection risk.
 * @param {ReturnType<typeof normalizePromptInjectionSignal>} signal
 * @returns {{ score:number, band:'critical'|'high'|'medium'|'low', reasons:string[] }}
 */
export function classifyPromptInjectionRisk(signal) {
  const reasons = [];
  let score = Math.min(40, (signal?.detectorHits?.length ?? 0) * 12);
  if (signal?.containsCredentialPattern) {
    score += 25;
    reasons.push("credential_pattern");
  }
  if (signal?.toolEscalationAttempt) {
    score += 20;
    reasons.push("tool_escalation_attempt");
  }
  if (signal?.sensitiveDataContext) {
    score += 10;
    reasons.push("sensitive_data_context");
  }
  if ((signal?.promptLength ?? 0) > 500) {
    score += 5;
    reasons.push("long_prompt_pattern");
  }

  const bounded = Math.min(100, Math.max(0, score));
  return {
    score: bounded,
    band: classifyPromptInjectionBand(bounded),
    reasons,
  };
}

/**
 * Build deterministic containment action.
 * @param {ReturnType<typeof normalizePromptInjectionSignal>} signal
 * @returns {object}
 */
export function buildPromptInjectionContainment(signal) {
  const risk = classifyPromptInjectionRisk(signal);
  if (risk.band === "critical") {
    return { ...risk, action: "block_and_suspend", playbookId: "PB-SEC-PROMPT-001" };
  }
  if (risk.band === "high") {
    return { ...risk, action: "block_and_review", playbookId: "PB-SEC-PROMPT-002" };
  }
  if (risk.band === "medium") {
    return { ...risk, action: "allow_with_review", playbookId: "PB-SEC-PROMPT-003" };
  }
  return { ...risk, action: "allow_and_log", playbookId: "PB-SEC-PROMPT-004" };
}

/**
 * Summarize prompt injection signal set.
 * @param {object[]} events
 * @returns {object}
 */
export function summarizePromptInjectionSignals(events) {
  const assessed = (Array.isArray(events) ? events : [])
    .map(normalizePromptInjectionSignal)
    .map((signal) => ({ signal, containment: buildPromptInjectionContainment(signal) }));
  const total = assessed.length;
  return {
    total,
    blocked: assessed.filter((item) => item.containment.action.startsWith("block")).length,
    critical: assessed.filter((item) => item.containment.band === "critical").length,
    high: assessed.filter((item) => item.containment.band === "high").length,
    medium: assessed.filter((item) => item.containment.band === "medium").length,
    low: assessed.filter((item) => item.containment.band === "low").length,
    status: total > 0 ? "ready" : "blocked",
    signals: assessed,
  };
}

function classifyPromptInjectionBand(score) {
  if (score >= 75) return "critical";
  if (score >= 55) return "high";
  if (score >= 30) return "medium";
  return "low";
}

