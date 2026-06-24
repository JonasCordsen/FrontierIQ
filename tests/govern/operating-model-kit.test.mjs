import test from "node:test";
import assert from "node:assert/strict";

import {
  buildOperatingModelKit,
  createOperatingModelChecklist,
  validateOperatingModelKit,
} from "../../src/govern/operating-model/kit.mjs";

test("builds default operating model kit", () => {
  const kit = buildOperatingModelKit({ organization: "Contoso" });
  assert.equal(kit.organization, "Contoso");
  assert.equal(kit.scope, "single-tenant");
  assert.ok(kit.auditPackArtifacts.length >= 4);
});

test("validates complete operating model kit", () => {
  const kit = buildOperatingModelKit({ organization: "Contoso" });
  const result = validateOperatingModelKit(kit);
  assert.equal(result.ok, true);
});

test("validation fails on missing role and invalid cadence", () => {
  const kit = buildOperatingModelKit({
    organization: "Contoso",
    roles: {
      executiveSponsor: "CIO",
      coeLead: "CoE Lead",
      securityRepresentative: "Sec Lead",
      complianceRepresentative: "Comp Lead",
      responsibleAiLead: "RAI Lead",
      businessOwner: "",
    },
    attestationCadenceDays: 0,
  });
  const result = validateOperatingModelKit(kit);
  assert.equal(result.ok, false);
});

test("creates implementation checklist", () => {
  const kit = buildOperatingModelKit({ organization: "Contoso", attestationCadenceDays: 120 });
  const checklist = createOperatingModelChecklist(kit);
  assert.equal(checklist.length, 5);
  assert.match(checklist.join(" "), /120/);
});

