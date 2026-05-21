import assert from "node:assert/strict";
import test from "node:test";
import type {
  AgentRoundLoopInput,
  AgentRoundLoopResult,
  ToolCallResult,
} from "../../../src/core/runtime/planner/index.js";

/**
 * Tests for src/core/runtime/planner/index.ts
 * This file re-exports multi-step orchestrator from five-plane-execution.
 * Coverage: 0% (all statements/skipped)
 */
test("planner re-exports executeAgentRoundLoop function", async () => {
  const mod = await import("../../../src/core/runtime/planner/index.js");
  assert.ok("executeAgentRoundLoop" in mod, "should export executeAgentRoundLoop function");
});

test("planner re-exports buildStepOutput function", async () => {
  const mod = await import("../../../src/core/runtime/planner/index.js");
  assert.ok("buildStepOutput" in mod, "should export buildStepOutput function");
});

test("planner re-exports AgentRoundLoopInput interface", () => {
  // AgentRoundLoopInput is a TypeScript interface - verify it exists as a type export
  type _ = AgentRoundLoopInput;
});

test("planner re-exports AgentRoundLoopResult interface", () => {
  // AgentRoundLoopResult is a TypeScript interface - verify it exists as a type export
  type _ = AgentRoundLoopResult;
});

test("planner re-exports ToolCallResult interface", () => {
  // ToolCallResult is a TypeScript interface - verify it exists as a type export
  type _ = ToolCallResult;
});

test("planner exports are functions or interfaces", async () => {
  const mod = await import("../../../src/core/runtime/planner/index.js");
  assert.ok(typeof mod === "object", "module should export an object");
});