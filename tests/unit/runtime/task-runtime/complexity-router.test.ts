import test from "node:test";
import assert from "node:assert/strict";
import { routeComplexity } from "../../../../src/platform/execution/execution-engine/complexity-router.js";

test("routeComplexity returns passthrough for short input", () => {
  const result = routeComplexity("Hi");
  assert.equal(result.path, "passthrough");
  assert.equal(result.reason, "short_input");
  assert.ok(result.estimatedBudgetFactor < 1);
});

test("routeComplexity returns fast for lookup keywords", () => {
  const result = routeComplexity("What is the capital of France?");
  assert.equal(result.path, "fast");
  assert.ok(result.reason.includes("keyword_match"));
});

test("routeComplexity returns standard for normal tasks", () => {
  const result = routeComplexity("Write a function to calculate fibonacci");
  assert.equal(result.path, "standard");
  assert.equal(result.reason, "default");
});

test("routeComplexity returns full for refactor keywords", () => {
  const result = routeComplexity("Refactor the entire authentication module");
  assert.equal(result.path, "full");
  assert.ok(result.reason.includes("keyword_match:refactor"));
});

test("routeComplexity returns full for architecture keywords", () => {
  const result = routeComplexity("Analyze the system architecture");
  assert.equal(result.path, "full");
  assert.ok(result.reason.includes("architecture"));
});

test("routeComplexity returns full in QA mode regardless of task", () => {
  const result = routeComplexity("Simple question", { qaMode: true });
  assert.equal(result.path, "full");
  assert.equal(result.reason, "qa_mode_active");
});

test("routeComplexity returns standard for multi-step workflows", () => {
  const result = routeComplexity("Do several things", { stepCount: 5 });
  assert.equal(result.path, "standard");
  assert.equal(result.reason, "multi_step_workflow");
});

test("routeComplexity returns full for high token estimates", () => {
  const result = routeComplexity("Analyze this", { estimatedTokens: 60000 });
  assert.equal(result.path, "full");
  assert.equal(result.reason, "high_token_estimate");
});

test("routeComplexity uses custom config for full-path keywords", () => {
  const result = routeComplexity("Analyze this special task", {
    config: {
      fullPathKeywords: ["special"],
      fastPathKeywords: [],
      passthroughMaxChars: 10,
      qaModeForceFull: false,
    },
  });
  assert.equal(result.path, "full");
  assert.ok(result.reason.includes("special"));
});

test("routeComplexity uses custom config for fast-path keywords", () => {
  const result = routeComplexity("Show my dashboard", {
    config: {
      fullPathKeywords: [],
      fastPathKeywords: ["show"],
      passthroughMaxChars: 10,
      qaModeForceFull: false,
    },
  });
  assert.equal(result.path, "fast");
  assert.ok(result.reason.includes("show"));
});

test("routeComplexity returns result with correct structure", () => {
  const result = routeComplexity("Test task");
  assert.ok(typeof result.path === "string");
  assert.ok(typeof result.reason === "string");
  assert.ok(typeof result.estimatedBudgetFactor === "number");
  assert.ok(typeof result.routedAt === "string");
});