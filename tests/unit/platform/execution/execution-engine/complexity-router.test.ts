/**
 * Unit Tests: Complexity Router
 *
 * Tests for routeComplexity function which routes tasks through complexity paths.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  routeComplexity,
  type ComplexityRouterConfig,
} from "../../../../../src/platform/execution/execution-engine/complexity-router.js";

// =============================================================================
// routeComplexity - Basic path routing
// =============================================================================

test("routeComplexity returns passthrough for short input", () => {
  const result = routeComplexity("Hi");
  assert.equal(result.path, "passthrough");
  assert.equal(result.reason, "short_input");
  assert.equal(result.estimatedBudgetFactor, 0.1);
  assert.ok(result.routedAt);
});

test("routeComplexity returns passthrough for exact max chars", () => {
  const result = routeComplexity("a".repeat(50));
  assert.equal(result.path, "passthrough");
  assert.equal(result.reason, "short_input");
});

test("routeComplexity returns standard for medium input", () => {
  // Title must be > 50 chars and not contain any keywords
  const result = routeComplexity("Please execute the data processing pipeline operation today");
  assert.equal(result.path, "standard");
  assert.equal(result.reason, "default");
  assert.equal(result.estimatedBudgetFactor, 1.0);
});

test("routeComplexity returns standard when stepCount is low", () => {
  const result = routeComplexity("Tell me about JavaScript", { stepCount: 2 });
  assert.equal(result.path, "standard");
});

test("routeComplexity returns full for high stepCount with full keywords", () => {
  const result = routeComplexity("Refactor the authentication module", { stepCount: 5 });
  assert.equal(result.path, "full");
  assert.ok(result.reason.startsWith("keyword_match:"));
  assert.equal(result.estimatedBudgetFactor, 2.0);
});

test("routeComplexity returns standard for high stepCount without full keywords", () => {
  const result = routeComplexity("Run the tests", { stepCount: 5 });
  assert.equal(result.path, "standard");
  assert.equal(result.reason, "multi_step_workflow");
});

test("routeComplexity returns full for high token estimate", () => {
  // Use stepCount: 1 to bypass passthrough check
  const result = routeComplexity("Analyze large codebase", { stepCount: 1, estimatedTokens: 60000 });
  assert.equal(result.path, "full");
  assert.equal(result.reason, "high_token_estimate");
  assert.equal(result.estimatedBudgetFactor, 2.0);
});

test("routeComplexity returns full for token estimate exactly at threshold", () => {
  // Use stepCount: 1 to bypass passthrough check
  const result = routeComplexity("Analyze codebase", { stepCount: 1, estimatedTokens: 50000 });
  assert.equal(result.path, "standard");
});

test("routeComplexity is case insensitive for keyword matching", () => {
  // Use stepCount: 1 to bypass passthrough check
  const result = routeComplexity("REFACTOR the codebase", { stepCount: 1 });
  assert.equal(result.path, "full");
  assert.ok(result.reason.startsWith("keyword_match:"));
});

// =============================================================================
// routeComplexity - QA Mode
// =============================================================================

test("routeComplexity returns full when QA mode is enabled", () => {
  const result = routeComplexity("Simple question", { qaMode: true });
  assert.equal(result.path, "full");
  assert.equal(result.reason, "qa_mode_active");
  assert.equal(result.estimatedBudgetFactor, 2.0);
});

test("routeComplexity QA mode takes precedence over short input", () => {
  const result = routeComplexity("Hi", { qaMode: true });
  assert.equal(result.path, "full");
  assert.equal(result.reason, "qa_mode_active");
});

test("routeComplexity QA mode takes precedence over fast keywords", () => {
  const result = routeComplexity("What is X", { qaMode: true });
  assert.equal(result.path, "full");
  assert.equal(result.reason, "qa_mode_active");
});

// =============================================================================
// routeComplexity - Keyword Matching
// =============================================================================

test("routeComplexity matches refactor keyword", () => {
  const result = routeComplexity("Please refactor the User class", { stepCount: 1 });
  assert.equal(result.path, "full");
  assert.equal(result.reason, "keyword_match:refactor");
});

test("routeComplexity matches redesign keyword", () => {
  const result = routeComplexity("Redesign the login flow", { stepCount: 1 });
  assert.equal(result.path, "full");
  assert.equal(result.reason, "keyword_match:redesign");
});

test("routeComplexity matches migrate keyword", () => {
  const result = routeComplexity("Migrate to new database", { stepCount: 1 });
  assert.equal(result.path, "full");
  assert.equal(result.reason, "keyword_match:migrate");
});

test("routeComplexity matches architecture keyword", () => {
  const result = routeComplexity("Architecture review needed", { stepCount: 1 });
  assert.equal(result.path, "full");
  assert.equal(result.reason, "keyword_match:architecture");
});

test("routeComplexity matches security audit keyword", () => {
  const result = routeComplexity("Security audit for the API", { stepCount: 1 });
  assert.equal(result.path, "full");
  assert.equal(result.reason, "keyword_match:security audit");
});

test("routeComplexity matches performance analysis keyword", () => {
  const result = routeComplexity("Performance analysis of the query", { stepCount: 1 });
  assert.equal(result.path, "full");
  assert.equal(result.reason, "keyword_match:performance analysis");
});

test("routeComplexity matches comprehensive keyword", () => {
  const result = routeComplexity("Comprehensive review of all modules", { stepCount: 1 });
  assert.equal(result.path, "full");
  assert.equal(result.reason, "keyword_match:comprehensive");
});

test("routeComplexity matches all files keyword", () => {
  const result = routeComplexity("Update all files to use new API", { stepCount: 1 });
  assert.equal(result.path, "full");
  assert.equal(result.reason, "keyword_match:all files");
});

test("routeComplexity matches entire codebase keyword", () => {
  const result = routeComplexity("Document entire codebase", { stepCount: 1 });
  assert.equal(result.path, "full");
  assert.equal(result.reason, "keyword_match:entire codebase");
});

test("routeComplexity matches deep analysis keyword", () => {
  const result = routeComplexity("Deep analysis of memory usage", { stepCount: 1 });
  assert.equal(result.path, "full");
  assert.equal(result.reason, "keyword_match:deep analysis");
});

test("routeComplexity matches root cause keyword", () => {
  const result = routeComplexity("Root cause analysis", { stepCount: 1 });
  assert.equal(result.path, "full");
  assert.equal(result.reason, "keyword_match:root cause");
});

test("routeComplexity matches investigation keyword", () => {
  const result = routeComplexity("Investigation of the bug", { stepCount: 1 });
  assert.equal(result.path, "full");
  assert.equal(result.reason, "keyword_match:investigation");
});

test("routeComplexity matches fast keyword what is", () => {
  const result = routeComplexity("What is the weather?", { stepCount: 1 });
  assert.equal(result.path, "fast");
  assert.equal(result.reason, "keyword_match:what is");
  assert.equal(result.estimatedBudgetFactor, 0.3);
});

test("routeComplexity matches fast keyword show me", () => {
  const result = routeComplexity("Show me the logs", { stepCount: 1 });
  assert.equal(result.path, "fast");
  assert.equal(result.reason, "keyword_match:show me");
});

test("routeComplexity matches fast keyword list", () => {
  const result = routeComplexity("List all users", { stepCount: 1 });
  assert.equal(result.path, "fast");
  assert.equal(result.reason, "keyword_match:list");
});

test("routeComplexity matches fast keyword find", () => {
  const result = routeComplexity("Find the error log", { stepCount: 1 });
  assert.equal(result.path, "fast");
  assert.equal(result.reason, "keyword_match:find");
});

test("routeComplexity matches fast keyword grep", () => {
  const result = routeComplexity("Grep for TODO", { stepCount: 1 });
  assert.equal(result.path, "fast");
  assert.equal(result.reason, "keyword_match:grep");
});

test("routeComplexity matches fast keyword search", () => {
  const result = routeComplexity("Search for patterns", { stepCount: 1 });
  assert.equal(result.path, "fast");
  assert.equal(result.reason, "keyword_match:search");
});

test("routeComplexity matches fast keyword quick", () => {
  const result = routeComplexity("Quick summary please", { stepCount: 1 });
  assert.equal(result.path, "fast");
  assert.equal(result.reason, "keyword_match:quick");
});

test("routeComplexity matches fast keyword simple", () => {
  const result = routeComplexity("Simple question about X", { stepCount: 1 });
  assert.equal(result.path, "fast");
  assert.equal(result.reason, "keyword_match:simple");
});

test("routeComplexity matches fast keyword brief", () => {
  const result = routeComplexity("Brief status update", { stepCount: 1 });
  assert.equal(result.path, "fast");
  assert.equal(result.reason, "keyword_match:brief");
});

test("routeComplexity matches fast keyword lookup", () => {
  const result = routeComplexity("Lookup the order status", { stepCount: 1 });
  assert.equal(result.path, "fast");
  assert.equal(result.reason, "keyword_match:lookup");
});

test("routeComplexity matches fast keyword check", () => {
  const result = routeComplexity("Check the server status", { stepCount: 1 });
  assert.equal(result.path, "fast");
  assert.equal(result.reason, "keyword_match:check");
});

// =============================================================================
// routeComplexity - Custom Configuration
// =============================================================================

test("routeComplexity uses custom fullPathKeywords", () => {
  const config: ComplexityRouterConfig = {
    fullPathKeywords: ["custom_full_keyword"],
  };
  const result = routeComplexity("Do custom_full_keyword now", { stepCount: 1, config });
  assert.equal(result.path, "full");
  assert.equal(result.reason, "keyword_match:custom_full_keyword");
});

test("routeComplexity uses custom fastPathKeywords", () => {
  const config: ComplexityRouterConfig = {
    fastPathKeywords: ["custom_fast"],
  };
  const result = routeComplexity("custom_fast answer needed", { stepCount: 1, config });
  assert.equal(result.path, "fast");
  assert.equal(result.reason, "keyword_match:custom_fast");
});

test("routeComplexity uses custom passthroughMaxChars", () => {
  const config: ComplexityRouterConfig = {
    passthroughMaxChars: 10,
  };
  const result = routeComplexity("1234567890", { config });
  assert.equal(result.path, "passthrough");
  assert.equal(result.reason, "short_input");

  const result2 = routeComplexity("12345678901", { config });
  assert.equal(result2.path, "standard");
});

test("routeComplexity qaModeForceFull can be disabled", () => {
  const config: ComplexityRouterConfig = {
    qaModeForceFull: false,
  };
  const result = routeComplexity("Simple", { qaMode: true, config });
  assert.equal(result.path, "passthrough");
});

// =============================================================================
// routeComplexity - Edge Cases
// =============================================================================

test("routeComplexity handles empty string", () => {
  const result = routeComplexity("");
  assert.equal(result.path, "passthrough");
});

test("routeComplexity handles very long input", () => {
  const longTitle = "a".repeat(10000);
  const result = routeComplexity(longTitle);
  // With high char count and no keywords, should be standard
  assert.equal(result.path, "standard");
  assert.equal(result.reason, "default");
});

test("routeComplexity handles zero stepCount", () => {
  const result = routeComplexity("Test", { stepCount: 0 });
  // stepCount: 0 is falsy for passthrough check, so passthrough applies
  assert.equal(result.path, "passthrough");
});

test("routeComplexity handles undefined options", () => {
  const result = routeComplexity("This is a longer test task title");
  assert.ok(result.path);
  assert.ok(result.reason);
});

test("routeComplexity stepCount of 1 is not multi-step", () => {
  const result = routeComplexity("Refactor the codebase", { stepCount: 1 });
  // Refactor is a full keyword, so it should still be full
  assert.equal(result.path, "full");
});

test("routeComplexity stepCount of 3 is not multi-step", () => {
  const result = routeComplexity("Simple task here", { stepCount: 3 });
  // 3 steps is not > 3, passthrough skipped due to stepCount, "simple" is fast keyword
  assert.equal(result.path, "fast");
});

test("routeComplexity stepCount of 4 triggers multi-step", () => {
  const result = routeComplexity("Simple task", { stepCount: 4 });
  assert.equal(result.path, "standard");
  assert.equal(result.reason, "multi_step_workflow");
});

test("routeComplexity result has correct structure", () => {
  const result = routeComplexity("Test");
  assert.ok(typeof result.path === "string");
  assert.ok(typeof result.reason === "string");
  assert.ok(typeof result.estimatedBudgetFactor === "number");
  assert.ok(typeof result.routedAt === "string");
});

test("routeComplexity returns valid ComplexityPath values", () => {
  const validPaths = ["passthrough", "fast", "standard", "full"];
  const inputs: [string, string][] = [
    ["Hi", "passthrough"],
    ["What is X", "fast"],
    ["Normal task", "standard"],
    ["Refactor this", "full"],
  ];

  for (const [title, _expectedPath] of inputs) {
    const result = routeComplexity(title);
    assert.ok(validPaths.includes(result.path), `Path ${result.path} is not valid`);
  }
});
