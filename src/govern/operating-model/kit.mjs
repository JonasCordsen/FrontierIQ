const REQUIRED_ROLES = Object.freeze([
  "executiveSponsor",
  "coeLead",
  "securityRepresentative",
  "complianceRepresentative",
  "responsibleAiLead",
  "businessOwner",
]);

/**
 * @typedef {{
 *   organization: string;
 *   scope: "single-tenant"|"multi-tenant"|"hybrid";
 *   roles: Record<string, string>;
 *   attestationCadenceDays: number;
 *   exceptionSlaDays: number;
 *   auditPackArtifacts: string[];
 * }} OperatingModelKit
 */

/**
 * @param {Partial<OperatingModelKit>} input
 * @returns {OperatingModelKit}
 */
export function buildOperatingModelKit(input = {}) {
  const roles = {
    executiveSponsor: input.roles?.executiveSponsor ?? "CIO/CISO",
    coeLead: input.roles?.coeLead ?? "AI Agent CoE Lead",
    securityRepresentative: input.roles?.securityRepresentative ?? "Security Engineering Lead",
    complianceRepresentative:
      input.roles?.complianceRepresentative ?? "Compliance and Risk Representative",
    responsibleAiLead: input.roles?.responsibleAiLead ?? "Responsible AI Lead",
    businessOwner: input.roles?.businessOwner ?? "Business Unit Owner",
  };

  return {
    organization: input.organization ?? "FrontierIQ Tenant",
    scope: input.scope ?? "single-tenant",
    roles,
    attestationCadenceDays: input.attestationCadenceDays ?? 90,
    exceptionSlaDays: input.exceptionSlaDays ?? 10,
    auditPackArtifacts: input.auditPackArtifacts ?? [
      "approval-decisions.ndjson",
      "policy-baseline-profile.json",
      "identity-permission-graph.json",
      "governance-decision-traces.ndjson",
      "attestation-signoffs.csv",
      "exception-register.csv",
    ],
  };
}

/**
 * @param {OperatingModelKit} kit
 * @returns {{ ok: true } | { ok: false; errors: string[] }}
 */
export function validateOperatingModelKit(kit) {
  /** @type {string[]} */
  const errors = [];
  if (!kit || typeof kit !== "object") {
    return { ok: false, errors: ["kit must be an object"] };
  }
  if (typeof kit.organization !== "string" || !kit.organization) {
    errors.push("organization must be a non-empty string");
  }
  if (!["single-tenant", "multi-tenant", "hybrid"].includes(kit.scope)) {
    errors.push("scope must be single-tenant|multi-tenant|hybrid");
  }
  if (!kit.roles || typeof kit.roles !== "object") {
    errors.push("roles must be an object");
  } else {
    for (const role of REQUIRED_ROLES) {
      if (typeof kit.roles[role] !== "string" || !kit.roles[role]) {
        errors.push(`roles.${role} must be set`);
      }
    }
  }
  if (typeof kit.attestationCadenceDays !== "number" || kit.attestationCadenceDays <= 0) {
    errors.push("attestationCadenceDays must be a positive number");
  }
  if (typeof kit.exceptionSlaDays !== "number" || kit.exceptionSlaDays <= 0) {
    errors.push("exceptionSlaDays must be a positive number");
  }
  if (!Array.isArray(kit.auditPackArtifacts) || kit.auditPackArtifacts.length < 4) {
    errors.push("auditPackArtifacts must contain at least 4 entries");
  }
  if (errors.length > 0) return { ok: false, errors };
  return { ok: true };
}

/**
 * @param {OperatingModelKit} kit
 */
export function createOperatingModelChecklist(kit) {
  return [
    `Confirm CoE owner assignment (${kit.roles.coeLead})`,
    `Confirm security/compliance approvers (${kit.roles.securityRepresentative}, ${kit.roles.complianceRepresentative})`,
    `Schedule attestation every ${kit.attestationCadenceDays} days`,
    `Set exception SLA to ${kit.exceptionSlaDays} days`,
    `Publish audit pack artifacts (${kit.auditPackArtifacts.length} items)`,
  ];
}

