import assert from "node:assert/strict";
import test from "node:test";

import {
  WizardStepSchema,
  WizardSessionSchema,
  canAdvanceWizard,
  type WizardStep,
  type WizardSession,
} from "../../../../src/interaction/ux/wizard/index.js";

test("WizardStepSchema validates correct step", () => {
  const result = WizardStepSchema.safeParse({
    stepId: "step_1",
    title: "First Step",
    completed: true,
  });

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.stepId, "step_1");
    assert.equal(result.data.title, "First Step");
    assert.equal(result.data.completed, true);
  }
});

test("WizardStepSchema applies default completed to false", () => {
  const result = WizardStepSchema.safeParse({
    stepId: "step_1",
    title: "First Step",
  });

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.completed, false);
  }
});

test("WizardStepSchema rejects empty stepId", () => {
  const result = WizardStepSchema.safeParse({
    stepId: "",
    title: "First Step",
  });

  assert.equal(result.success, false);
});

test("WizardStepSchema rejects empty title", () => {
  const result = WizardStepSchema.safeParse({
    stepId: "step_1",
    title: "",
  });

  assert.equal(result.success, false);
});

test("WizardSessionSchema validates correct session", () => {
  const result = WizardSessionSchema.safeParse({
    sessionId: "session_1",
    currentStepId: "step_1",
    steps: [
      { stepId: "step_1", title: "Step 1", completed: true },
      { stepId: "step_2", title: "Step 2", completed: false },
    ],
  });

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.sessionId, "session_1");
    assert.equal(result.data.currentStepId, "step_1");
    assert.equal(result.data.steps.length, 2);
  }
});

test("WizardSessionSchema applies default empty steps array", () => {
  const result = WizardSessionSchema.safeParse({
    sessionId: "session_1",
    currentStepId: "step_1",
  });

  assert.equal(result.success, true);
  if (result.success) {
    assert.deepEqual(result.data.steps, []);
  }
});

test("canAdvanceWizard returns true when current step is completed", () => {
  const session: WizardSession = {
    sessionId: "session_1",
    currentStepId: "step_1",
    steps: [
      { stepId: "step_1", title: "Step 1", completed: true },
      { stepId: "step_2", title: "Step 2", completed: false },
    ],
  };

  assert.equal(canAdvanceWizard(session), true);
});

test("canAdvanceWizard returns false when current step is not completed", () => {
  const session: WizardSession = {
    sessionId: "session_1",
    currentStepId: "step_2",
    steps: [
      { stepId: "step_1", title: "Step 1", completed: true },
      { stepId: "step_2", title: "Step 2", completed: false },
    ],
  };

  assert.equal(canAdvanceWizard(session), false);
});

test("canAdvanceWizard returns false when current step not found", () => {
  const session: WizardSession = {
    sessionId: "session_1",
    currentStepId: "nonexistent",
    steps: [
      { stepId: "step_1", title: "Step 1", completed: true },
    ],
  };

  assert.equal(canAdvanceWizard(session), false);
});

test("canAdvanceWizard handles empty steps array", () => {
  const session: WizardSession = {
    sessionId: "session_1",
    currentStepId: "step_1",
    steps: [],
  };

  assert.equal(canAdvanceWizard(session), false);
});

test("canAdvanceWizard works with single completed step", () => {
  const session: WizardSession = {
    sessionId: "session_1",
    currentStepId: "step_1",
    steps: [
      { stepId: "step_1", title: "Step 1", completed: true },
    ],
  };

  assert.equal(canAdvanceWizard(session), true);
});

test("canAdvanceWizard works with all steps completed", () => {
  const session: WizardSession = {
    sessionId: "session_1",
    currentStepId: "step_2",
    steps: [
      { stepId: "step_1", title: "Step 1", completed: true },
      { stepId: "step_2", title: "Step 2", completed: true },
    ],
  };

  assert.equal(canAdvanceWizard(session), true);
});
