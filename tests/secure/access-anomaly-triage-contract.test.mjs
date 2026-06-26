import test from "node:test";
import assert from "node:assert/strict";

import {
  scoreAccessAnomaly,
  mapAccessAnomalyResponse,
  summarizeAccessAnomalyTriage,
} from "../../src/secure/permissions/access-anomaly-triage-contract.mjs";

const anomalies = [
  {
    id: "a-1",
    tenantId: "tenant-a",
    anomalyType: "privilege_escalation",
    riskSignals: ["impossible_travel", "new_device"],
    blastRadiusUsers: 90,
    privilegedContext: true,
    repeatedCount: 2,
  },
  {
    id: "a-2",
    tenantId: "tenant-a",
    anomalyType: "excessive_failures",
    riskSignals: ["failed_logins"],
    blastRadiusUsers: 8,
    privilegedContext: false,
    repeatedCount: 0,
  },
];

test("scores anomaly with deterministic severity band", () => {
  const scored = scoreAccessAnomaly(anomalies[0]);
  assert.equal(scored.id, "a-1");
  assert.equal(scored.severityScore > 0, true);
  assert.equal(["critical", "high", "medium", "low"].includes(scored.severityBand), true);
});

test("maps scored anomaly to playbook action", () => {
  const response = mapAccessAnomalyResponse(scoreAccessAnomaly(anomalies[0]));
  assert.equal(["monitor", "investigate", "contain", "revoke"].includes(response.action), true);
  assert.equal(typeof response.playbookId, "string");
});

test("summarizes anomaly triage portfolio", () => {
  const summary = summarizeAccessAnomalyTriage(anomalies);
  assert.equal(summary.total, 2);
  assert.equal(summary.topAnomalyId, "a-1");
  assert.equal(summary.status, "ready");
});

