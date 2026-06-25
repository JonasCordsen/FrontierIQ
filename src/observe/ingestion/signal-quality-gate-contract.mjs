/**
 * Signal quality gate contract.
 * Pillar: OBSERVE
 *
 * Deterministic validation and quality scoring contract for normalized signals.
 */

import { validateNormalizedSignal } from "../foundation/normalized-signal.mjs";

/**
 * Evaluate signal quality gate.
 * @param {object[]} signals
 * @param {{ minConfidence?: number, maxFreshnessMinutes?: number, minPassRate?: number }} options
 * @returns {object}
 */
export function evaluateSignalQualityGate(signals, options = {}) {
  const list = Array.isArray(signals) ? signals : [];
  const minConfidence = Number.isFinite(options.minConfidence) ? options.minConfidence : 0.6;
  const maxFreshnessMinutes = Number.isFinite(options.maxFreshnessMinutes) ? options.maxFreshnessMinutes : 180;
  const minPassRate = Number.isFinite(options.minPassRate) ? options.minPassRate : 0.8;

  const acceptedSignals = [];
  const rejectedSignals = [];

  for (const signal of list) {
    const validation = validateNormalizedSignal(signal);
    if (!validation.ok) {
      rejectedSignals.push({
        signalId: signal?.resourceId ?? null,
        workload: signal?.workload ?? null,
        reasonCode: "invalid_signal",
        errors: validation.errors,
      });
      continue;
    }

    const normalized = validation.value;
    if (normalized.confidence < minConfidence) {
      rejectedSignals.push({
        signalId: normalized.resourceId,
        workload: normalized.workload,
        reasonCode: "low_confidence",
        errors: [`confidence below threshold ${minConfidence}`],
      });
      continue;
    }

    if (normalized.freshnessMinutes > maxFreshnessMinutes) {
      rejectedSignals.push({
        signalId: normalized.resourceId,
        workload: normalized.workload,
        reasonCode: "stale_signal",
        errors: [`freshness above threshold ${maxFreshnessMinutes}`],
      });
      continue;
    }

    acceptedSignals.push(normalized);
  }

  const total = list.length;
  const passed = acceptedSignals.length;
  const passRate = total > 0 ? Number((passed / total).toFixed(4)) : 0;
  const avgConfidence = passed > 0
    ? Number((acceptedSignals.reduce((acc, signal) => acc + signal.confidence, 0) / passed).toFixed(4))
    : 0;
  const avgFreshness = passed > 0
    ? Number((acceptedSignals.reduce((acc, signal) => acc + signal.freshnessMinutes, 0) / passed).toFixed(2))
    : 0;

  const qualityScore = Number(
    Math.max(
      0,
      Math.min(100, Math.round(passRate * 60 + avgConfidence * 30 + Math.max(0, 1 - avgFreshness / maxFreshnessMinutes) * 10))
    ).toFixed(0)
  );

  return {
    gateVersion: "2026.06.1",
    status: passRate >= minPassRate ? "ready" : "blocked",
    thresholds: { minConfidence, maxFreshnessMinutes, minPassRate },
    summary: {
      total,
      passed,
      rejected: rejectedSignals.length,
      passRate,
      avgConfidence,
      avgFreshnessMinutes: avgFreshness,
      qualityScore,
    },
    acceptedSignals,
    rejectedSignals,
  };
}

/**
 * Summarize quality result by workload.
 * @param {ReturnType<typeof evaluateSignalQualityGate>} gateResult
 * @returns {Record<string,{passed:number,rejected:number}>}
 */
export function summarizeSignalQualityByWorkload(gateResult) {
  const summary = {};

  for (const signal of gateResult?.acceptedSignals ?? []) {
    const workload = signal.workload ?? "unknown";
    if (!summary[workload]) summary[workload] = { passed: 0, rejected: 0 };
    summary[workload].passed += 1;
  }
  for (const rejection of gateResult?.rejectedSignals ?? []) {
    const workload = rejection.workload ?? "unknown";
    if (!summary[workload]) summary[workload] = { passed: 0, rejected: 0 };
    summary[workload].rejected += 1;
  }

  return summary;
}

/**
 * Build evidence envelope.
 * @param {ReturnType<typeof evaluateSignalQualityGate>} gateResult
 * @param {string} generatedAt
 * @returns {object}
 */
export function buildSignalQualityEvidence(gateResult, generatedAt) {
  return {
    artifactType: "signal-quality-gate",
    generatedAt: generatedAt ?? null,
    result: gateResult,
    workloadSummary: summarizeSignalQualityByWorkload(gateResult),
  };
}

