import { SOLUTION_IDS } from "../foundation/solution-taxonomy.mjs";
import { CONTROL_IDS } from "../../govern/policy/control-catalog.mjs";
import { buildPolicyCatalog, getPolicyIdsForControl } from "../../govern/policy/policy-catalog.mjs";

const SOURCE_IDS = new Set(["mail", "calendar", "teams"]);
const PRINCIPAL_TYPES = new Set(["user", "servicePrincipal"]);
const TOKEN_FLOWS = new Set(["obo", "a2a"]);
const PERMISSION_KINDS = new Set(["delegatedScope", "appRole"]);

const REQUIRED_SCOPES = Object.freeze({
  mail: ["Mail.Read", "Mail.ReadBasic"],
  calendar: ["Calendars.Read"],
  teams: ["Chat.Read", "Chat.ReadBasic", "ChannelMessage.Read.All"],
});

/**
 * @param {{
 *   toolId: string;
 *   tenantId: string;
 *   clientId: string;
 *   owner: string;
 *   redirectUri: string;
 *   supportedSources?: Array<"mail"|"calendar"|"teams">;
 *   requiredDelegatedScopes?: string[];
 *   adminConsentRequired?: boolean;
 *   userConsentAllowed?: boolean;
 *   audience?: string;
 * }} input
 */
export function buildWorkIqRegistration(input) {
  const toolId = input.toolId;
  const tenantId = input.tenantId;
  const clientId = input.clientId;
  const owner = input.owner;
  const redirectUri = input.redirectUri;

  if (!toolId) throw new Error("toolId is required");
  if (!tenantId) throw new Error("tenantId is required");
  if (!clientId) throw new Error("clientId is required");
  if (!owner) throw new Error("owner is required");
  if (!isHttpsUrl(redirectUri)) throw new Error("redirectUri must be an https URL");

  const supportedSources = [...new Set(input.supportedSources ?? ["mail", "calendar", "teams"])];
  for (const source of supportedSources) {
    if (!SOURCE_IDS.has(source)) {
      throw new Error("supportedSources must contain only mail|calendar|teams");
    }
  }

  const requiredDelegatedScopes = [...new Set(
    input.requiredDelegatedScopes ?? [
      "Mail.Read",
      "Calendars.Read",
      "Chat.Read",
    ]
  )].sort((left, right) => left.localeCompare(right));
  const scopeParam = encodeURIComponent(requiredDelegatedScopes.join(" "));
  const adminConsentUrl =
    `https://login.microsoftonline.com/${input.tenantId}/adminconsent?client_id=${input.clientId}` +
    `&redirect_uri=${encodeURIComponent(normalizeRedirectUri(input.redirectUri))}&scope=${scopeParam}`;

  return {
    version: "2026.06.1",
    toolId,
    tenantId,
    solutionId: SOLUTION_IDS.M365_COPILOT,
    workload: "work-iq",
    owner,
    clientId,
    redirectUri: normalizeRedirectUri(redirectUri),
    audience: input.audience ?? "https://graph.microsoft.com",
    supportedSources: supportedSources.sort((left, right) => left.localeCompare(right)),
    requiredDelegatedScopes,
    adminConsentRequired: input.adminConsentRequired ?? true,
    userConsentAllowed: input.userConsentAllowed ?? false,
    adminConsentUrl,
    onboardingSteps: [
      "Register the Work IQ application and redirect URI.",
      "Grant delegated Microsoft Graph consent for mail, calendar, and Teams sources.",
      "Enable on-behalf-of token exchange for user-context queries.",
      "Validate WorkIQAgent.Ask against approved user-context sources.",
    ],
  };
}

/**
 * @param {{
 *   registration: ReturnType<typeof buildWorkIqRegistration>;
 *   principal: { principalId: string; principalType: "user"|"servicePrincipal"; tenantId: string };
 *   tokenFlow: "obo"|"a2a";
 *   permissionKind: "delegatedScope"|"appRole";
 *   delegatedScopes?: string[];
 *   adminConsentGranted?: boolean;
 *   userConsentGranted?: boolean;
 * }} input
 */
export function buildWorkIqUserContextAccessContract(input) {
  const registration = buildWorkIqRegistration(input.registration);
  if (!input.principal?.principalId) throw new Error("principal.principalId is required");
  if (!PRINCIPAL_TYPES.has(input.principal.principalType)) {
    throw new Error("principalType must be user or servicePrincipal");
  }
  if (!TOKEN_FLOWS.has(input.tokenFlow)) {
    throw new Error("tokenFlow must be obo or a2a");
  }
  if (!PERMISSION_KINDS.has(input.permissionKind)) {
    throw new Error("permissionKind must be delegatedScope or appRole");
  }
  if (!input.principal.tenantId) throw new Error("principal.tenantId is required");

  const delegatedScopes = [...new Set(input.delegatedScopes ?? [])].sort((left, right) =>
    left.localeCompare(right)
  );
  const consentSatisfied =
    (!registration.adminConsentRequired || input.adminConsentGranted === true) &&
    (registration.userConsentAllowed ? input.userConsentGranted === true || input.adminConsentGranted === true : true);

  return {
    tenantId: registration.tenantId,
    solutionId: registration.solutionId,
    workload: registration.workload,
    audience: registration.audience,
    principal: input.principal,
    tokenFlow: input.tokenFlow,
    permissionKind: input.permissionKind,
    delegatedScopes,
    adminConsentRequired: registration.adminConsentRequired,
    adminConsentGranted: input.adminConsentGranted === true,
    userConsentAllowed: registration.userConsentAllowed,
    userConsentGranted: input.userConsentGranted === true,
    consentSatisfied,
  };
}

