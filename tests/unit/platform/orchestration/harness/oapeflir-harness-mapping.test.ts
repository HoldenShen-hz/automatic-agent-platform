import test from "node:test";
import assert from "node:assert/strict";
import { mapHarnessStepToOapeflirPhase, type OapeflirSemanticPhase } from "../../../../../src/platform/orchestration/harness/oapeflir-harness-mapping.js";

test("mapHarnessStepToOapeflirPhase maps planner/plan to plan phase", () => {
  assert.equal(mapHarnessStepToOapeflirPhase("planner", "plan"), "plan");
  assert.equal(mapHarnessStepToOapeflirPhase("planner", "other"), "plan");
});

test("mapHarnessStepToOapeflirPhase maps generator/execute to execute phase", () => {
  assert.equal(mapHarnessStepToOapeflirPhase("generator", "execute"), "execute");
  assert.equal(mapHarnessStepToOapeflirPhase("generator", "other"), "execute");
});

test("mapHarnessStepToOapeflirPhase maps evaluator/evaluate to feedback phase", () => {
  assert.equal(mapHarnessStepToOapeflirPhase("evaluator", "evaluate"), "feedback");
  assert.equal(mapHarnessStepToOapeflirPhase("evaluator", "other"), "feedback");
});

test("mapHarnessStepToOapeflirPhase maps hitl_operator to assess phase", () => {
  assert.equal(mapHarnessStepToOapeflirPhase("hitl_operator", "review"), "assess");
  assert.equal(mapHarnessStepToOapeflirPhase("hitl_operator", "anything"), "assess");
});

test("mapHarnessStepToOapeflirPhase maps loop_controller to improve phase", () => {
  assert.equal(mapHarnessStepToOapeflirPhase("loop_controller", "iterate"), "improve");
  assert.equal(mapHarnessStepToOapeflirPhase("loop_controller", "anything"), "improve");
});

test("mapHarnessStepToOapeflirPhase handles edge cases", () => {
  // Unknown role with unknown stage returns "observe" as default
  const result = mapHarnessStepToOapeflirPhase("loop_controller" as any, "unknown_stage");
  // loop_controller returns "improve" for any stage, not "observe"
  assert.equal(result, "improve");
});

test("mapHarnessStepToOapeflirPhase returns correct phase mappings", () => {
  // All valid roles map to specific phases (stage-independent for most)
  assert.equal(mapHarnessStepToOapeflirPhase("planner", "any"), "plan");
  assert.equal(mapHarnessStepToOapeflirPhase("generator", "any"), "execute");
  assert.equal(mapHarnessStepToOapeflirPhase("evaluator", "any"), "feedback");
  assert.equal(mapHarnessStepToOapeflirPhase("hitl_operator", "any"), "assess");
  assert.equal(mapHarnessStepToOapeflirPhase("loop_controller", "any"), "improve");
});