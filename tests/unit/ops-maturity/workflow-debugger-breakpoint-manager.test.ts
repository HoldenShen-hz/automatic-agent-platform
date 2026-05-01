import assert from "node:assert/strict";
import test from "node:test";
import {
  isBreakpointHit,
  type BreakpointDefinition,
} from "../../../src/ops-maturity/workflow-debugger/breakpoint-manager/index.js";

test("isBreakpointHit returns true when nodeRunId matches", () => {
  const breakpoints: BreakpointDefinition[] = [
    { breakpointId: "bp_1", nodeRunId: "node_1" },
    { breakpointId: "bp_2", nodeRunId: "node_2" },
  ];

  assert.strictEqual(isBreakpointHit(breakpoints, "node_1"), true);
  assert.strictEqual(isBreakpointHit(breakpoints, "node_2"), true);
});

test("isBreakpointHit returns false when no match", () => {
  const breakpoints: BreakpointDefinition[] = [
    { breakpointId: "bp_1", nodeRunId: "node_1" },
  ];

  assert.strictEqual(isBreakpointHit(breakpoints, "node_99"), false);
});

test("isBreakpointHit returns false for empty breakpoints", () => {
  assert.strictEqual(isBreakpointHit([], "node_1"), false);
});

test("isBreakpointHit uses stepId as fallback (deprecated)", () => {
  const breakpoints: BreakpointDefinition[] = [
    { breakpointId: "bp_1", stepId: "step_legacy" },
  ];

  assert.strictEqual(isBreakpointHit(breakpoints, "step_legacy"), true);
});

test("isBreakpointHit prefers nodeRunId over stepId", () => {
  const breakpoints: BreakpointDefinition[] = [
    { breakpointId: "bp_1", nodeRunId: "node_new", stepId: "step_old" },
  ];

  assert.strictEqual(isBreakpointHit(breakpoints, "node_new"), true);
  assert.strictEqual(isBreakpointHit(breakpoints, "step_old"), false);
});