/**
 * Unit tests for wizard: navigation, session persistence, and conditional steps
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  canGoBackWizard,
  canAdvanceWizard,
  serializeWizardSession,
  deserializeWizardSession,
  goBackWizard,
  advanceWizard,
  getVisibleSteps,
  type WizardSession,
  type WizardStep,
} from "../../../../../src/interaction/ux/wizard/index.js";

// Helper to create a basic session
const createSession = (overrides: Partial<WizardSession> = {}): WizardSession => ({
  sessionId: "sess_001",
  steps: [
    { stepId: "step_1", title: "Step 1", completed: true },
    { stepId: "step_2", title: "Step 2", completed: false },
    { stepId: "step_3", title: "Step 3", completed: false },
  ],
  currentStepId: "step_1",
  answers: {},
  history: [],
  ...overrides,
});

test("canGoBackWizard returns true when history is not empty", () => {
  const session = createSession({ history: ["previous_step"] });
  assert.equal(canGoBackWizard(session), true);
});

test("canGoBackWizard returns false when history is empty", () => {
  const session = createSession({ history: [] });
  assert.equal(canGoBackWizard(session), false);
});

test("canGoBackWizard returns false for session with empty history array", () => {
  const session = createSession();
  assert.equal(canGoBackWizard(session), false);
});

test("goBackWizard returns previous step and removes it from history", () => {
  const session = createSession({ currentStepId: "step_2", history: ["step_1"] });
  const result = goBackWizard(session);

  assert.notEqual(result, null);
  assert.equal(result.currentStepId, "step_1");
  assert.deepEqual(result.history, []);
});

test("goBackWizard returns null when history is empty", () => {
  const session = createSession({ history: [] });
  const result = goBackWizard(session);
  assert.equal(result, null);
});

test("advanceWizard moves to next step and updates history", () => {
  const session = createSession({ currentStepId: "step_1", history: [] });
  const result = advanceWizard(session, "step_2");

  assert.equal(result.currentStepId, "step_2");
  assert.deepEqual(result.history, ["step_1"]);
});

test("advanceWizard preserves existing history", () => {
  const session = createSession({ currentStepId: "step_2", history: ["step_1"] });
  const result = advanceWizard(session, "step_3");

  assert.equal(result.currentStepId, "step_3");
  assert.deepEqual(result.history, ["step_1", "step_2"]);
});

test("serializeWizardSession strips condition functions", () => {
  const session = createSession();
  const json = serializeWizardSession(session);
  const parsed = JSON.parse(json);

  assert.equal(parsed.sessionId, "sess_001");
  assert.equal(parsed.currentStepId, "step_1");
  // conditions are functions and should be stripped (not present in JSON)
  assert.equal(parsed.steps[0].condition, undefined);
});

test("serializeWizardSession preserves answers and history", () => {
  const session = createSession({
    answers: { name: "test", count: 42 },
    history: ["step_0"],
  });
  const json = serializeWizardSession(session);
  const parsed = JSON.parse(json);

  assert.equal(parsed.answers.name, "test");
  assert.deepEqual(parsed.history, ["step_0"]);
});

test("deserializeWizardSession restores step conditions from definitions", () => {
  const conditionFn = (answers: Record<string, unknown>) => answers.showAdvanced === true;

  const stepDefinitions: WizardStep[] = [
    { stepId: "step_1", title: "Step 1", completed: true, condition: undefined },
    { stepId: "step_2", title: "Step 2", completed: false, condition: conditionFn },
  ];

  const session = createSession({ steps: stepDefinitions });
  const json = serializeWizardSession(session);
  const restored = deserializeWizardSession(json, stepDefinitions);

  assert.equal(restored.steps[0].condition, undefined);
  // Function reference equality won't work; verify the condition behavior instead
  assert.equal(restored.steps[1].condition?.({ showAdvanced: true }), true);
  assert.equal(restored.steps[1].condition?.({ showAdvanced: false }), false);
});

test("deserializeWizardSession parses valid JSON", () => {
  const json = JSON.stringify({
    sessionId: "test_session",
    steps: [{ stepId: "a", title: "A", completed: false }],
    currentStepId: "a",
    answers: {},
    history: [],
  });

  const stepDefinitions: WizardStep[] = [
    { stepId: "a", title: "A", completed: false },
  ];

  const restored = deserializeWizardSession(json, stepDefinitions);
  assert.equal(restored.sessionId, "test_session");
  assert.equal(restored.currentStepId, "a");
});

test("serializeWizardSession does not include function source", () => {
  // Ensure condition functions are not serialized as [Function] or similar
  const session = createSession({
    steps: [{ stepId: "x", title: "X", completed: false, condition: () => true }],
  });
  const json = serializeWizardSession(session);

  // Should not throw and should be valid JSON
  assert.doesNotThrow(() => JSON.parse(json));
  const parsed = JSON.parse(json);
  assert.equal(parsed.steps[0].condition, undefined);
});

test("getVisibleSteps returns all steps when no conditions defined", () => {
  const session = createSession();
  const visible = getVisibleSteps(session);
  assert.equal(visible.length, 3);
});

test("getVisibleSteps filters steps based on condition", () => {
  const stepDefinitions: WizardStep[] = [
    { stepId: "basic", title: "Basic", completed: false },
    { stepId: "advanced", title: "Advanced", completed: false, condition: (answers) => answers.enableAdvanced === true },
  ];

  const session: WizardSession = {
    sessionId: "test",
    steps: stepDefinitions,
    currentStepId: "basic",
    answers: { enableAdvanced: true },
    history: [],
  };

  const visible = getVisibleSteps(session);
  assert.equal(visible.length, 2);
  assert.ok(visible.some((s) => s.stepId === "basic"));
  assert.ok(visible.some((s) => s.stepId === "advanced"));
});

test("getVisibleSteps excludes steps when condition returns false", () => {
  const stepDefinitions: WizardStep[] = [
    { stepId: "basic", title: "Basic", completed: false },
    { stepId: "advanced", title: "Advanced", completed: false, condition: (answers) => answers.enableAdvanced === true },
  ];

  const session: WizardSession = {
    sessionId: "test",
    steps: stepDefinitions,
    currentStepId: "basic",
    answers: { enableAdvanced: false },
    history: [],
  };

  const visible = getVisibleSteps(session);
  assert.equal(visible.length, 1);
  assert.equal(visible[0].stepId, "basic");
});

test("getVisibleSteps handles condition with undefined answers", () => {
  const stepDefinitions: WizardStep[] = [
    { stepId: "step_1", title: "S1", completed: false },
    { stepId: "step_2", title: "S2", completed: false, condition: (answers) => answers.flag === true },
  ];

  const session: WizardSession = {
    sessionId: "test",
    steps: stepDefinitions,
    currentStepId: "step_1",
    answers: {},
    history: [],
  };

  const visible = getVisibleSteps(session);
  // step_2 should be hidden because answers.flag is falsy
  assert.equal(visible.length, 1);
  assert.equal(visible[0].stepId, "step_1");
});

test("advanceWizard handles step order correctly", () => {
  const session = createSession({ currentStepId: "step_1" });
  const next = advanceWizard(session, "step_2");
  const final = advanceWizard(next, "step_3");

  assert.equal(final.currentStepId, "step_3");
  assert.deepEqual(final.history, ["step_1", "step_2"]);
});

test("goBackWizard restores previous current step", () => {
  const session = createSession({ currentStepId: "step_3", history: ["step_1", "step_2"] });
  const back = goBackWizard(session);

  assert.notEqual(back, null);
  assert.equal(back.currentStepId, "step_2");
  assert.deepEqual(back.history, ["step_1"]);
});