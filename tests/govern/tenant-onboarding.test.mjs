import test from "node:test";
import assert from "node:assert/strict";

import { getEvidenceArtifactsForControl } from "../../src/govern/policy/evidence-mapping.mjs";
import {
  buildTenantKeyVaultProvisioningManifest,
  buildTenantOnboardingBundle,
  buildTenantOnboardingScriptPack,
  buildTenantResourceTemplateContract,
  summarizeTenantOnboardingReadiness,
  validateTenantOnboardingRequest,
} from "../../src/govern/onboarding/tenant-onboarding.mjs";
import { CONTROL_IDS } from "../../src/govern/policy/control-catalog.mjs";

function createValidRequest(overrides = {}) {
  return {
    tenantId: "contoso.onmicrosoft.com",
    appDisplayName: "FrontierIQ Governance",
    redirectUri: "https://frontieriq.example.com/auth/callback",
    environment: "prod",
    location: "swedencentral",
    dataBoundary: "EU Data Boundary",
    approvalTicket: "ADO-1234",
    owners: ["securityRepresentative", "coeLead"],
    credentialStrategy: {
      type: "clientSecret",
      secretName: "frontieriq-client-secret",
      rotationDays: 30,
      expiryDays: 90,
    },
    permissions: [
      {
        resourceAppId: "00000003-0000-0000-c000-000000000000",
        resourceName: "Microsoft Graph",
        appRoles: ["Reports.Read.All", "User.Read.All"],
      },
    ],
    resources: [
      {
        type: "Microsoft.KeyVault/vaults",
        name: "contoso-frontieriq-kv",
        provisioningMode: "create",
        apiProfile: "2023-07-01",
        location: "swedencentral",
      },
      {
        type: "Microsoft.Storage/storageAccounts",
        name: "contosofrontieriqraw",
        provisioningMode: "create",
        apiProfile: "2023-05-01",
        location: "swedencentral",
        dependsOn: ["contoso-frontieriq-kv"],
      },
    ],
    keyVault: {
      vaultName: "contoso-frontieriq-kv",
      provisioningMode: "create",
      secretTypes: ["clientSecret"],
    },
    ...overrides,
  };
}

test("validates onboarding request and enforces approval for high-risk permissions", () => {
  const invalid = validateTenantOnboardingRequest(
    createValidRequest({
      approvalTicket: undefined,
      permissions: [
        {
          resourceAppId: "00000003-0000-0000-c000-000000000000",
          resourceName: "Microsoft Graph",
          appRoles: ["Application.ReadWrite.All"],
        },
      ],
    })
  );

  assert.equal(invalid.ok, false);
  assert.match(invalid.errors[0], /approvalTicket/i);
});

test("builds deterministic onboarding bundle with template, scripts, and evidence", () => {
  const validation = validateTenantOnboardingRequest(createValidRequest());
  assert.equal(validation.ok, true);
  if (!validation.ok) return;

  const bundle = buildTenantOnboardingBundle(validation.value);

  assert.equal(bundle.solutionId, "m365-copilot");
  assert.equal(bundle.policyVersion, "2026.06.1");
  assert.ok(bundle.policyIds.includes("tenant.approved-resource-types"));
  assert.match(bundle.onboardingPackage.adminConsentUrl, /adminconsent/);
  assert.equal(bundle.keyVaultManifest.vaultName, "contoso-frontieriq-kv");
  assert.equal(bundle.templateContract.templateFormat, "bicep-ready");
  assert.equal(bundle.scriptPack.steps.length, 4);
  assert.ok(bundle.evidenceArtifacts.includes("evidence/tenant-onboarding-bundle.json"));
});

test("supports certificate credential strategy and stable template ordering", () => {
  const validation = validateTenantOnboardingRequest(
    createValidRequest({
      credentialStrategy: {
        type: "certificate",
        certificateName: "frontieriq-cert",
        validityDays: 365,
        rolloverDays: 30,
        subjectName: "CN=FrontierIQ",
      },
      resources: [
        {
          type: "Microsoft.Storage/storageAccounts",
          name: "b-storage",
          provisioningMode: "create",
          apiProfile: "2023-05-01",
          location: "swedencentral",
        },
        {
          type: "Microsoft.KeyVault/vaults",
          name: "a-keyvault",
          provisioningMode: "reference",
          apiProfile: "2023-07-01",
          location: "swedencentral",
        },
      ],
      keyVault: {
        vaultName: "a-keyvault",
        provisioningMode: "reference",
        secretTypes: ["certificate"],
      },
    })
  );
  assert.equal(validation.ok, true);
  if (!validation.ok) return;

  const kv = buildTenantKeyVaultProvisioningManifest(validation.value);
  const template = buildTenantResourceTemplateContract(validation.value);

  assert.equal(kv.secrets[0].kind, "certificate");
  assert.equal(template.resources[0].name, "a-keyvault");
  assert.equal(template.secretRefs[0], "a-keyvault/frontieriq-cert");
});

test("readiness summary is control-driven and surfaces missing regional resources", () => {
  const validation = validateTenantOnboardingRequest(
    createValidRequest({
      resources: [
        {
          type: "Microsoft.CognitiveServices/accounts",
          name: "contoso-foundry",
          provisioningMode: "reference",
          apiProfile: "2024-10-01",
          location: "swedencentral",
        },
      ],
    })
  );
  assert.equal(validation.ok, true);
  if (!validation.ok) return;

  const keyVaultManifest = buildTenantKeyVaultProvisioningManifest(validation.value);
  const templateContract = buildTenantResourceTemplateContract(validation.value);
  const scriptPack = buildTenantOnboardingScriptPack(validation.value, {
    clientId: "11111111-1111-1111-1111-111111111111",
    keyVaultManifest,
  });
  const readiness = summarizeTenantOnboardingReadiness({
    request: validation.value,
    onboardingPackage: {
      adminConsentUrl: "https://example/adminconsent",
    },
    keyVaultManifest,
    templateContract,
    scriptPack,
  });

  assert.equal(readiness.checks[CONTROL_IDS.BYO_ENTRA_ONBOARDING].status, "ready");
  assert.equal(readiness.checks[CONTROL_IDS.REGIONAL_STORAGE_ALIGNMENT].status, "blocked");
  assert.ok(readiness.policyIds.includes("tenant.high-risk-approval"));
  assert.ok(
    readiness.checks[CONTROL_IDS.BYO_ENTRA_ONBOARDING].evidenceArtifacts.includes(
      "evidence/tenant-onboarding-scripts.json"
    )
  );
  assert.ok(
    readiness.checks[CONTROL_IDS.APPROVAL_GATES].policyIds.includes("tenant.high-risk-approval")
  );
});

test("evidence mapping includes onboarding bundle artifacts", () => {
  const artifacts = getEvidenceArtifactsForControl(CONTROL_IDS.BYO_ENTRA_ONBOARDING);
  assert.ok(artifacts.includes("evidence/tenant-onboarding-bundle.json"));
  assert.ok(artifacts.includes("evidence/tenant-onboarding-scripts.json"));
});
