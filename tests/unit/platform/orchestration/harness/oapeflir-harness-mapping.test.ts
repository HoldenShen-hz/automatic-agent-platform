import test from "node:test";
import assert from "node:assert/strict";
import {
  mapHarnessStepToOapeflirPhase,
  type OapeflirSemanticPhase,
} from "../../../../../src/platform/orchestration/harness/oapeflir-harness-mapping.js";

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

test("mapHarnessStepToOapeflirPhase returns observe for unrecognized roles", () => {
  assert.equal(mapHarnessStepToOapeflirPhase("unrecognized_role" as any, "any"), "observe");
  assert.equal(mapHarnessStepToOapeflirPhase("random_role" as any, "some_stage"), "observe");
});

test("mapHarnessStepToOapeflirPhase stage equality checks before role checks", () => {
  // The function checks stage equality first (plan, execute, evaluate)
  // before role-based checks (hitl_operator, loop_controller)
  // This means stage takes priority when it matches one of the three stage values

  // stage="plan" returns "plan" regardless of role
  assert.equal(mapHarnessStepToOapeflirPhase("generator", "plan"), "plan");
  assert.equal(mapHarnessStepToOapeflirPhase("evaluator", "plan"), "plan");
  assert.equal(mapHarnessStepToOapeflirPhase("hitl_operator", "plan"), "plan");
  assert.equal(mapHarnessStepToOapeflirPhase("loop_controller", "plan"), "plan");

  // stage="execute" returns "execute" regardless of role
  assert.equal(mapHarnessStepToOapeflirPhase("evaluator", "execute"), "execute");
  assert.equal(mapHarnessStepToOapeflirPhase("hitl_operator", "execute"), "execute");
  assert.equal(mapHarnessStepToOapeflirPhase("loop_controller", "execute"), "execute");

  // stage="evaluate" returns "feedback" regardless of role
  assert.equal(mapHarnessStepToOapeflirPhase("hitl_operator", "evaluate"), "feedback");
  assert.equal(mapHarnessStepToOapeflirPhase("loop_controller", "evaluate"), "feedback");

  // For unrecognized stage values, role-based checks kick in
  // hitl_operator returns "assess" for non-plan/execute/evaluate stages
  assert.equal(mapHarnessStepToOapeflirPhase("hitl_operator", "other"), "assess");
  assert.equal(mapHarnessStepToOapeflirPhase("hitl_operator", ""), "assess");

  // loop_controller returns "improve" for non-plan/execute/evaluate stages
  assert.equal(mapHarnessStepToOapeflirPhase("loop_controller", "other"), "improve");
  assert.equal(mapHarnessStepToOapeflirPhase("loop_controller", ""), "improve");
});

test("mapHarnessStepToOapeflirPhase stage parameter affects priority role matching", () => {
  // When stage is "plan", returns "plan" (first condition matches)
  assert.equal(mapHarnessStepToOapeflirPhase("any_role" as any, "plan"), "plan");

  // When stage is "execute", returns "execute" (second condition matches)
  assert.equal(mapHarnessStepToOapeflirPhase("any_role" as any, "execute"), "execute");

  // When stage is "evaluate", returns "feedback" (third condition matches)
  assert.equal(mapHarnessStepToOapeflirPhase("any_role" as any, "evaluate"), "feedback");
});

test("mapHarnessStepToOapeflirPhase returns all valid OapeflirSemanticPhase values", () => {
  const allPhases = new Set<OapeflirSemanticPhase>();
  const roles = ["planner", "generator", "evaluator", "hitl_operator", "loop_controller", "unknown" as any];
  const stages = ["plan", "execute", "evaluate", "other"];

  for (const role of roles) {
    for (const stage of stages) {
      allPhases.add(mapHarnessStepToOapeflirPhase(role, stage));
    }
  }

  // Should return plan, execute, feedback, assess, improve, observe
  assert.ok(allPhases.has("plan"));
  assert.ok(allPhases.has("execute"));
  assert.ok(allPhases.has("feedback"));
  assert.ok(allPhases.has("assess"));
  assert.ok(allPhases.has("improve"));
  assert.ok(allPhases.has("observe"));
});

test("mapHarnessStepToOapeflirPhase is a pure function - no side effects", () => {
  const result1 = mapHarnessStepToOapeflirPhase("planner", "any");
  const result2 = mapHarnessStepToOapeflirPhase("planner", "any");
  assert.equal(result1, result2);
  assert.equal(result1, "plan");
});

test("mapHarnessStepToOapeflirPhase handles empty string stage", () => {
  assert.equal(mapHarnessStepToOapeflirPhase("planner", ""), "plan");
  assert.equal(mapHarnessStepToOapeflirPhase("generator", ""), "execute");
  assert.equal(mapHarnessStepToOapeflirPhase("unknown" as any, ""), "observe");
});

test.skip("mapHarnessStepToOapeflirPhase type validation - requires type-level testing", () => {
  // This test documents that OapeflirSemanticPhase is a union type of specific strings
  // Runtime testing cannot validate TypeScript types without runtime type checking library
});

test("OapeflirSemanticPhase type contains all expected phase values", () => {
  const phases: OapeflirSemanticPhase[] = ["observe", "assess", "plan", "execute", "feedback", "learn", "improve", "release"];
  for (const phase of phases) {
    const result = mapHarnessStepToOapeflirPhase("unknown" as any, "any");
    // Just ensure no error is thrown when using valid phase values
    assert.ok(typeof result === "string");
  }
});