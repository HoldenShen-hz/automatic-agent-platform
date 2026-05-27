/**
 * Unit Tests: Workflow Crash Simulator
 *
 * Tests crash injection functionality for stability testing.
 */

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

function makeCrashContext(
  point: WorkflowCrashPoint = "step_started",
  taskId = "task-1",
  executionId = "exec-1",
  workflowId = "wf-1",
  stepId = "step-1",
): WorkflowCrashContext {
  return { point, taskId, executionId, workflowId, stepId };
}

test("maybeInjectWorkflowCrash does not throw when injection is undefined [crash-simulation]", () => {
  const context = makeCrashContext();
  maybeInjectWorkflowCrash(undefined, context);
});

test("maybeInjectWorkflowCrash does not throw when point does not match [crash-simulation]", () => {
  const context = makeCrashContext("step_started");
  const injection: WorkflowCrashInjection = { point: "tool_completed" };
  maybeInjectWorkflowCrash(injection, context);
});

test("maybeInjectWorkflowCrash does not throw when stepId does not match [crash-simulation]", () => {
  const context = makeCrashContext("step_started");
  const injection: WorkflowCrashInjection = { point: "step_started", stepId: "different-step" };
  maybeInjectWorkflowCrash(injection, context);
});

test("maybeInjectWorkflowCrash throws when point and stepId match [crash-simulation]", () => {
  const context = makeCrashContext("step_started", "task-1", "exec-1", "wf-1", "step-1");
  const injection: WorkflowCrashInjection = { point: "step_started", stepId: "step-1" };
  assert.throws(
    () => maybeInjectWorkflowCrash(injection, context),
    (err: unknown) => isInjectedWorkflowCrashError(err),
  );
});

test("maybeInjectWorkflowCrash throws when point matches and stepId is null (any step) [crash-simulation]", () => {
  const context = makeCrashContext("tool_completed");
  const injection: WorkflowCrashInjection = { point: "tool_completed", stepId: null };
  assert.throws(
    () => maybeInjectWorkflowCrash(injection, context),
    (err: unknown) => isInjectedWorkflowCrashError(err),
  );
});

test("maybeInjectWorkflowCrash throws for before_commit point [crash-simulation]", () => {
  const context = makeCrashContext("before_commit");
  const injection: WorkflowCrashInjection = { point: "before_commit" };
  assert.throws(
    () => maybeInjectWorkflowCrash(injection, context),
    (err: unknown) => isInjectedWorkflowCrashError(err),
  );
});

test("InjectedWorkflowCrashError has correct error properties [crash-simulation]", () => {
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

test("InjectedWorkflowCrashError is an instance of Error [crash-simulation]", () => {
  const error = new InjectedWorkflowCrashError(makeCrashContext());
  assert.ok(error instanceof Error);
});

test("isInjectedWorkflowCrashError returns true for InjectedWorkflowCrashError [crash-simulation]", () => {
  const error = new InjectedWorkflowCrashError(makeCrashContext());
  assert.equal(isInjectedWorkflowCrashError(error), true);
});

test("isInjectedWorkflowCrashError returns false for regular Error [crash-simulation]", () => {
  const error = new Error("regular error");
  assert.equal(isInjectedWorkflowCrashError(error), false);
});

test("isInjectedWorkflowCrashError returns false for null [crash-simulation]", () => {
  assert.equal(isInjectedWorkflowCrashError(null), false);
});

test("isInjectedWorkflowCrashError returns false for undefined [crash-simulation]", () => {
  assert.equal(isInjectedWorkflowCrashError(undefined), false);
});

test("WorkflowCrashPoint type accepts all valid values [crash-simulation]", () => {
  const points: WorkflowCrashPoint[] = ["step_started", "tool_completed", "before_commit"];
  assert.equal(points.length, 3);
});

test("WorkflowCrashInjection with null stepId matches any step [crash-simulation]", () => {
  const context = makeCrashContext("tool_completed");
  const injection: WorkflowCrashInjection = { point: "tool_completed", stepId: null };
  assert.throws(
    () => maybeInjectWorkflowCrash(injection, context),
    (err: unknown) => isInjectedWorkflowCrashError(err),
  );
});

test("InjectedWorkflowCrashError contains context details in retryable false [crash-simulation]", () => {
  const context = makeCrashContext("before_commit", "task-specific", "exec-specific", "wf-specific", "step-specific");
  const error = new InjectedWorkflowCrashError(context);
  assert.equal(error.point, "before_commit");
  assert.ok(error.message.includes("before_commit"));
});