/**
 * Unit tests for Stable Prompt Injection Red Team Module - additional coverage.
 *
 * Tests the prompt injection test cases:
 * - Individual case definitions
 * - Case validation
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  STABLE_PROMPT_INJECTION_RED_TEAM_CASES,
  type StablePromptInjectionRedTeamOptions,
  type StablePromptInjectionScenarioResult,
  runStablePromptInjectionRedTeam,
} from "../../../../../src/platform/shared/stability/stable-prompt-injection-red-team.js";

test("STABLE_PROMPT_INJECTION_RED_TEAM_CASES has the expected number of cases [stable-prompt-injection-red-team-additional]", () => {
  // There are 5 defined test cases
  assert.ok(STABLE_PROMPT_INJECTION_RED_TEAM_CASES.length >= 5);
});

test("STABLE_PROMPT_INJECTION_RED_TEAM_CASES includes instruction override case [stable-prompt-injection-red-team-additional]", () => {
  const caseNames = STABLE_PROMPT_INJECTION_RED_TEAM_CASES.map((c) => c.scenarioId);

  assert.ok(caseNames.includes("instruction_override_secret_exfiltration"));
});

test("STABLE_PROMPT_INJECTION_RED_TEAM_CASES includes system prompt dump case [stable-prompt-injection-red-team-additional]", () => {
  const caseNames = STABLE_PROMPT_INJECTION_RED_TEAM_CASES.map((c) => c.scenarioId);

  assert.ok(caseNames.includes("system_prompt_dump_request"));
});

test("STABLE_PROMPT_INJECTION_RED_TEAM_CASES includes credential harvest case [stable-prompt-injection-red-team-additional]", () => {
  const caseNames = STABLE_PROMPT_INJECTION_RED_TEAM_CASES.map((c) => c.scenarioId);

  assert.ok(caseNames.includes("credential_harvest_bearer_token"));
});

test("STABLE_PROMPT_INJECTION_RED_TEAM_CASES includes benign runtime control case [stable-prompt-injection-red-team-additional]", () => {
  const caseNames = STABLE_PROMPT_INJECTION_RED_TEAM_CASES.map((c) => c.scenarioId);

  assert.ok(caseNames.includes("benign_runtime_control"));
});

test("STABLE_PROMPT_INJECTION_RED_TEAM_CASES high-risk cases expect redaction [stable-prompt-injection-red-team-additional]", () => {
  const highRiskCases = STABLE_PROMPT_INJECTION_RED_TEAM_CASES.filter((c) => c.expectedRisk === "high");

  assert.ok(highRiskCases.length > 0);
  assert.ok(highRiskCases.every((c) => c.expectedRuleIds.length > 0));
});

test("STABLE_PROMPT_INJECTION_RED_TEAM_CASES benign case has no risk [stable-prompt-injection-red-team-additional]", () => {
  const benignCase = STABLE_PROMPT_INJECTION_RED_TEAM_CASES.find(
    (c) => c.scenarioId === "benign_runtime_control",
  );

  assert.ok(benignCase);
  assert.equal(benignCase!.expectedRisk, "none");
  assert.deepEqual(benignCase!.expectedRuleIds, []);
  assert.deepEqual(benignCase!.expectedWarnings, []);
});

test("STABLE_PROMPT_INJECTION_RED_TEAM_CASES high-risk cases include warnings [stable-prompt-injection-red-team-additional]", () => {
  const highRiskCases = STABLE_PROMPT_INJECTION_RED_TEAM_CASES.filter((c) => c.expectedRisk === "high");

  assert.ok(highRiskCases.every((c) => c.expectedWarnings.includes("high_injection_risk")));
});

test("STABLE_PROMPT_INJECTION_RED_TEAM_CASES secret exfiltration case expects redaction [stable-prompt-injection-red-team-additional]", () => {
  const case_def = STABLE_PROMPT_INJECTION_RED_TEAM_CASES.find(
    (c) => c.scenarioId === "instruction_override_secret_exfiltration",
  );

  assert.ok(case_def);
  assert.equal(case_def!.expectsRedaction, true);
});

test("runStablePromptInjectionRedTeam creates output directory [stable-prompt-injection-red-team-additional]", async () => {
  const dir = `/tmp/prompt-injection-test-${Date.now()}`;
  const options: StablePromptInjectionRedTeamOptions = { outputDir: dir };

  const report = await runStablePromptInjectionRedTeam(options);

  assert.ok(report);
  assert.ok(report.totalScenarios > 0);
  assert.ok(report.scenarios.length > 0);

  // Cleanup
  const { rmSync } = await import("node:fs");
  rmSync(dir, { recursive: true, force: true });
});

test("runStablePromptInjectionRedTeam all scenarios pass for valid cases [stable-prompt-injection-red-team-additional]", async () => {
  const dir = `/tmp/prompt-injection-test-${Date.now()}`;
  const options: StablePromptInjectionRedTeamOptions = { outputDir: dir };

  const report = await runStablePromptInjectionRedTeam(options);

  // All defined cases should pass
  assert.equal(report.failedScenarios, 0);

  // Cleanup
  const { rmSync } = await import("node:fs");
  rmSync(dir, { recursive: true, force: true });
});

test("runStablePromptInjectionRedTeam report includes correct scenario IDs [stable-prompt-injection-red-team-additional]", async () => {
  const dir = `/tmp/prompt-injection-test-${Date.now()}`;
  const options: StablePromptInjectionRedTeamOptions = { outputDir: dir };

  const report = await runStablePromptInjectionRedTeam(options);

  const expectedIds = STABLE_PROMPT_INJECTION_RED_TEAM_CASES.map((c) => c.scenarioId);
  const actualIds = report.scenarios.map((s) => s.scenarioId);

  for (const expectedId of expectedIds) {
    assert.ok(actualIds.includes(expectedId), `Missing scenario: ${expectedId}`);
  }

  // Cleanup
  const { rmSync } = await import("node:fs");
  rmSync(dir, { recursive: true, force: true });
});

test("runStablePromptInjectionRedTeam report contains valid metadata [stable-prompt-injection-red-team-additional]", async () => {
  const dir = `/tmp/prompt-injection-test-${Date.now()}`;
  const options: StablePromptInjectionRedTeamOptions = { outputDir: dir };

  const report = await runStablePromptInjectionRedTeam(options);

  assert.ok(report.startedAt);
  assert.ok(report.finishedAt);
  assert.ok(report.startedAt <= report.finishedAt);
  assert.ok(report.outputDir);

  // Cleanup
  const { rmSync } = await import("node:fs");
  rmSync(dir, { recursive: true, force: true });
});

test("runStablePromptInjectionRedTeam scenarios have duration metrics [stable-prompt-injection-red-team-additional]", async () => {
  const dir = `/tmp/prompt-injection-test-${Date.now()}`;
  const options: StablePromptInjectionRedTeamOptions = { outputDir: dir };

  const report = await runStablePromptInjectionRedTeam(options);

  for (const scenario of report.scenarios) {
    assert.ok(scenario.durationMs > 0, `Scenario ${scenario.scenarioId} should have durationMs > 0`);
  }

  // Cleanup
  const { rmSync } = await import("node:fs");
  rmSync(dir, { recursive: true, force: true });
});
