/**
 * Unit tests for Breakpoint Manager
 *
 * @see src/ops-maturity/workflow-debugger/breakpoint-manager/index.ts
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  isBreakpointHit,
  type BreakpointDefinition,
} from "../../../../../src/ops-maturity/workflow-debugger/breakpoint-manager/index.js";

test.describe("BreakpointManager", () => {
  test.describe("isBreakpointHit", () => {
    test("returns true when breakpoint matches the stepId", () => {
      const breakpoints: readonly BreakpointDefinition[] = [
        { breakpointId: "bp-1", stepId: "deploy" },
        { breakpointId: "bp-2", stepId: "verify" },
      ];

      const result = isBreakpointHit(breakpoints, "deploy");

      assert.equal(result, true);
    });

    test("returns false when no breakpoint matches the stepId", () => {
      const breakpoints: readonly BreakpointDefinition[] = [
        { breakpointId: "bp-1", stepId: "deploy" },
        { breakpointId: "bp-2", stepId: "verify" },
      ];

      const result = isBreakpointHit(breakpoints, "rollback");

      assert.equal(result, false);
    });

    test("returns false for empty breakpoints array", () => {
      const breakpoints: readonly BreakpointDefinition[] = [];

      const result = isBreakpointHit(breakpoints, "deploy");

      assert.equal(result, false);
    });

    test("returns true when multiple breakpoints exist and one matches", () => {
      const breakpoints: readonly BreakpointDefinition[] = [
        { breakpointId: "bp-1", stepId: "init" },
        { breakpointId: "bp-2", stepId: "deploy" },
        { breakpointId: "bp-3", stepId: "verify" },
      ];

      const result = isBreakpointHit(breakpoints, "deploy");

      assert.equal(result, true);
    });

    test("handles stepId with special characters", () => {
      const breakpoints: readonly BreakpointDefinition[] = [
        { breakpointId: "bp-1", stepId: "step:with:colons" },
      ];

      const result = isBreakpointHit(breakpoints, "step:with:colons");

      assert.equal(result, true);
    });
  });
});