/**
 * @param {{
 *   registration: ReturnType<typeof buildWorkIqRegistration>;
 *   request: {
 *     agentName: string;
 *     action: "WorkIQAgent.Ask";
 *     tenantId: string;
 *     userId: string;
 *     prompt: string;
 *     userContextRequired: boolean;
 *     tokenFlow: "obo"|"a2a";
 *     requestedSources: Array<"mail"|"calendar"|"teams">;
 *   };
 * }} input
 */
export function validateWorkIqAskRequest(input) {
  const registration = buildWorkIqRegistration(input.registration);
  /** @type {string[]} */
  const reasonCodes = [];

  if (input.request.agentName !== "WorkIQAgent") reasonCodes.push("invalid_agent_name");
  if (input.request.action !== "WorkIQAgent.Ask") reasonCodes.push("invalid_action");
  if (input.request.tenantId !== registration.tenantId) reasonCodes.push("tenant_mismatch");
  if (!input.request.userId) reasonCodes.push("missing_user_id");
  if (!input.request.prompt) reasonCodes.push("missing_prompt");
  if (!input.request.userContextRequired) reasonCodes.push("user_context_required");
  if (input.request.userContextRequired && input.request.tokenFlow !== "obo") {
    reasonCodes.push("obo_required_for_user_context");
  }
  if (!Array.isArray(input.request.requestedSources) || input.request.requestedSources.length === 0) {
    reasonCodes.push("missing_requested_sources");
  } else {
    for (const source of input.request.requestedSources) {
      if (!SOURCE_IDS.has(source)) {
        reasonCodes.push("unsupported_requested_source");
        continue;
      }
      if (!registration.supportedSources.includes(source)) {
        reasonCodes.push(`source_not_registered:${source}`);
      }
    }
  }

  return {
    ok: reasonCodes.length === 0,
    reasonCodes,
    normalizedRequest: {
      agentName: input.request.agentName,
      action: input.request.action,
      tenantId: input.request.tenantId,
      userId: input.request.userId,
      prompt: input.request.prompt,
      userContextRequired: input.request.userContextRequired,
      tokenFlow: input.request.tokenFlow,
      requestedSources: [...new Set(input.request.requestedSources ?? [])].sort((left, right) =>
        left.localeCompare(right)
      ),
    },
  };
}

/**
 * @param {{
 *   registration: ReturnType<typeof buildWorkIqRegistration>;
 *   access: ReturnType<typeof buildWorkIqUserContextAccessContract>;
 *   askRequest: ReturnType<typeof validateWorkIqAskRequest>;
 *   source: "mail"|"calendar"|"teams";
 * }} input
 */
export function validateWorkIqUserContextQuery(input) {
  const registration = buildWorkIqRegistration(input.registration);
  const access = buildWorkIqUserContextAccessContract({
    registration,
    principal: input.access.principal,
    tokenFlow: input.access.tokenFlow,
    permissionKind: input.access.permissionKind,
    delegatedScopes: input.access.delegatedScopes,
    adminConsentGranted: input.access.adminConsentGranted,
    userConsentGranted: input.access.userConsentGranted,
  });
  /** @type {string[]} */
  const reasonCodes = [];

  if (!SOURCE_IDS.has(input.source)) {
    throw new Error("source must be mail|calendar|teams");
  }
  if (!input.askRequest.ok) {
    reasonCodes.push(...input.askRequest.reasonCodes);
  }
  if (access.principal.principalType !== "user") {
    reasonCodes.push("user_principal_required");
  }
  if (access.tokenFlow !== "obo") {
    reasonCodes.push("obo_token_required");
  }
  if (access.permissionKind !== "delegatedScope") {
    reasonCodes.push("delegated_scopes_required");
  }
  if (access.principal.tenantId !== registration.tenantId) {
    reasonCodes.push("principal_tenant_mismatch");
  }
  if (!access.consentSatisfied) {
    reasonCodes.push("consent_not_granted");
  }
  if (!input.askRequest.normalizedRequest.requestedSources.includes(input.source)) {
    reasonCodes.push(`source_not_requested:${input.source}`);
  }

  const matchedScopes = access.delegatedScopes.filter((scope) =>
    REQUIRED_SCOPES[input.source].includes(scope)
  );
  if (matchedScopes.length === 0) {
    reasonCodes.push(`missing_scope_for_${input.source}`);
  }

  return {
    ok: reasonCodes.length === 0,
    source: input.source,
    reasonCodes,
    matchedScopes,
  };
}

