import test from "node:test";
import assert from "node:assert/strict";

import {
  buildPolicyBaselineLibrary,
  getPolicyProfile,
  listRequiredControls,
  validatePolicyProfile,
} from "../../src/govern/policy/baseline-library.mjs";
import { CONTROL_IDS, isKnownControl } from "../../src/govern/policy/control-catalog.mjs";
import { getEvidenceArtifactsForControl } from "../../src/govern/policy/evidence-mapping.mjs";
import { SOLUTION_IDS } from "../../src/observe/foundation/solution-taxonomy.mjs";

test("baseline library returns profiles for all known solutions", () => {
  const profiles = buildPolicyBaselineLibrary();
  assert.ok(profiles.length >= 12);
  assert.ok(getPolicyProfile(SOLUTION_IDS.M365_COPILOT));
  assert.ok(getPolicyProfile(SOLUTION_IDS.AZURE_AI_FOUNDRY));
});

test("all required controls are known and mapped to evidence", () => {
  for (const controlId of listRequiredControls()) {
    assert.equal(isKnownControl(controlId), true);
    assert.ok(getEvidenceArtifactsForControl(controlId).length > 0);
  }
});

test("profile validation succeeds for generated profile", () => {
  const profile = getPolicyProfile(SOLUTION_IDS.COPILOT_STUDIO);
  assert.ok(profile);
  const result = validatePolicyProfile(profile);
  assert.equal(result.ok, true);
});

test("profile validation fails when required control is removed", () => {
  const profile = getPolicyProfile(SOLUTION_IDS.FABRIC);
  assert.ok(profile);
  const broken = {
    ...profile,
    controls: profile.controls.filter((control) => control.controlId !== CONTROL_IDS.AUDIT_TRACEABILITY),
  };
  const result = validatePolicyProfile(broken);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.errors.join(" "), /missing required control/);
  }
});

