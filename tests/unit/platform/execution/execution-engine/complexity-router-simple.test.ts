import assert from "node:assert/strict";
import test from "node:test";
import { routeComplexity, type ComplexityPath } from "../../../../../src/platform/five-plane-execution/execution-engine/complexity-router.js";

test("complexity-router exports routeComplexity function", () => {
  assert.equal(typeof routeComplexity, "function");
});

test("routeComplexity returns expected structure", () => {
  const result = routeComplexity("simple task");

  assert.ok(result, "Should return a result");
  assert.equal(typeof result.path, "string", "path should be a string");
  assert.equal(typeof result.reason, "string", "reason should be a string");
  assert.equal(typeof result.estimatedBudgetFactor, "number", "estimatedBudgetFactor should be a number");
  assert.equal(typeof result.routedAt, "string", "routedAt should be a string");
});

test("routeComplexity returns valid ComplexityPath", () => {
  const validPaths: ComplexityPath[] = ["passthrough", "fast", "standard", "full"];
  const result = routeComplexity("simple task");

  assert.ok(validPaths.includes(result.path), `path should be one of ${validPaths.join(", ")}`);
});

test("routeComplexity: short input returns passthrough", () => {
  const result = routeComplexity("hi");

  assert.equal(result.path, "passthrough");
  assert.equal(result.reason, "short_input");
  assert.ok(result.estimatedBudgetFactor < 1, "passthrough should have budget factor < 1");
});

test("routeComplexity: full path keywords route to full", () => {
  const result = routeComplexity("Please refactor the entire codebase with new architecture");

  assert.equal(result.path, "full");
  assert.ok(result.reason.startsWith("keyword_match:"), "reason should indicate keyword match");
});

test("routeComplexity: fast path keywords route to fast", () => {
  const result = routeComplexity("Show me the files in this directory please and list them");

  assert.equal(result.path, "fast");
  assert.ok(result.reason.startsWith("keyword_match:"), "reason should indicate keyword match");
});

test("routeComplexity: default route is standard", () => {
  const result = routeComplexity("Process this task and provide output results please");

  assert.equal(result.path, "standard");
  assert.equal(result.reason, "default");
});

test("routeComplexity: qaMode forces full path", () => {
  const result = routeComplexity("simple task", { qaMode: true });

  assert.equal(result.path, "full");
  assert.equal(result.reason, "qa_mode_active");
});

test("routeComplexity: high token estimate routes to full", () => {
  const result = routeComplexity("Analyze this large document with detailed report generation", { estimatedTokens: 60000 });

  assert.equal(result.path, "full");
  assert.equal(result.reason, "high_token_estimate");
});

test("routeComplexity: multi-step workflow routes to standard or full", () => {
  const result = routeComplexity("complex task", { stepCount: 5 });

  assert.ok(result.path === "standard" || result.path === "full", "should be standard or full");
});

test("routeComplexity: custom config fullPathKeywords works", () => {
  const result = routeComplexity("This is a special task that should route to full", {
    config: {
      fullPathKeywords: ["special"],
      fastPathKeywords: [],
      passthroughMaxChars: 10,
      qaModeForceFull: false,
    },
  });

  assert.equal(result.path, "full");
  assert.ok(result.reason.startsWith("keyword_match:"));
});
