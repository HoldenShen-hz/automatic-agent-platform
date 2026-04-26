/**
 * Unit tests for StepInspector
 *
 * @see src/ops-maturity/workflow-debugger/step-inspector.ts
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  StepInspector,
  type StepState,
  type StepVariable,
  type StepStackFrame,
} from "../../../../src/ops-maturity/workflow-debugger/step-inspector.js";

test.describe("StepInspector", () => {
  test.describe("beginStep", () => {
    test("creates step with running status", () => {
      const inspector = new StepInspector();
      inspector.beginStep("step-1", { input: "test" });

      const state = inspector.getStepState("step-1");
      assert.ok(state !== null);
      assert.equal(state.stepId, "step-1");
      assert.equal(state.status, "running");
      assert.deepEqual(state.input, { input: "test" });
      assert.ok(state.startedAt !== null);
      assert.equal(state.completedAt, null);
    });

    test("overwrites existing step state when called again", () => {
      const inspector = new StepInspector();
      inspector.beginStep("step-1", { input: "first" });
      inspector.beginStep("step-1", { input: "second" });

      const state = inspector.getStepState("step-1");
      assert.ok(state !== null);
      assert.deepEqual(state.input, { input: "second" });
    });
  });

  test.describe("captureVariable", () => {
    test("captures variable for running step", () => {
      const inspector = new StepInspector();
      inspector.beginStep("step-1", {});
      inspector.captureVariable("step-1", "count", 42, "step");

      const variables = inspector.getStepVariables("step-1");
      assert.equal(variables.length, 1);
      assert.equal(variables[0]?.name, "count");
      assert.equal(variables[0]?.value, 42);
      assert.equal(variables[0]?.scope, "step");
    });

    test("captures multiple variables for same step", () => {
      const inspector = new StepInspector();
      inspector.beginStep("step-1", {});
      inspector.captureVariable("step-1", "x", 1, "step");
      inspector.captureVariable("step-1", "y", 2, "step");

      const variables = inspector.getStepVariables("step-1");
      assert.equal(variables.length, 2);
    });

    test("does not capture variable for non-existent step", () => {
      const inspector = new StepInspector();
      inspector.captureVariable("nonexistent", "x", 1, "step");

      const variables = inspector.getStepVariables("nonexistent");
      assert.deepEqual(variables, []);
    });

    test("does not capture variable for completed step", () => {
      const inspector = new StepInspector();
      inspector.beginStep("step-1", {});
      inspector.completeStep("step-1", {});
      inspector.captureVariable("step-1", "x", 1, "step");

      const variables = inspector.getStepVariables("step-1");
      assert.equal(variables.length, 0);
    });

    test("respects maxVariablesPerStep limit", () => {
      const inspector = new StepInspector({ maxVariablesPerStep: 2 });
      inspector.beginStep("step-1", {});
      inspector.captureVariable("step-1", "a", 1, "step");
      inspector.captureVariable("step-1", "b", 2, "step");
      inspector.captureVariable("step-1", "c", 3, "step");

      const variables = inspector.getStepVariables("step-1");
      assert.equal(variables.length, 2);
    });

    test("captures variables with different scopes", () => {
      const inspector = new StepInspector();
      inspector.beginStep("step-1", {});
      inspector.captureVariable("step-1", "globalVar", 1, "global");
      inspector.captureVariable("step-1", "loopVar", 2, "loop");
      inspector.captureVariable("step-1", "stepVar", 3, "step");

      const variables = inspector.getStepVariables("step-1");
      assert.equal(variables.length, 3);
      assert.ok(variables.some((v) => v.scope === "global"));
      assert.ok(variables.some((v) => v.scope === "loop"));
      assert.ok(variables.some((v) => v.scope === "step"));
    });
  });

  test.describe("captureStackFrame", () => {
    test("captures stack frame when captureLocals is enabled", () => {
      const inspector = new StepInspector({ captureLocals: true });
      inspector.beginStep("step-1", {});
      inspector.captureStackFrame("step-1", {
        functionName: "main",
        fileName: "index.ts",
        lineNumber: 42,
        locals: { x: 1 },
      });

      const frames = inspector.getStepStackFrames("step-1");
      assert.equal(frames.length, 1);
      assert.equal(frames[0]?.functionName, "main");
      assert.equal(frames[0]?.fileName, "index.ts");
      assert.equal(frames[0]?.lineNumber, 42);
    });

    test("does not capture stack frame when captureLocals is disabled", () => {
      const inspector = new StepInspector({ captureLocals: false });
      inspector.beginStep("step-1", {});
      inspector.captureStackFrame("step-1", {
        functionName: "main",
        fileName: null,
        lineNumber: null,
        locals: {},
      });

      const frames = inspector.getStepStackFrames("step-1");
      assert.equal(frames.length, 0);
    });

    test("respects maxStackFrames limit", () => {
      const inspector = new StepInspector({ maxStackFrames: 2, captureLocals: true });
      inspector.beginStep("step-1", {});
      inspector.captureStackFrame("step-1", { functionName: "f1", fileName: null, lineNumber: null, locals: {} });
      inspector.captureStackFrame("step-1", { functionName: "f2", fileName: null, lineNumber: null, locals: {} });
      inspector.captureStackFrame("step-1", { functionName: "f3", fileName: null, lineNumber: null, locals: {} });

      const frames = inspector.getStepStackFrames("step-1");
      assert.equal(frames.length, 2);
    });

    test("does not capture for non-existent step", () => {
      const inspector = new StepInspector({ captureLocals: true });
      inspector.captureStackFrame("nonexistent", {
        functionName: "main",
        fileName: null,
        lineNumber: null,
        locals: {},
      });

      const frames = inspector.getStepStackFrames("nonexistent");
      assert.deepEqual(frames, []);
    });
  });

  test.describe("completeStep", () => {
    test("sets step status to done with output", () => {
      const inspector = new StepInspector();
      inspector.beginStep("step-1", {});
      inspector.completeStep("step-1", { result: "success" });

      const state = inspector.getStepState("step-1");
      assert.ok(state !== null);
      assert.equal(state.status, "done");
      assert.deepEqual(state.output, { result: "success" });
      assert.ok(state.completedAt !== null);
    });

    test("does nothing for non-existent step", () => {
      const inspector = new StepInspector();
      inspector.completeStep("nonexistent", {});

      const state = inspector.getStepState("nonexistent");
      assert.equal(state, null);
    });
  });

  test.describe("failStep", () => {
    test("sets step status to failed with error message", () => {
      const inspector = new StepInspector();
      inspector.beginStep("step-1", {});
      inspector.failStep("step-1", "Something went wrong");

      const state = inspector.getStepState("step-1");
      assert.ok(state !== null);
      assert.equal(state.status, "failed");
      assert.equal(state.output, "Something went wrong");
    });
  });

  test.describe("skipStep", () => {
    test("sets step status to skipped", () => {
      const inspector = new StepInspector();
      inspector.beginStep("step-1", {});
      inspector.skipStep("step-1");

      const state = inspector.getStepState("step-1");
      assert.ok(state !== null);
      assert.equal(state.status, "skipped");
    });
  });

  test.describe("inspectStep", () => {
    test("returns full inspection result for existing step", () => {
      const inspector = new StepInspector();
      inspector.beginStep("step-1", { input: "test" });
      inspector.captureVariable("step-1", "x", 42, "step");

      const result = inspector.inspectStep("step-1");
      assert.ok(result !== null);
      assert.equal(result.stepId, "step-1");
      assert.equal(result.state.status, "running");
      assert.equal(result.variables.length, 1);
      assert.equal(result.error, null);
    });

    test("returns null for non-existent step", () => {
      const inspector = new StepInspector();
      const result = inspector.inspectStep("nonexistent");
      assert.equal(result, null);
    });

    test("includes error message for failed step", () => {
      const inspector = new StepInspector();
      inspector.beginStep("step-1", {});
      inspector.failStep("step-1", "Error: connection timeout");

      const result = inspector.inspectStep("step-1");
      assert.ok(result !== null);
      assert.equal(result.error, "Error: connection timeout");
    });
  });

  test.describe("listSteps", () => {
    test("returns all step IDs", () => {
      const inspector = new StepInspector();
      inspector.beginStep("step-1", {});
      inspector.beginStep("step-2", {});
      inspector.beginStep("step-3", {});

      const steps = inspector.listSteps();
      assert.equal(steps.length, 3);
      assert.ok(steps.includes("step-1"));
      assert.ok(steps.includes("step-2"));
      assert.ok(steps.includes("step-3"));
    });

    test("returns empty array when no steps", () => {
      const inspector = new StepInspector();
      const steps = inspector.listSteps();
      assert.deepEqual(steps, []);
    });
  });

  test.describe("reset", () => {
    test("clears all step states", () => {
      const inspector = new StepInspector();
      inspector.beginStep("step-1", {});
      inspector.captureVariable("step-1", "x", 1, "step");

      inspector.reset();

      assert.equal(inspector.getStepState("step-1"), null);
      assert.deepEqual(inspector.listSteps(), []);
    });
  });
});
