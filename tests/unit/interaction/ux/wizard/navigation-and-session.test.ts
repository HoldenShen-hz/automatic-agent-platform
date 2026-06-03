/**
 * Unit tests for wizard: navigation, session persistence, and conditional steps
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  canGoBackWizard,
  canAdvanceWizard,
  WizardSessionSchema,
  WizardStepSchema,
  serializeWizardSession,
  deserializeWizardSession,
  goBackWizard,
  advanceWizard,
  advanceWizardToNextVisibleStep,
  recordWizardAnswer,
  saveWizardSession,
  getWizardProgress,
  getWizardRiskPreview,
  getVisibleSteps,
  validateWizardStep,
  type WizardSession,
  type WizardStep,
} from "../../../../../src/interaction/ux/wizard/index.js";

function makeStep(overrides: Partial<WizardStep> = {}): WizardStep {
  return WizardStepSchema.parse({
    stepId: "step_1",
    title: "Step 1",
    completed: false,
    ...overrides,
  });
}

// Helper to create a basic session
const createSession = (overrides: Partial<WizardSession> = {}): WizardSession => ({
  ...WizardSessionSchema.parse({
    sessionId: "sess_001",
    steps: [
      makeStep({ stepId: "step_1", completed: true }),
      makeStep({ stepId: "step_2", title: "Step 2", completed: false }),
      makeStep({ stepId: "step_3", title: "Step 3", completed: false }),
    ],
    currentStepId: "step_1",
    answers: {},
    history: [],
    visitedStepIds: [],
  }),
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
  assert.ok(result);
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
    makeStep({ stepId: "step_1", completed: true, condition: undefined }),
    makeStep({ stepId: "step_2", title: "Step 2", completed: false, condition: conditionFn }),
  ];

  const session = createSession({ steps: stepDefinitions });
  const json = serializeWizardSession(session);
  const restored = deserializeWizardSession(json, stepDefinitions);

  const firstStep = restored.steps[0];
  const secondStep = restored.steps[1];
  assert.ok(firstStep);
  assert.ok(secondStep);
  assert.equal(firstStep.condition, undefined);
  // Function reference equality won't work; verify the condition behavior instead
  assert.equal(secondStep.condition?.({ showAdvanced: true }), true);
  assert.equal(secondStep.condition?.({ showAdvanced: false }), false);
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
    makeStep({ stepId: "a", title: "A", completed: false }),
  ];

  const restored = deserializeWizardSession(json, stepDefinitions);
  assert.equal(restored.sessionId, "test_session");
  assert.equal(restored.currentStepId, "a");
});

test("serializeWizardSession does not include function source", () => {
  // Ensure condition functions are not serialized as [Function] or similar
  const session = createSession({
    steps: [makeStep({ stepId: "x", title: "X", completed: false, condition: () => true })],
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
    makeStep({ stepId: "basic", title: "Basic", completed: false }),
    makeStep({ stepId: "advanced", title: "Advanced", completed: false, condition: (answers) => answers.enableAdvanced === true }),
  ];

  const session = createSession({
    sessionId: "test",
    steps: stepDefinitions,
    currentStepId: "basic",
    answers: { enableAdvanced: true },
    history: [],
  });

  const visible = getVisibleSteps(session);
  assert.equal(visible.length, 2);
  assert.ok(visible.some((s) => s.stepId === "basic"));
  assert.ok(visible.some((s) => s.stepId === "advanced"));
});

test("getVisibleSteps excludes steps when condition returns false", () => {
  const stepDefinitions: WizardStep[] = [
    makeStep({ stepId: "basic", title: "Basic", completed: false }),
    makeStep({ stepId: "advanced", title: "Advanced", completed: false, condition: (answers) => answers.enableAdvanced === true }),
  ];

  const session = createSession({
    sessionId: "test",
    steps: stepDefinitions,
    currentStepId: "basic",
    answers: { enableAdvanced: false },
    history: [],
  });

  const visible = getVisibleSteps(session);
  assert.equal(visible.length, 1);
  assert.equal(visible[0]?.stepId, "basic");
});

test("getVisibleSteps handles condition with undefined answers", () => {
  const stepDefinitions: WizardStep[] = [
    makeStep({ stepId: "step_1", title: "S1", completed: false }),
    makeStep({ stepId: "step_2", title: "S2", completed: false, condition: (answers) => answers.flag === true }),
  ];

  const session = createSession({
    sessionId: "test",
    steps: stepDefinitions,
    currentStepId: "step_1",
    answers: {},
    history: [],
  });

  const visible = getVisibleSteps(session);
  // step_2 should be hidden because answers.flag is falsy
  assert.equal(visible.length, 1);
  assert.equal(visible[0]?.stepId, "step_1");
});

test("advanceWizard handles step order correctly", () => {
  const session = createSession({ currentStepId: "step_1" });
  const next = advanceWizard(session, "step_2");
  const final = advanceWizard(next, "step_3");

  assert.equal(final.currentStepId, "step_3");
  assert.deepEqual(final.history, ["step_1", "step_2"]);
});

test("advanceWizardToNextVisibleStep skips hidden conditional steps", () => {
  const session = createSession({
    steps: [
      makeStep({ stepId: "step_1", completed: true }),
      makeStep({ stepId: "hidden", title: "Hidden", completed: false, condition: () => false }),
      makeStep({ stepId: "step_3", title: "Step 3", completed: false }),
    ],
  });

  const next = advanceWizardToNextVisibleStep(session);
  assert.notEqual(next, null);
  assert.ok(next);
  assert.equal(next.currentStepId, "step_3");
});

test("recordWizardAnswer persists answer values", () => {
  const updated = recordWizardAnswer(createSession(), "business_type", "finance");
  assert.equal(updated.answers["business_type"], "finance");
});

test("saveWizardSession stamps lastSavedAt", () => {
  const saved = saveWizardSession(createSession(), "2026-05-08T00:00:00.000Z");
  assert.equal(saved.lastSavedAt, "2026-05-08T00:00:00.000Z");
});

test("getWizardProgress reports completion over visible steps", () => {
  const progress = getWizardProgress(createSession({
    steps: [
      makeStep({ stepId: "step_1", completed: true }),
      makeStep({ stepId: "step_2", title: "Step 2", completed: false }),
      makeStep({ stepId: "hidden", title: "Hidden", completed: false, condition: () => false }),
    ],
  }));

  assert.equal(progress.visibleSteps, 2);
  assert.equal(progress.completedSteps, 1);
  assert.equal(progress.completionPercent, 50);
});

test("goBackWizard restores previous current step", () => {
  const session = createSession({ currentStepId: "step_3", history: ["step_1", "step_2"] });
  const back = goBackWizard(session);

  assert.notEqual(back, null);
  assert.ok(back);
  assert.equal(back.currentStepId, "step_2");
  assert.deepEqual(back.history, ["step_1"]);
});

test("validateWizardStep reports missing required answers", () => {
  const session = createSession({
    steps: [
      makeStep({
        stepId: "risk_setup",
        title: "Risk Setup",
        completed: true,
        requiredAnswerKeys: ["budget", "owner"],
      }),
    ],
    currentStepId: "risk_setup",
    answers: { budget: "100" },
  });

  const validation = validateWizardStep(session);
  assert.equal(validation.valid, false);
  assert.deepEqual(validation.missingAnswerKeys, ["owner"]);
  assert.equal(canAdvanceWizard(session), false);
});

test("getWizardRiskPreview surfaces medium+ risk steps and review requirement", () => {
  const session = createSession({
    steps: [
      makeStep({ stepId: "basic", title: "Basic", completed: true }),
      makeStep({
        stepId: "governance",
        title: "Governance",
        completed: false,
        riskLevel: "high",
        riskHints: ["human_approval_required"],
      }),
    ],
    currentStepId: "basic",
  });

  const preview = getWizardRiskPreview(session);
  assert.equal(preview.highestRisk, "high");
  assert.deepEqual(preview.flaggedStepIds, ["governance"]);
  assert.equal(preview.reviewRequired, true);
  assert.deepEqual(preview.hints, ["human_approval_required"]);
});
