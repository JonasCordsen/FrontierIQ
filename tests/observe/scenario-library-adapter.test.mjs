import test from "node:test";
import assert from "node:assert/strict";

import {
  buildScenarioUseCaseCatalog,
  mapScenarioUseCaseToSignals,
  SCENARIO_LIBRARY_ENDPOINTS,
} from "../../src/observe/adapters/scenario-library.mjs";
import { SOLUTION_IDS } from "../../src/observe/foundation/solution-taxonomy.mjs";

test("scenario library endpoints are defined", () => {
  assert.equal(SCENARIO_LIBRARY_ENDPOINTS.scenarioSelection, "/ScenarioIndustryRoleLogic");
  assert.equal(SCENARIO_LIBRARY_ENDPOINTS.scenarioTable, "/_api/cr974_copilotscenarios");
});

test("buildScenarioUseCaseCatalog normalizes row and maps product features", () => {
  const catalog = buildScenarioUseCaseCatalog([
    {
      cr974_name: "Reduce incident triage time",
      cr974_functionalareas: "Information Technology (IT)",
      cr974_scenarioleveleffortrating: "Build",
      cr974_assettype: "Scenario Slide",
      cr974_securitycopilot: "Y",
      cr974_microsoft365copilot: "Y",
      cr974_azureaistudio: "Y",
      cr974_link: "https://example/download",
      cr974_demolink: "https://example/demo",
      cr974_promptsavailableincopilotlab: "Y",
      cr974_flw: "N",
    },
  ]);

  assert.equal(catalog.length, 1);
  assert.deepEqual(catalog[0].products, ["Azure AI Foundry", "M365 Copilot", "Security Copilot"]);
  assert.ok(catalog[0].solutionIds.includes(SOLUTION_IDS.AZURE_AI_FOUNDRY));
  assert.ok(catalog[0].solutionIds.includes(SOLUTION_IDS.M365_COPILOT));
  assert.ok(catalog[0].solutionIds.includes(SOLUTION_IDS.SECURITY_COPILOT));
});

test("mapScenarioUseCaseToSignals emits one normalized signal per mapped solution", () => {
  const [useCase] = buildScenarioUseCaseCatalog([
    {
      cr974_name: "Finance close acceleration",
      cr974_functionalareas: "Finance",
      cr974_scenarioleveleffortrating: "Buy",
      cr974_assettype: "Scenario Slide",
      cr974_microsoft365copilot: "Y",
      cr974_link: "https://example/download",
      cr974_demolink: "",
      cr974_promptsavailableincopilotlab: "N",
      cr974_flw: "N",
    },
  ]);

  const signals = mapScenarioUseCaseToSignals(useCase, {
    tenantId: "tenant-a",
    timestamp: "2026-06-24T00:00:00Z",
  });
  assert.equal(signals.length, 1);
  assert.equal(signals[0].solutionId, SOLUTION_IDS.M365_COPILOT);
  assert.equal(signals[0].signalType, "scenario_use_case");
});

