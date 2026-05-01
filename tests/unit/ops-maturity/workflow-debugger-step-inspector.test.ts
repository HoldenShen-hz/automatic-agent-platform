import assert from "node:assert/strict";
import test from "node:test";
import {
  StepInspector,
  type StepInspectorOptions,
} from "../../../src/ops-maturity/workflow-debugger/step-inspector.js";

test("StepInspector begins and completes step lifecycle", () => {
  const inspector = new StepInspector();

  inspector.beginStep("step_1", { input: "test" });
  const state = inspector.getStepState("step_1");

  assert.strictEqual(state?.stepId, "step_1");
  assert.strictEqual(state?.status, "running");
  assert.deepStrictEqual(state?.input, { input: "test" });
  assert.strictEqual(state?.output, null);
});

test("StepInspector captures variables during step", () => {
  const inspector = new StepInspector();

  inspector.beginStep("step_1", {});
  inspector.captureVariable("step_1", "var_x", 42, "step");
  inspector.captureVariable("step_1", "var_y", "hello", "step");

  const variables = inspector.getStepVariables("step_1");

  assert.strictEqual(variables.length, 2);
  assert.strictEqual(variables[0]?.name, "var_x");
  assert.strictEqual(variables[0]?.value, 42);
});

test("StepInspector completes step with output", () => {
  const inspector = new StepInspector();

  inspector.beginStep("step_1", {});
  inspector.completeStep("step_1", "result_value");

  const state = inspector.getStepState("step_1");
  assert.strictEqual(state?.status, "done");
  assert.strictEqual(state?.output, "result_value");
});

test("StepInspector fails step with error", () => {
  const inspector = new StepInspector();

  inspector.beginStep("step_1", {});
  inspector.failStep("step_1", "something went wrong");

  const state = inspector.getStepState("step_1");
  assert.strictEqual(state?.status, "failed");
  assert.strictEqual(state?.output, "something went wrong");
});

test("StepInspector skips step", () => {
  const inspector = new StepInspector();

  inspector.beginStep("step_1", {});
  inspector.skipStep("step_1");

  const state = inspector.getStepState("step_1");
  assert.strictEqual(state?.status, "skipped");
});

test("StepInspector inspectStep returns full inspection result", () => {
  const inspector = new StepInspector();

  inspector.beginStep("step_1", { key: "value" });
  inspector.captureVariable("step_1", "x", 10, "step");
  inspector.completeStep("step_1", { result: "ok" });

  const result = inspector.inspectStep("step_1");

  assert.strictEqual(result?.stepId, "step_1");
  assert.strictEqual(result?.state.status, "done");
  assert.strictEqual(result?.variables.length, 1);
  assert.strictEqual(result?.error, null);
});

test("StepInspector inspectStep returns null for unknown step", () => {
  const inspector = new StepInspector();
  const result = inspector.inspectStep("unknown_step");
  assert.strictEqual(result, null);
});

test("StepInspector respects maxVariablesPerStep", () => {
  const options: StepInspectorOptions = { maxVariablesPerStep: 2 };
  const inspector = new StepInspector(options);

  inspector.beginStep("step_1", {});
  inspector.captureVariable("step_1", "var_1", 1, "step");
  inspector.captureVariable("step_1", "var_2", 2, "step");
  inspector.captureVariable("step_1", "var_3", 3, "step"); // Should be ignored

  const variables = inspector.getStepVariables("step_1");
  assert.strictEqual(variables.length, 2);
});

test("StepInspector captures stack frames", () => {
  const inspector = new StepInspector({ captureLocals: true });

  inspector.beginStep("step_1", {});
  inspector.captureStackFrame("step_1", {
    functionName: "testFn",
    fileName: "test.ts",
    lineNumber: 10,
    locals: { x: 1 },
  });

  const frames = inspector.getStepStackFrames("step_1");
  assert.strictEqual(frames.length, 1);
  assert.strictEqual(frames[0]?.functionName, "testFn");
});

test("StepInspector reset clears all state", () => {
  const inspector = new StepInspector();

  inspector.beginStep("step_1", {});
  inspector.captureVariable("step_1", "x", 1, "step");

  inspector.reset();

  assert.deepStrictEqual(inspector.listSteps(), []);
  assert.strictEqual(inspector.getStepState("step_1"), null);
});

test("StepInspector listSteps returns all step ids", () => {
  const inspector = new StepInspector();

  inspector.beginStep("step_1", {});
  inspector.beginStep("step_2", {});
  inspector.beginStep("step_3", {});

  const steps = inspector.listSteps();
  assert.strictEqual(steps.length, 3);
  assert.ok(steps.includes("step_1"));
  assert.ok(steps.includes("step_2"));
  assert.ok(steps.includes("step_3"));
});