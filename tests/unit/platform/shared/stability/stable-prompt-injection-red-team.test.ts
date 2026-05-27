import assert from "node:assert/strict";
import test from "node:test";

import {
  STABLE_PROMPT_INJECTION_RED_TEAM_CASES,
  runStablePromptInjectionRedTeam,
} from "../../../../../src/platform/shared/stability/stable-prompt-injection-red-team.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";

test("stable prompt injection red-team suite covers the expected adversarial and control cases [stable-prompt-injection-red-team]", async () => {
  const workspace = createTempWorkspace("aa-prompt-red-team-unit-");

  try {
    const report = await runStablePromptInjectionRedTeam({ outputDir: workspace });

    assert.equal(report.totalScenarios, STABLE_PROMPT_INJECTION_RED_TEAM_CASES.length);
    assert.equal(report.failedScenarios, 0);
    assert.equal(report.passedScenarios, STABLE_PROMPT_INJECTION_RED_TEAM_CASES.length);
    assert.ok(report.scenarios.some((scenario) => scenario.scenarioId === "instruction_override_secret_exfiltration"));
    assert.ok(report.scenarios.some((scenario) => scenario.scenarioId === "system_prompt_dump_request"));
    assert.ok(report.scenarios.some((scenario) => scenario.scenarioId === "benign_runtime_control"));
    assert.ok(
      report.scenarios.some(
        (scenario) =>
          scenario.scenarioId === "credential_harvest_bearer_token" &&
          scenario.redactionCount > 0 &&
          scenario.actualRisk === "high",
      ),
    );
    assert.ok(
      report.scenarios.some(
        (scenario) => scenario.scenarioId === "benign_runtime_control" && scenario.actualRisk === "none",
      ),
    );
  } finally {
    cleanupPath(workspace);
  }
});

test("stable prompt injection red-team produces complete scenario result structure for all cases [stable-prompt-injection-red-team]", async () => {
  const workspace = createTempWorkspace("aa-prompt-red-team-structure-");

  try {
    const report = await runStablePromptInjectionRedTeam({ outputDir: workspace });

    // Every scenario result must have all required fields
    for (const scenario of report.scenarios) {
      assert.ok(scenario.scenarioId, "scenarioId must be present");
      assert.ok(typeof scenario.passed === "boolean", "passed must be boolean");
      assert.ok(typeof scenario.durationMs === "number", "durationMs must be number");
      assert.ok(scenario.summary, "summary must be present");
      assert.ok(scenario.expectedRisk, "expectedRisk must be present");
      assert.ok(scenario.actualRisk, "actualRisk must be present");
      assert.ok(Array.isArray(scenario.matchedRuleIds), "matchedRuleIds must be array");
      assert.ok(Array.isArray(scenario.warnings), "warnings must be array");
      assert.ok(typeof scenario.redactionCount === "number", "redactionCount must be number");
      assert.ok(typeof scenario.sanitizedExcerpt === "string", "sanitizedExcerpt must be string");
    }
  } finally {
    cleanupPath(workspace);
  }
});

test("stable prompt injection red-team verifies risk classification matches expected for each scenario [stable-prompt-injection-red-team]", async () => {
  const workspace = createTempWorkspace("aa-prompt-red-team-risk-");

  try {
    const report = await runStablePromptInjectionRedTeam({ outputDir: workspace });

    // Find the high-risk credential exfiltration scenario
    const credScenario = report.scenarios.find((s) => s.scenarioId === "credential_harvest_bearer_token");
    assert.ok(credScenario);
    assert.equal(credScenario.expectedRisk, "high");
    assert.equal(credScenario.actualRisk, "high");
    assert.ok(credScenario.matchedRuleIds.includes("credential_exfiltration"));
    assert.ok(credScenario.warnings.includes("secret_redacted"));
    assert.ok(credScenario.warnings.includes("high_injection_risk"));
    assert.ok(credScenario.redactionCount > 0, "redactionCount should be > 0 for credential exfiltration");

    // Find the benign control scenario
    const benignScenario = report.scenarios.find((s) => s.scenarioId === "benign_runtime_control");
    assert.ok(benignScenario);
    assert.equal(benignScenario.expectedRisk, "none");
    assert.equal(benignScenario.actualRisk, "none");
    assert.equal(benignScenario.matchedRuleIds.length, 0);
    assert.equal(benignScenario.warnings.length, 0);
    assert.equal(benignScenario.redactionCount, 0);
  } finally {
    cleanupPath(workspace);
  }
});
