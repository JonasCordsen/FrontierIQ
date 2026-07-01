import { SOLUTION_CATALOG, isKnownSolution } from "../../observe/foundation/solution-taxonomy.mjs";
import { CONTROL_IDS, isKnownControl } from "./control-catalog.mjs";
import { getEvidenceArtifactsForControl } from "./evidence-mapping.mjs";

const REQUIRED_CONTROLS = Object.freeze([
  CONTROL_IDS.ACCESS_LEAST_PRIVILEGE,
  CONTROL_IDS.ACCESS_OWNER_ACCOUNTABILITY,
  CONTROL_IDS.DATA_RESIDENCY_ENFORCEMENT,
  CONTROL_IDS.DATA_RETENTION_POLICY,
  CONTROL_IDS.AUDIT_TRACEABILITY,
  CONTROL_IDS.APPROVAL_GATES,
  CONTROL_IDS.RESPONSIBLE_AI_REVIEW,
]);

/**
 * @typedef {{
 *   solutionId: string;
 *   profileVersion: string;
 *   controls: Array<{
 *     controlId: string;
 *     enforcementLevel: "required"|"conditional";
 *     rationale: string;
 *     evidenceArtifacts: string[];
 *   }>;
 * }} PolicyBaselineProfile
 */

/**
 * @returns {PolicyBaselineProfile[]}
 */
export function buildPolicyBaselineLibrary() {
  return SOLUTION_CATALOG.map((solution) => ({
    solutionId: solution.id,
    profileVersion: "2026.06.1",
    controls: REQUIRED_CONTROLS.map((controlId) => ({
      controlId,
      enforcementLevel: solution.mvpPhase1Implemented ? "required" : "conditional",
      rationale: `${solution.name} baseline control for ${controlId}`,
      evidenceArtifacts: getEvidenceArtifactsForControl(controlId),
    })),
  }));
}

/**
 * @param {string} solutionId
 */
export function getPolicyProfile(solutionId) {
  if (!isKnownSolution(solutionId)) return undefined;
  return buildPolicyBaselineLibrary().find((profile) => profile.solutionId === solutionId);
}

/**
 * @param {PolicyBaselineProfile} profile
 * @returns {{ ok: true } | { ok: false; errors: string[] }}
 */
export function validatePolicyProfile(profile) {
  /** @type {string[]} */
  const errors = [];

  if (!profile || typeof profile !== "object") {
    return { ok: false, errors: ["profile must be an object"] };
  }

  if (typeof profile.solutionId !== "string" || !isKnownSolution(profile.solutionId)) {
    errors.push("solutionId is invalid or unknown");
  }

  if (!Array.isArray(profile.controls) || profile.controls.length === 0) {
    errors.push("controls must be a non-empty array");
  }

  const controlIds = new Set();
  for (const control of profile.controls ?? []) {
    if (!isKnownControl(control.controlId)) {
      errors.push(`unknown controlId: ${control.controlId}`);
    }
    controlIds.add(control.controlId);
    if (!Array.isArray(control.evidenceArtifacts) || control.evidenceArtifacts.length === 0) {
      errors.push(`control ${control.controlId} requires at least one evidence artifact`);
    }
  }

  for (const requiredControl of REQUIRED_CONTROLS) {
    if (!controlIds.has(requiredControl)) {
      errors.push(`missing required control: ${requiredControl}`);
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return { ok: true };
}

export function listRequiredControls() {
  return [...REQUIRED_CONTROLS];
}

