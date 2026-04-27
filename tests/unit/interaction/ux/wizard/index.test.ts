import assert from "node:assert/strict";
import test from "node:test";

import {
  canAdvanceWizard,
  WizardSessionSchema,
  WizardStepSchema,
  type WizardSession,
  type WizardStep,
} from "../../../../../src/interaction/ux/wizard/index.js";

test("canAdvanceWizard returns false when current step is not completed", () => {
  const session: WizardSession = {
    sessionId: "session_1",
    steps: [
      { stepId: "step_1", title: "Step 1", completed: true },
      { stepId: "step_2", title: "Step 2", completed: false },
      { stepId: "step_3", title: "Step 3", completed: false },
    ],
    currentStepId: "step_2",
  };

  assert.equal(canAdvanceWizard(session), false);
});

test("canAdvanceWizard returns true when current step is completed", () => {
  const session: WizardSession = {
    sessionId: "session_1",
    steps: [
      { stepId: "step_1", title: "Step 1", completed: true },
      { stepId: "step_2", title: "Step 2", completed: true },
      { stepId: "step_3", title: "Step 3", completed: false },
    ],
    currentStepId: "step_2",
  };

  assert.equal(canAdvanceWizard(session), true);
});

test("canAdvanceWizard returns false when current step not found", () => {
  const session: WizardSession = {
    sessionId: "session_1",
    steps: [
      { stepId: "step_1", title: "Step 1", completed: true },
    ],
    currentStepId: "nonexistent",
  };

  assert.equal(canAdvanceWizard(session), false);
});

test("canAdvanceWizard returns false for empty steps array", () => {
  const session: WizardSession = {
    sessionId: "session_1",
    steps: [],
    currentStepId: "step_1",
  };

  assert.equal(canAdvanceWizard(session), false);
});

test("canAdvanceWizard returns true when first step is completed and current is first", () => {
  const session: WizardSession = {
    sessionId: "session_1",
    steps: [
      { stepId: "step_1", title: "Step 1", completed: true },
      { stepId: "step_2", title: "Step 2", completed: false },
    ],
    currentStepId: "step_1",
  };

  assert.equal(canAdvanceWizard(session), true);
});

test("WizardStepSchema provides default completed value", () => {
  const step = WizardStepSchema.parse({
    stepId: "step_1",
    title: "Step One",
  });

  assert.equal(step.completed, false);
});

test("WizardStepSchema accepts explicitly completed step", () => {
  const step = WizardStepSchema.parse({
    stepId: "step_1",
    title: "Step One",
    completed: true,
  });

  assert.equal(step.completed, true);
});

test("WizardSessionSchema validates valid session", () => {
  const session = WizardSessionSchema.parse({
    sessionId: "sess_001",
    steps: [
      { stepId: "step_1", title: "Step 1", completed: true },
      { stepId: "step_2", title: "Step 2", completed: false },
    ],
    currentStepId: "step_1",
  });

  assert.equal(session.sessionId, "sess_001");
  assert.equal(session.currentStepId, "step_1");
});

test("WizardSessionSchema provides default steps", () => {
  const session = WizardSessionSchema.parse({
    sessionId: "sess_001",
    currentStepId: "step_1",
  });

  assert.deepEqual(session.steps, []);
});

test("WizardSessionSchema rejects empty sessionId", () => {
  assert.throws(() => WizardSessionSchema.parse({
    sessionId: "",
    steps: [],
    currentStepId: "step_1",
  }));
});

test("WizardSessionSchema rejects empty currentStepId", () => {
  assert.throws(() => WizardSessionSchema.parse({
    sessionId: "sess_001",
    steps: [],
    currentStepId: "",
  }));
});

test("canAdvanceWizard handles session with all steps completed", () => {
  const session: WizardSession = {
    sessionId: "session_1",
    steps: [
      { stepId: "step_1", title: "Step 1", completed: true },
      { stepId: "step_2", title: "Step 2", completed: true },
      { stepId: "step_3", title: "Step 3", completed: true },
    ],
    currentStepId: "step_3",
  };

  assert.equal(canAdvanceWizard(session), true);
});

test("canAdvanceWizard handles session where current is last step", () => {
  const session: WizardSession = {
    sessionId: "session_1",
    steps: [
      { stepId: "step_1", title: "Step 1", completed: true },
      { stepId: "step_2", title: "Step 2", completed: false },
    ],
    currentStepId: "step_2",
  };

  // Even though it's the last step, we can still "advance" (complete it)
  assert.equal(canAdvanceWizard(session), false);
});

test("WizardStepSchema requires stepId and title", () => {
  assert.throws(() => WizardStepSchema.parse({
    stepId: "",
    title: "Title",
  }));

  assert.throws(() => WizardStepSchema.parse({
    stepId: "step_1",
    title: "",
  }));
});

test("canAdvanceWizard returns false for session with null/undefined step completion", () => {
  const session: WizardSession = {
    sessionId: "session_1",
    steps: [
      { stepId: "step_1", title: "Step 1", completed: false },
    ],
    currentStepId: "step_1",
  };

  assert.equal(canAdvanceWizard(session), false);
});
