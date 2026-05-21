import assert from "node:assert/strict";
import test from "node:test";

import * as oapeflir from "../../../../src/platform/five-plane-execution/oapeflir/index.js";

test("oapeflir module exports RuntimePlanExecutionInput type", () => {
  assert.ok("RuntimePlanExecutionInput" in oapeflir, "should export RuntimePlanExecutionInput type");
});

test("oapeflir module exports RuntimePlanExecutor type", () => {
  assert.ok("RuntimePlanExecutor" in oapeflir, "should export RuntimePlanExecutor type");
});

test("oapeflir module exports executeOapeflirRuntimePlan function", () => {
  assert.ok("executeOapeflirRuntimePlan" in oapeflir, "should export executeOapeflirRuntimePlan function");
  assert.equal(typeof oapeflir.executeOapeflirRuntimePlan, "function");
});

test("oapeflir module re-exports from runtime-plan-executor", () => {
  const mod = oapeflir;
  assert.ok(mod.RuntimePlanExecutionInput, "should have RuntimePlanExecutionInput");
  assert.ok(mod.RuntimePlanExecutor, "should have RuntimePlanExecutor");
  assert.ok(mod.executeOapeflirRuntimePlan, "should have executeOapeflirRuntimePlan");
});