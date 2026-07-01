# 400-alert-threshold-engine — Alert Threshold Engine

## Purpose

Configurable threshold evaluation against scorecard metrics. Produces typed
alerts when values cross defined boundaries.

## Pillar: OPTIMIZE

## Module

`src/optimize/delivery/alert-threshold-engine.mjs`

## API

| Function | Description |
| --- | --- |
| `buildDefaultThresholds()` | 8 default thresholds covering overall health, governance, security, overshare, license, agent ratio, and compliance gaps |
| `evaluateThresholds(metrics, thresholds)` | Evaluate all thresholds; returns triggered alerts with actual/threshold/delta |
| `classifyAlertSeverity(base, delta, threshold)` | Optionally elevates severity by one band when delta ratio > 0.5 |
| `buildThresholdSummary(alerts)` | Count by severity, most critical metric, requiresAction flag |

## Default thresholds

| ID | Metric | Condition | Severity |
| --- | --- | --- | --- |
| overall-health-critical | overallScore | < 40 | critical |
| overall-health-low | overallScore | < 60 | high |
| govern-score-low | governScore | < 50 | high |
| secure-score-low | secureScore | < 50 | high |
| overshare-rate-high | overshareRate | > 5% | critical |
| license-utilization-low | licenseUtilization | < 50% | medium |
| active-agent-ratio-low | activeAgentRatio | < 30% | medium |
| compliance-gap-critical | criticalComplianceGaps | > 0 | critical |

## Tests

`tests/optimize/alert-threshold-engine.test.mjs`
