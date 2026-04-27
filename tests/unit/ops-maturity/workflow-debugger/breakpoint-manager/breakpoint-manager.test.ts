import assert from "node:assert/strict";
import test from "node:test";

import {
  isBreakpointHit,
  type BreakpointDefinition,
} from "../../../../../src/ops-maturity/workflow-debugger/breakpoint-manager/index.js";

test("isBreakpointHit returns true when breakpoint matches stepId", () => {
  const breakpoints: BreakpointDefinition[] = [
    { breakpointId: "bp1", stepId: "step-1" },
    { breakpointId: "bp2", stepId: "step-2" },
  ];

  assert.equal(isBreakpointHit(breakpoints, "step-1"), true);
  assert.equal(isBreakpointHit(breakpoints, "step-2"), true);
});

test("isBreakpointHit returns false when no matching stepId", () => {
  const breakpoints: BreakpointDefinition[] = [
    { breakpointId: "bp1", stepId: "step-1" },
    { breakpointId: "bp2", stepId: "step-2" },
  ];

  assert.equal(isBreakpointHit(breakpoints, "step-3"), false);
});

test("isBreakpointHit returns false for empty breakpoints array", () => {
  assert.equal(isBreakpointHit([], "step-1"), false);
});

test("isBreakpointHit handles single breakpoint", () => {
  const breakpoints: BreakpointDefinition[] = [
    { breakpointId: "bp1", stepId: "step-1" },
  ];

  assert.equal(isBreakpointHit(breakpoints, "step-1"), true);
  assert.equal(isBreakpointHit(breakpoints, "step-2"), false);
});

test("isBreakpointHit uses some() - first match returns true", () => {
  const breakpoints: BreakpointDefinition[] = [
    { breakpointId: "bp1", stepId: "step-1" },
    { breakpointId: "bp2", stepId: "step-2" },
    { breakpointId: "bp3", stepId: "step-3" },
  ];

  assert.equal(isBreakpointHit(breakpoints, "step-1"), true);
});

test("isBreakpointHit searches all breakpoints", () => {
  const breakpoints: BreakpointDefinition[] = [
    { breakpointId: "bp1", stepId: "step-1" },
    { breakpointId: "bp2", stepId: "step-2" },
    { breakpointId: "bp3", stepId: "step-3" },
  ];

  assert.equal(isBreakpointHit(breakpoints, "step-3"), true);
});

test("BreakpointDefinition readonly properties work correctly", () => {
  const bp: BreakpointDefinition = {
    breakpointId: "bp1",
    stepId: "step-1",
  };

  assert.equal(bp.breakpointId, "bp1");
  assert.equal(bp.stepId, "step-1");
});