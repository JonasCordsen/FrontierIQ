import test from "node:test";
import assert from "node:assert/strict";

import {
  validateMinimizationPolicy,
  minimizeDataRecord,
  buildMinimizationAudit,
} from "../../src/secure/privacy/data-minimization-contract.mjs";

const policy = {
  allowedFields: ["tenantId", "userEmail", "question", "answer"],
  redactFields: ["userEmail"],
};

test("validates minimization policy", () => {
  assert.equal(validateMinimizationPolicy(policy).ok, true);
});

test("minimizes and redacts fields", () => {
  const result = minimizeDataRecord(
    {
      tenantId: "tenant-a",
      userEmail: "user@contoso.com",
      question: "What changed?",
      answer: "Summary",
      ipAddress: "10.0.0.1",
    },
    policy
  );
  assert.equal(result.minimized.userEmail, "[REDACTED]");
  assert.ok(result.droppedFields.includes("ipAddress"));
});

test("builds minimization audit", () => {
  const audit = buildMinimizationAudit(
    [{ tenantId: "tenant-a", userEmail: "user@contoso.com", question: "q", answer: "a", ipAddress: "x" }],
    policy,
    "2026-01-01T00:00:00.000Z"
  );
  assert.equal(audit.status, "ready");
  assert.equal(audit.summary.totalRedactedFields, 1);
});

