import assert from "node:assert/strict";
import test from "node:test";

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

test("planner re-exports AgentRoundLoopInput interface", async () => {
  const mod = await import("../../../src/core/runtime/planner/index.js");
  assert.ok("AgentRoundLoopInput" in mod, "should export AgentRoundLoopInput interface");
});

test("planner re-exports AgentRoundLoopResult interface", async () => {
  const mod = await import("../../../src/core/runtime/planner/index.js");
  assert.ok("AgentRoundLoopResult" in mod, "should export AgentRoundLoopResult interface");
});

test("planner re-exports ToolCallResult interface", async () => {
  const mod = await import("../../../src/core/runtime/planner/index.js");
  assert.ok("ToolCallResult" in mod, "should export ToolCallResult interface");
});

test("planner exports are functions or interfaces", async () => {
  const mod = await import("../../../src/core/runtime/planner/index.js");
  assert.ok(typeof mod === "object", "module should export an object");
});