import test from "node:test";
import assert from "node:assert/strict";

import {
  buildAttestationWindows,
  summarizeAttestationWindows,
  buildAttestationWindowEvidence,
} from "../../src/govern/compliance/attestation-window-contract.mjs";

const records = [
  {
    itemId: "agent-a",
    owner: "coeLead",
    lastAttestedAt: "2026-01-01T00:00:00.000Z",
    cadenceDays: 30,
    riskBand: "high",
  },
  {
    itemId: "agent-b",
    owner: "securityRepresentative",
    lastAttestedAt: "2026-01-20T00:00:00.000Z",
    cadenceDays: 45,
    riskBand: "medium",
  },
];

test("builds attestation windows with due status", () => {
  const windows = buildAttestationWindows(records, "2026-02-10T00:00:00.000Z");
  assert.equal(windows.length, 2);
  assert.equal(windows[0].status, "overdue");
});

test("summarizes attestation windows", () => {
  const windows = buildAttestationWindows(records, "2026-02-10T00:00:00.000Z");
  const summary = summarizeAttestationWindows(windows);
  assert.equal(summary.total, 2);
  assert.equal(summary.overdue >= 1, true);
});

test("builds attestation evidence envelope", () => {
  const evidence = buildAttestationWindowEvidence(
    records,
    "2026-02-10T00:00:00.000Z",
    "2026-02-10T00:00:00.000Z"
  );
  assert.equal(evidence.artifactType, "attestation-windows");
  assert.equal(evidence.summary.total, 2);
});

