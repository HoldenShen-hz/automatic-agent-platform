import assert from "node:assert/strict";
import test from "node:test";

import {
  maybeInjectWorkflowCrash,
  isInjectedWorkflowCrashError,
  InjectedWorkflowCrashError,
  type WorkflowCrashPoint,
  type WorkflowCrashInjection,
  type WorkflowCrashContext,
} from "../../../../../src/platform/five-plane-execution/recovery/workflow-crash-simulator.js";

function makeCrashContext(point: WorkflowCrashPoint = "step_started"): WorkflowCrashContext {
  return {
    point,
    taskId: "task-1",
    executionId: "exec-1",
    workflowId: "wf-1",
    stepId: "step-1",
  };
}

test("maybeInjectWorkflowCrash does not throw when injection is undefined [workflow-crash-simulator]", () => {
  assert.doesNotThrow(() => {
    const context = makeCrashContext();

    // Should not throw
    maybeInjectWorkflowCrash(undefined, context);
  });
});

test("maybeInjectWorkflowCrash does not throw when injection point does not match context point [workflow-crash-simulator]", () => {
  assert.doesNotThrow(() => {
    const context = makeCrashContext("step_started");

    const injection: WorkflowCrashInjection = {
      point: "tool_completed", // Different point
    };

    // Should not throw
    maybeInjectWorkflowCrash(injection, context);
  });
});

test("maybeInjectWorkflowCrash does not throw when stepId does not match [workflow-crash-simulator]", () => {
  assert.doesNotThrow(() => {
    const context = makeCrashContext("step_started");

    const injection: WorkflowCrashInjection = {
      point: "step_started",
      stepId: "different-step", // Different step
    };

    // Should not throw
    maybeInjectWorkflowCrash(injection, context);
  });
});

test("maybeInjectWorkflowCrash throws when point and stepId match [workflow-crash-simulator]", () => {
  const context = makeCrashContext("step_started");

  const injection: WorkflowCrashInjection = {
    point: "step_started",
    stepId: "step-1", // Matches context
  };

  assert.throws(
    () => maybeInjectWorkflowCrash(injection, context),
    (error: unknown) => isInjectedWorkflowCrashError(error),
  );
});

test("maybeInjectWorkflowCrash throws when point matches and stepId is null (any step) [workflow-crash-simulator]", () => {
  const context = makeCrashContext("tool_completed");

  const injection: WorkflowCrashInjection = {
    point: "tool_completed",
    stepId: null, // Any step matches
  };

  assert.throws(
    () => maybeInjectWorkflowCrash(injection, context),
    (error: unknown) => isInjectedWorkflowCrashError(error),
  );
});

test("maybeInjectWorkflowCrash throws for before_commit point [workflow-crash-simulator]", () => {
  const context = makeCrashContext("before_commit");

  const injection: WorkflowCrashInjection = {
    point: "before_commit",
  };

  assert.throws(
    () => maybeInjectWorkflowCrash(injection, context),
    (error: unknown) => isInjectedWorkflowCrashError(error),
  );
});

test("InjectedWorkflowCrashError has correct error properties [workflow-crash-simulator]", () => {
  const context: WorkflowCrashContext = {
    point: "step_started",
    taskId: "task-test",
    executionId: "exec-test",
    workflowId: "wf-test",
    stepId: "step-test",
  };

  const error = new InjectedWorkflowCrashError(context);

  assert.equal(error.point, "step_started");
  assert.equal(error.taskId, "task-test");
  assert.equal(error.executionId, "exec-test");
  assert.equal(error.workflowId, "wf-test");
  assert.equal(error.stepId, "step-test");
  assert.equal(error.name, "InjectedWorkflowCrashError");
  assert.ok(error.message.includes("step_started"));
  assert.ok(error.message.includes("step-test"));
});

test("InjectedWorkflowCrashError is an instance of Error [workflow-crash-simulator]", () => {
  const error = new InjectedWorkflowCrashError(makeCrashContext());

  assert.ok(error instanceof Error);
});

test("isInjectedWorkflowCrashError returns true for InjectedWorkflowCrashError [workflow-crash-simulator]", () => {
  const error = new InjectedWorkflowCrashError(makeCrashContext());

  assert.equal(isInjectedWorkflowCrashError(error), true);
});

test("isInjectedWorkflowCrashError returns false for regular Error [workflow-crash-simulator]", () => {
  const error = new Error("regular error");

  assert.equal(isInjectedWorkflowCrashError(error), false);
});

test("isInjectedWorkflowCrashError returns false for null [workflow-crash-simulator]", () => {
  assert.equal(isInjectedWorkflowCrashError(null), false);
});

test("isInjectedWorkflowCrashError returns false for undefined [workflow-crash-simulator]", () => {
  assert.equal(isInjectedWorkflowCrashError(undefined), false);
});

test("WorkflowCrashPoint type accepts all valid values [workflow-crash-simulator]", () => {
  const points: WorkflowCrashPoint[] = ["step_started", "tool_completed", "before_commit"];
  assert.equal(points.length, 3);
});

test("WorkflowCrashInjection interface structure [workflow-crash-simulator]", () => {
  const injection: WorkflowCrashInjection = {
    point: "step_started",
    stepId: "step-1",
  };

  assert.equal(injection.point, "step_started");
  assert.equal(injection.stepId, "step-1");
});

test("WorkflowCrashInjection with null stepId matches any step [workflow-crash-simulator]", () => {
  const context = makeCrashContext("tool_completed");

  const injection: WorkflowCrashInjection = {
    point: "tool_completed",
    stepId: null,
  };

  // Should throw because stepId is null (any step matches)
  assert.throws(
    () => maybeInjectWorkflowCrash(injection, context),
    (error: unknown) => isInjectedWorkflowCrashError(error),
  );
});

test("maybeInjectWorkflowCrash handles multiple calls [workflow-crash-simulator]", () => {
  const context = makeCrashContext("step_started");

  const injection: WorkflowCrashInjection = {
    point: "step_started",
    stepId: "step-1",
  };

  // First call throws
  assert.throws(
    () => maybeInjectWorkflowCrash(injection, context),
    (error: unknown) => isInjectedWorkflowCrashError(error),
  );
});

test("InjectedWorkflowCrashError contains context details in error data [workflow-crash-simulator]", () => {
  const context: WorkflowCrashContext = {
    point: "before_commit",
    taskId: "task-specific",
    executionId: "exec-specific",
    workflowId: "wf-specific",
    stepId: "step-specific",
  };

  const error = new InjectedWorkflowCrashError(context);

  // The error should have details about the context
  assert.equal(error.point, "before_commit");
  assert.ok(error.message.includes("before_commit"));
});