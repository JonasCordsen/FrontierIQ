import test from "node:test";
import assert from "node:assert/strict";

import { buildAgentSkillRegistry, queryRegistry } from "../../src/observe/registry/agent-skill-registry.mjs";
import {
  buildWorkIqRegistration,
  buildWorkIqRegistryEntry,
  buildWorkIqUserContextAccessContract,
  summarizeWorkIqReadiness,
  validateWorkIqAskRequest,
  validateWorkIqUserContextQuery,
} from "../../src/observe/integration/work-iq.mjs";

function createRegistration(overrides = {}) {
  return {
    toolId: "work-iq-1",
    tenantId: "contoso.onmicrosoft.com",
    clientId: "11111111-1111-1111-1111-111111111111",
    owner: "work-owner",
    redirectUri: "https://frontieriq.example.com/auth/workiq/callback",
    supportedSources: ["mail", "calendar", "teams"],
    requiredDelegatedScopes: ["Mail.Read", "Calendars.Read", "Chat.Read"],
    adminConsentRequired: true,
    userConsentAllowed: false,
    ...overrides,
  };
}

function createAccess(overrides = {}) {
  return {
    registration: createRegistration(),
    principal: {
      principalId: "user-1",
      principalType: "user",
      tenantId: "contoso.onmicrosoft.com",
    },
    tokenFlow: "obo",
    permissionKind: "delegatedScope",
    delegatedScopes: ["Mail.Read", "Calendars.Read", "Chat.Read"],
    adminConsentGranted: true,
    userConsentGranted: false,
    ...overrides,
  };
}

function createAskRequest(overrides = {}) {
  return {
    registration: createRegistration(),
    request: {
      agentName: "WorkIQAgent",
      action: "WorkIQAgent.Ask",
      tenantId: "contoso.onmicrosoft.com",
      userId: "user-1",
      prompt: "Summarize my unread mail, calendar, and Teams mentions.",
      userContextRequired: true,
      tokenFlow: "obo",
      requestedSources: ["mail", "calendar", "teams"],
    },
    ...overrides,
  };
}

test("work iq registration derives consent metadata and registry entry", () => {
  const registration = buildWorkIqRegistration(createRegistration());
  const access = buildWorkIqUserContextAccessContract(createAccess({ registration }));
  const entry = buildWorkIqRegistryEntry({
    registration,
    access,
    lastAttestedAt: "2026-06-24T12:00:00Z",
  });
  const registry = buildAgentSkillRegistry([entry]);
  const filtered = queryRegistry(registry, { solutionId: "m365-copilot" });

  assert.equal(registration.solutionId, "m365-copilot");
  assert.equal(registration.workload, "work-iq");
  assert.match(registration.adminConsentUrl, /adminconsent/);
  assert.equal(entry.skills[0].name, "WorkIQAgent.Ask");
  assert.equal(filtered.length, 1);
});

test("ask validation fails when user-context request is not using obo", () => {
  const result = validateWorkIqAskRequest(createAskRequest({
    request: {
      ...createAskRequest().request,
      tokenFlow: "a2a",
    },
  }));

  assert.equal(result.ok, false);
  assert.ok(result.reasonCodes.includes("obo_required_for_user_context"));
});

test("user-context query fails for service principal, app-role-only access, and missing consent", () => {
  const access = buildWorkIqUserContextAccessContract(createAccess({
    principal: {
      principalId: "spn-1",
      principalType: "servicePrincipal",
      tenantId: "contoso.onmicrosoft.com",
    },
    permissionKind: "appRole",
    delegatedScopes: [],
    adminConsentGranted: false,
  }));
  const askRequest = validateWorkIqAskRequest(createAskRequest());
  const query = validateWorkIqUserContextQuery({
    registration: createRegistration(),
    access,
    askRequest,
    source: "mail",
  });

  assert.equal(query.ok, false);
  assert.ok(query.reasonCodes.includes("user_principal_required"));
  assert.ok(query.reasonCodes.includes("delegated_scopes_required"));
  assert.ok(query.reasonCodes.includes("consent_not_granted"));
  assert.ok(query.reasonCodes.includes("missing_scope_for_mail"));
});

test("source-specific query checks fail when scopes do not match the source", () => {
  const access = buildWorkIqUserContextAccessContract(createAccess({
    delegatedScopes: ["Calendars.Read"],
  }));
  const askRequest = validateWorkIqAskRequest(createAskRequest({
    request: {
      ...createAskRequest().request,
      requestedSources: ["mail", "teams"],
    },
  }));
  const mailQuery = validateWorkIqUserContextQuery({
    registration: createRegistration(),
    access,
    askRequest,
    source: "mail",
  });
  const teamsQuery = validateWorkIqUserContextQuery({
    registration: createRegistration(),
    access,
    askRequest,
    source: "teams",
  });

  assert.equal(mailQuery.ok, false);
  assert.ok(mailQuery.reasonCodes.includes("missing_scope_for_mail"));
  assert.equal(teamsQuery.ok, false);
  assert.ok(teamsQuery.reasonCodes.includes("missing_scope_for_teams"));
});

test("work iq readiness is ready only when ask, consent, and user-context queries all pass", () => {
  const registration = buildWorkIqRegistration(createRegistration());
  const access = buildWorkIqUserContextAccessContract(createAccess({ registration }));
  const askRequest = validateWorkIqAskRequest(createAskRequest({ registration }));
  const queryChecks = [
    validateWorkIqUserContextQuery({ registration, access, askRequest, source: "mail" }),
    validateWorkIqUserContextQuery({ registration, access, askRequest, source: "calendar" }),
    validateWorkIqUserContextQuery({ registration, access, askRequest, source: "teams" }),
  ];
  const summary = summarizeWorkIqReadiness({
    registration,
    access,
    askRequest,
    queryChecks,
  });

  assert.equal(summary.checks.oboUserContextReady.status, "ready");
  assert.equal(summary.checks.consentReady.status, "ready");
  assert.equal(summary.checks.mailQueryReady.status, "ready");
  assert.equal(summary.checks.calendarQueryReady.status, "ready");
  assert.equal(summary.checks.teamsQueryReady.status, "ready");
  assert.ok(summary.policyIds.includes("skill.high-risk-approval"));
});
