const REQUIRED_TIERS = Object.freeze(["l1", "l2", "l3"]);

const REQUIRED_SEVERITIES = Object.freeze(["sev1", "sev2", "sev3"]);

/**
 * @param {{
 *   supportEmail?: string;
 *   tiers?: Array<{
 *     tierId: "l1"|"l2"|"l3";
 *     ownerRole: string;
 *     responsibilities: string[];
 *     handoffCriteria: string[];
 *   }>;
 * }} input
 */
export function buildSupportTierModel(input = {}) {
  return {
    version: "2026.06.1",
    supportEmail: input.supportEmail ?? "support@frontieriq.local",
    tiers: input.tiers ?? [
      {
        tierId: "l1",
        ownerRole: "serviceDeskAnalyst",
        responsibilities: ["intake-and-triage", "knowledge-base-guidance", "collect-minimum-evidence"],
        handoffCriteria: ["policy-deny-requires-review", "incident-severity-at-least-sev2"],
      },
      {
        tierId: "l2",
        ownerRole: "platformOperator",
        responsibilities: ["incident-response-runbook", "tenant-onboarding-remediation", "index-rehydration-and-recovery"],
        handoffCriteria: ["security-impact-confirmed", "cross-tenant-or-data-boundary-risk"],
      },
      {
        tierId: "l3",
        ownerRole: "engineeringAndSecurityLeads",
        responsibilities: ["code-or-policy-hotfix", "deep-forensics", "executive-incident-briefing"],
        handoffCriteria: ["sev1-critical-incident", "regulatory-or-audit-escalation"],
      },
    ],
  };
}

/**
 * @param {{
 *   policies?: Array<{
 *     severity: "sev1"|"sev2"|"sev3";
 *     startsAtTier: "l1"|"l2"|"l3";
 *     escalationPath: Array<"l1"|"l2"|"l3">;
 *     notifyRoles: string[];
 *     requiresWarRoom: boolean;
 *   }>;
 * }} input
 */
export function buildEscalationPolicy(input = {}) {
  return {
    version: "2026.06.1",
    policies: input.policies ?? [
      {
        severity: "sev1",
        startsAtTier: "l2",
        escalationPath: ["l2", "l3"],
        notifyRoles: ["securityLead", "complianceLead", "executiveSponsor"],
        requiresWarRoom: true,
      },
      {
        severity: "sev2",
        startsAtTier: "l1",
        escalationPath: ["l1", "l2"],
        notifyRoles: ["platformOperator", "securityLead"],
        requiresWarRoom: false,
      },
      {
        severity: "sev3",
        startsAtTier: "l1",
        escalationPath: ["l1"],
        notifyRoles: ["serviceDeskAnalyst"],
        requiresWarRoom: false,
      },
    ],
  };
}

/**
 * @param {{
 *   targets?: Array<{
 *     severity: "sev1"|"sev2"|"sev3";
 *     firstResponseMinutes: number;
 *     mitigationMinutes: number;
 *     updateCadenceMinutes: number;
 *   }>;
 * }} input
 */
export function buildSlaCatalog(input = {}) {
  return {
    version: "2026.06.1",
    targets: input.targets ?? [
      { severity: "sev1", firstResponseMinutes: 15, mitigationMinutes: 120, updateCadenceMinutes: 30 },
      { severity: "sev2", firstResponseMinutes: 30, mitigationMinutes: 240, updateCadenceMinutes: 60 },
      { severity: "sev3", firstResponseMinutes: 120, mitigationMinutes: 1440, updateCadenceMinutes: 240 },
    ],
  };
}

/**
 * @param {{
 *   supportModel: ReturnType<typeof buildSupportTierModel>;
 *   escalationPolicy: ReturnType<typeof buildEscalationPolicy>;
 *   slaCatalog: ReturnType<typeof buildSlaCatalog>;
 * }} input
 */
export function summarizeSupportModelReadiness(input) {
  const tierIds = new Set(input.supportModel.tiers.map((tier) => tier.tierId));
  const escalationBySeverity = new Map(input.escalationPolicy.policies.map((policy) => [policy.severity, policy]));
  const slaBySeverity = new Map(input.slaCatalog.targets.map((target) => [target.severity, target]));

  const checks = {
    tierCoverage: makeCheck(
      REQUIRED_TIERS.every((tierId) => tierIds.has(tierId)),
      REQUIRED_TIERS.filter((tierId) => !tierIds.has(tierId)).map((tierId) => `missing-tier:${tierId}`)
    ),
    escalationCoverage: makeCheck(
      REQUIRED_SEVERITIES.every((severity) => escalationBySeverity.has(severity)),
      REQUIRED_SEVERITIES.filter((severity) => !escalationBySeverity.has(severity)).map(
        (severity) => `missing-escalation-policy:${severity}`
      )
    ),
    slaCoverage: makeCheck(
      REQUIRED_SEVERITIES.every((severity) => {
        const target = slaBySeverity.get(severity);
        return (
          Boolean(target) &&
          target.firstResponseMinutes > 0 &&
          target.mitigationMinutes > 0 &&
          target.updateCadenceMinutes > 0
        );
      }),
      REQUIRED_SEVERITIES.flatMap((severity) => {
        const target = slaBySeverity.get(severity);
        if (!target) return [`missing-sla-target:${severity}`];
        const errors = [];
        if (!(target.firstResponseMinutes > 0)) errors.push(`invalid-first-response:${severity}`);
        if (!(target.mitigationMinutes > 0)) errors.push(`invalid-mitigation:${severity}`);
        if (!(target.updateCadenceMinutes > 0)) errors.push(`invalid-update-cadence:${severity}`);
        return errors;
      })
    ),
    escalationPathIntegrity: makeCheck(
      input.escalationPolicy.policies.every(
        (policy) =>
          policy.escalationPath.length > 0 &&
          policy.escalationPath[0] === policy.startsAtTier &&
          policy.escalationPath.every((tierId) => tierIds.has(tierId))
      ),
      input.escalationPolicy.policies.flatMap((policy) => {
        const errors = [];
        if (policy.escalationPath.length === 0) errors.push(`empty-escalation-path:${policy.severity}`);
        if (policy.escalationPath[0] !== policy.startsAtTier) {
          errors.push(`invalid-escalation-start-tier:${policy.severity}`);
        }
        for (const tierId of policy.escalationPath) {
          if (!tierIds.has(tierId)) errors.push(`unknown-escalation-tier:${policy.severity}:${tierId}`);
        }
        return errors;
      })
    ),
  };

  return {
    overallStatus: Object.values(checks).every((check) => check.status === "ready") ? "ready" : "blocked",
    checks,
    failedChecks: Object.values(checks).flatMap((check) => check.reasonCodes),
  };
}

function makeCheck(ok, reasonCodes = []) {
  return {
    status: ok ? "ready" : "blocked",
    reasonCodes,
  };
}