/**
 * @param {{
 *   registration: ReturnType<typeof buildWorkIqRegistration>;
 *   access: ReturnType<typeof buildWorkIqUserContextAccessContract>;
 *   lastAttestedAt: string;
 *   riskBand?: "high"|"medium"|"low";
 * }} input
 */
export function buildWorkIqRegistryEntry(input) {
  const registration = buildWorkIqRegistration(input.registration);
  const access = buildWorkIqUserContextAccessContract({
    registration,
    principal: input.access.principal,
    tokenFlow: input.access.tokenFlow,
    permissionKind: input.access.permissionKind,
    delegatedScopes: input.access.delegatedScopes,
    adminConsentGranted: input.access.adminConsentGranted,
    userConsentGranted: input.access.userConsentGranted,
  });
  if (Number.isNaN(Date.parse(input.lastAttestedAt))) {
    throw new Error("lastAttestedAt must be ISO-8601");
  }

  return {
    agentId: registration.toolId,
    name: "Work IQ",
    owner: registration.owner,
    solutionId: registration.solutionId,
    riskBand: input.riskBand ?? "high",
    lastAttestedAt: input.lastAttestedAt,
    skills: [
      {
        skillId: "work-iq-agent-ask",
        name: "WorkIQAgent.Ask",
        permissionScopes: access.delegatedScopes,
        status: access.consentSatisfied && access.tokenFlow === "obo" && access.permissionKind === "delegatedScope"
          ? "approved"
          : "pending",
      },
    ],
    metadata: {
      workload: registration.workload,
      supportedSources: registration.supportedSources,
      consentSatisfied: access.consentSatisfied,
      principalType: access.principal.principalType,
    },
  };
}

/**
 * @param {{
 *   registration: ReturnType<typeof buildWorkIqRegistration>;
 *   access: ReturnType<typeof buildWorkIqUserContextAccessContract>;
 *   askRequest: ReturnType<typeof validateWorkIqAskRequest>;
 *   queryChecks: Array<ReturnType<typeof validateWorkIqUserContextQuery>>;
 * }} input
 */
export function summarizeWorkIqReadiness(input) {
  const registration = buildWorkIqRegistration(input.registration);
  const access = buildWorkIqUserContextAccessContract({
    registration,
    principal: input.access.principal,
    tokenFlow: input.access.tokenFlow,
    permissionKind: input.access.permissionKind,
    delegatedScopes: input.access.delegatedScopes,
    adminConsentGranted: input.access.adminConsentGranted,
    userConsentGranted: input.access.userConsentGranted,
  });
  const policyCatalog = buildPolicyCatalog(registration.solutionId);
  const approvalPolicyIds = getPolicyIdsForControl(policyCatalog, CONTROL_IDS.APPROVAL_GATES);
  const policyAsCodePolicyIds = getPolicyIdsForControl(policyCatalog, CONTROL_IDS.POLICY_AS_CODE_ENFORCEMENT);

  const checks = {
    toolRegistered: makeCheck(Boolean(registration.toolId)),
    oboUserContextReady: makeCheck(
      access.principal.principalType === "user" &&
        access.tokenFlow === "obo" &&
        access.permissionKind === "delegatedScope",
      [
        ...(access.principal.principalType === "user" ? [] : ["user_principal_required"]),
        ...(access.tokenFlow === "obo" ? [] : ["obo_token_required"]),
        ...(access.permissionKind === "delegatedScope" ? [] : ["delegated_scopes_required"]),
      ]
    ),
    consentReady: makeCheck(access.consentSatisfied, access.consentSatisfied ? [] : ["consent_not_granted"]),
    askReady: makeCheck(input.askRequest.ok, input.askRequest.reasonCodes),
    mailQueryReady: makeCheck(
      (input.queryChecks.find((item) => item.source === "mail")?.ok) === true,
      input.queryChecks.find((item) => item.source === "mail")?.reasonCodes ?? ["mail_query_not_evaluated"]
    ),
    calendarQueryReady: makeCheck(
      (input.queryChecks.find((item) => item.source === "calendar")?.ok) === true,
      input.queryChecks.find((item) => item.source === "calendar")?.reasonCodes ?? ["calendar_query_not_evaluated"]
    ),
    teamsQueryReady: makeCheck(
      (input.queryChecks.find((item) => item.source === "teams")?.ok) === true,
      input.queryChecks.find((item) => item.source === "teams")?.reasonCodes ?? ["teams_query_not_evaluated"]
    ),
  };

  return {
    solutionId: registration.solutionId,
    workload: registration.workload,
    policyVersion: policyCatalog.policyVersion,
    controlIds: [
      CONTROL_IDS.APPROVAL_GATES,
      CONTROL_IDS.CONSENT_PRIVACY_NOTICE,
      CONTROL_IDS.ACCESS_LEAST_PRIVILEGE,
      CONTROL_IDS.POLICY_AS_CODE_ENFORCEMENT,
      CONTROL_IDS.AUDIT_TRACEABILITY,
    ],
    policyIds: [...new Set([...approvalPolicyIds, ...policyAsCodePolicyIds])],
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

function normalizeRedirectUri(value) {
  return value.replace(/\/+$/, "");
}

function isHttpsUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
}
