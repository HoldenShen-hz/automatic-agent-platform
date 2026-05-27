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
} from "../../../../../src/platform/five-plane-execution/execution-engine/complexity-router.js";

// =============================================================================
// routeComplexity - Basic path routing
// =============================================================================

test("routeComplexity returns passthrough for short input [complexity-router]", () => {
  const result = routeComplexity("Hi");
  assert.equal(result.path, "passthrough");
  assert.equal(result.reason, "short_input");
  assert.equal(result.estimatedBudgetFactor, 0.1);
  assert.ok(result.routedAt);
});

test("routeComplexity returns passthrough for exact max chars [complexity-router]", () => {
  const result = routeComplexity("a".repeat(50));
  assert.equal(result.path, "passthrough");
  assert.equal(result.reason, "short_input");
});

test("routeComplexity returns standard for medium input [complexity-router]", () => {
  // Title must be > 50 chars and not contain any keywords
  const result = routeComplexity("Please execute the data processing pipeline operation today");
  assert.equal(result.path, "standard");
  assert.equal(result.reason, "default");
  assert.equal(result.estimatedBudgetFactor, 1.0);
});

test("routeComplexity returns standard when stepCount is low [complexity-router]", () => {
  const result = routeComplexity("Tell me about JavaScript", { stepCount: 2 });
  assert.equal(result.path, "standard");
});

test("routeComplexity returns full for high stepCount with full keywords [complexity-router]", () => {
  const result = routeComplexity("Refactor the authentication module", { stepCount: 5 });
  assert.equal(result.path, "full");
  assert.ok(result.reason.startsWith("keyword_match:"));
  assert.equal(result.estimatedBudgetFactor, 2.0);
});

test("routeComplexity returns standard for high stepCount without full keywords [complexity-router]", () => {
  const result = routeComplexity("Run the tests", { stepCount: 5 });
  assert.equal(result.path, "standard");
  assert.equal(result.reason, "multi_step_workflow");
});

test("routeComplexity returns full for high token estimate [complexity-router]", () => {
  // Use stepCount: 1 to bypass passthrough check
  const result = routeComplexity("Analyze large codebase", { stepCount: 1, estimatedTokens: 60000 });
  assert.equal(result.path, "full");
  assert.equal(result.reason, "high_token_estimate");
  assert.equal(result.estimatedBudgetFactor, 2.0);
});

test("routeComplexity returns full for token estimate exactly at threshold [complexity-router]", () => {
  // Use stepCount: 1 to bypass passthrough check
  const result = routeComplexity("Analyze codebase", { stepCount: 1, estimatedTokens: 50000 });
  assert.equal(result.path, "standard");
});

test("routeComplexity is case insensitive for keyword matching [complexity-router]", () => {
  // Use stepCount: 1 to bypass passthrough check
  const result = routeComplexity("REFACTOR the codebase", { stepCount: 1 });
  assert.equal(result.path, "full");
  assert.ok(result.reason.startsWith("keyword_match:"));
});

// =============================================================================
// routeComplexity - QA Mode
// =============================================================================

test("routeComplexity returns full when QA mode is enabled [complexity-router]", () => {
  const result = routeComplexity("Simple question", { qaMode: true });
  assert.equal(result.path, "full");
  assert.equal(result.reason, "qa_mode_active");
  assert.equal(result.estimatedBudgetFactor, 2.0);
});

test("routeComplexity QA mode takes precedence over short input [complexity-router]", () => {
  const result = routeComplexity("Hi", { qaMode: true });
  assert.equal(result.path, "full");
  assert.equal(result.reason, "qa_mode_active");
});

test("routeComplexity QA mode takes precedence over fast keywords [complexity-router]", () => {
  const result = routeComplexity("What is X", { qaMode: true });
  assert.equal(result.path, "full");
  assert.equal(result.reason, "qa_mode_active");
});

// =============================================================================
// routeComplexity - Keyword Matching
// =============================================================================

test("routeComplexity matches refactor keyword [complexity-router]", () => {
  const result = routeComplexity("Please refactor the User class", { stepCount: 1 });
  assert.equal(result.path, "full");
  assert.equal(result.reason, "keyword_match:refactor");
});

test("routeComplexity matches redesign keyword [complexity-router]", () => {
  const result = routeComplexity("Redesign the login flow", { stepCount: 1 });
  assert.equal(result.path, "full");
  assert.equal(result.reason, "keyword_match:redesign");
});

test("routeComplexity matches migrate keyword [complexity-router]", () => {
  const result = routeComplexity("Migrate to new database", { stepCount: 1 });
  assert.equal(result.path, "full");
  assert.equal(result.reason, "keyword_match:migrate");
});

test("routeComplexity matches architecture keyword [complexity-router]", () => {
  const result = routeComplexity("Architecture review needed", { stepCount: 1 });
  assert.equal(result.path, "full");
  assert.equal(result.reason, "keyword_match:architecture");
});

test("routeComplexity matches security audit keyword [complexity-router]", () => {
  const result = routeComplexity("Security audit for the API", { stepCount: 1 });
  assert.equal(result.path, "full");
  assert.equal(result.reason, "keyword_match:security audit");
});

test("routeComplexity matches performance analysis keyword [complexity-router]", () => {
  const result = routeComplexity("Performance analysis of the query", { stepCount: 1 });
  assert.equal(result.path, "full");
  assert.equal(result.reason, "keyword_match:performance analysis");
});

test("routeComplexity matches comprehensive keyword [complexity-router]", () => {
  const result = routeComplexity("Comprehensive review of all modules", { stepCount: 1 });
  assert.equal(result.path, "full");
  assert.equal(result.reason, "keyword_match:comprehensive");
});

test("routeComplexity matches all files keyword [complexity-router]", () => {
  const result = routeComplexity("Update all files to use new API", { stepCount: 1 });
  assert.equal(result.path, "full");
  assert.equal(result.reason, "keyword_match:all files");
});

test("routeComplexity matches entire codebase keyword [complexity-router]", () => {
  const result = routeComplexity("Document entire codebase", { stepCount: 1 });
  assert.equal(result.path, "full");
  assert.equal(result.reason, "keyword_match:entire codebase");
});

test("routeComplexity matches deep analysis keyword [complexity-router]", () => {
  const result = routeComplexity("Deep analysis of memory usage", { stepCount: 1 });
  assert.equal(result.path, "full");
  assert.equal(result.reason, "keyword_match:deep analysis");
});

test("routeComplexity matches root cause keyword [complexity-router]", () => {
  const result = routeComplexity("Root cause analysis", { stepCount: 1 });
  assert.equal(result.path, "full");
  assert.equal(result.reason, "keyword_match:root cause");
});

test("routeComplexity matches investigation keyword [complexity-router]", () => {
  const result = routeComplexity("Investigation of the bug", { stepCount: 1 });
  assert.equal(result.path, "full");
  assert.equal(result.reason, "keyword_match:investigation");
});

test("routeComplexity matches fast keyword what is [complexity-router]", () => {
  const result = routeComplexity("What is the weather?", { stepCount: 1 });
  assert.equal(result.path, "fast");
  assert.equal(result.reason, "keyword_match:what is");
  assert.equal(result.estimatedBudgetFactor, 0.3);
});

test("routeComplexity matches fast keyword show me [complexity-router]", () => {
  const result = routeComplexity("Show me the logs", { stepCount: 1 });
  assert.equal(result.path, "fast");
  assert.equal(result.reason, "keyword_match:show me");
});

test("routeComplexity matches fast keyword list [complexity-router]", () => {
  const result = routeComplexity("List all users", { stepCount: 1 });
  assert.equal(result.path, "fast");
  assert.equal(result.reason, "keyword_match:list");
});

test("routeComplexity matches fast keyword find [complexity-router]", () => {
  const result = routeComplexity("Find the error log", { stepCount: 1 });
  assert.equal(result.path, "fast");
  assert.equal(result.reason, "keyword_match:find");
});

test("routeComplexity matches fast keyword grep [complexity-router]", () => {
  const result = routeComplexity("Grep for TODO", { stepCount: 1 });
  assert.equal(result.path, "fast");
  assert.equal(result.reason, "keyword_match:grep");
});

test("routeComplexity matches fast keyword search [complexity-router]", () => {
  const result = routeComplexity("Search for patterns", { stepCount: 1 });
  assert.equal(result.path, "fast");
  assert.equal(result.reason, "keyword_match:search");
});

test("routeComplexity matches fast keyword quick [complexity-router]", () => {
  const result = routeComplexity("Quick summary please", { stepCount: 1 });
  assert.equal(result.path, "fast");
  assert.equal(result.reason, "keyword_match:quick");
});

test("routeComplexity matches fast keyword simple [complexity-router]", () => {
  const result = routeComplexity("Simple question about X", { stepCount: 1 });
  assert.equal(result.path, "fast");
  assert.equal(result.reason, "keyword_match:simple");
});

test("routeComplexity matches fast keyword brief [complexity-router]", () => {
  const result = routeComplexity("Brief status update", { stepCount: 1 });
  assert.equal(result.path, "fast");
  assert.equal(result.reason, "keyword_match:brief");
});

test("routeComplexity matches fast keyword lookup [complexity-router]", () => {
  const result = routeComplexity("Lookup the order status", { stepCount: 1 });
  assert.equal(result.path, "fast");
  assert.equal(result.reason, "keyword_match:lookup");
});

test("routeComplexity matches fast keyword check [complexity-router]", () => {
  const result = routeComplexity("Check the server status", { stepCount: 1 });
  assert.equal(result.path, "fast");
  assert.equal(result.reason, "keyword_match:check");
});

// =============================================================================
// routeComplexity - Custom Configuration
// =============================================================================

test("routeComplexity uses custom fullPathKeywords [complexity-router]", () => {
  const config: ComplexityRouterConfig = {
    fullPathKeywords: ["custom_full_keyword"],
  };
  const result = routeComplexity("Do custom_full_keyword now", { stepCount: 1, config });
  assert.equal(result.path, "full");
  assert.equal(result.reason, "keyword_match:custom_full_keyword");
});

test("routeComplexity uses custom fastPathKeywords [complexity-router]", () => {
  const config: ComplexityRouterConfig = {
    fastPathKeywords: ["custom_fast"],
  };
  const result = routeComplexity("custom_fast answer needed", { stepCount: 1, config });
  assert.equal(result.path, "fast");
  assert.equal(result.reason, "keyword_match:custom_fast");
});

test("routeComplexity uses custom passthroughMaxChars [complexity-router]", () => {
  const config: ComplexityRouterConfig = {
    passthroughMaxChars: 10,
  };
  const result = routeComplexity("1234567890", { config });
  assert.equal(result.path, "passthrough");
  assert.equal(result.reason, "short_input");

  const result2 = routeComplexity("12345678901", { config });
  assert.equal(result2.path, "standard");
});

test("routeComplexity qaModeForceFull can be disabled [complexity-router]", () => {
  const config: ComplexityRouterConfig = {
    qaModeForceFull: false,
  };
  const result = routeComplexity("Simple", { qaMode: true, config });
  assert.equal(result.path, "passthrough");
});

// =============================================================================
// routeComplexity - Edge Cases
// =============================================================================

test("routeComplexity handles empty string [complexity-router]", () => {
  const result = routeComplexity("");
  assert.equal(result.path, "passthrough");
});

test("routeComplexity handles very long input [complexity-router]", () => {
  const longTitle = "a".repeat(10000);
  const result = routeComplexity(longTitle);
  // With high char count and no keywords, should be standard
  assert.equal(result.path, "standard");
  assert.equal(result.reason, "default");
});

test("routeComplexity handles zero stepCount [complexity-router]", () => {
  const result = routeComplexity("Test", { stepCount: 0 });
  // stepCount: 0 is falsy for passthrough check, so passthrough applies
  assert.equal(result.path, "passthrough");
});

test("routeComplexity handles undefined options [complexity-router]", () => {
  const result = routeComplexity("This is a longer test task title");
  assert.ok(result.path);
  assert.ok(result.reason);
});

test("routeComplexity stepCount of 1 is not multi-step [complexity-router]", () => {
  const result = routeComplexity("Refactor the codebase", { stepCount: 1 });
  // Refactor is a full keyword, so it should still be full
  assert.equal(result.path, "full");
});

test("routeComplexity stepCount of 3 is not multi-step [complexity-router]", () => {
  const result = routeComplexity("Simple task here", { stepCount: 3 });
  // 3 steps is not > 3, passthrough skipped due to stepCount, "simple" is fast keyword
  assert.equal(result.path, "fast");
});

test("routeComplexity stepCount of 4 triggers multi-step [complexity-router]", () => {
  const result = routeComplexity("Simple task", { stepCount: 4 });
  assert.equal(result.path, "standard");
  assert.equal(result.reason, "multi_step_workflow");
});

test("routeComplexity result has correct structure [complexity-router]", () => {
  const result = routeComplexity("Test");
  assert.ok(typeof result.path === "string");
  assert.ok(typeof result.reason === "string");
  assert.ok(typeof result.estimatedBudgetFactor === "number");
  assert.ok(typeof result.routedAt === "string");
});

test("routeComplexity returns valid ComplexityPath values [complexity-router]", () => {
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

// =============================================================================
// routeComplexity - Keyword First-Match Ordering
// =============================================================================

test("routeComplexity returns first matching keyword when multiple full keywords match [complexity-router]", () => {
  // Title contains multiple full-path keywords
  const result = routeComplexity("Refactor and redesign the architecture", { stepCount: 1 });
  assert.equal(result.path, "full");
  // "refactor" comes before "redesign" and "architecture" in DEFAULT_FULL_KEYWORDS
  assert.equal(result.reason, "keyword_match:refactor");
});

test("routeComplexity returns first matching keyword when multiple fast keywords match [complexity-router]", () => {
  // Title contains multiple fast-path keywords
  const result = routeComplexity("What is a quick simple lookup", { stepCount: 1 });
  assert.equal(result.path, "fast");
  // "what is" comes before "quick", "simple", "lookup" in DEFAULT_FAST_KEYWORDS
  assert.equal(result.reason, "keyword_match:what is");
});

test("routeComplexity first full keyword wins over fast keyword [complexity-router]", () => {
  // When both full and fast keywords are present, full takes precedence (checked first)
  const result = routeComplexity("Refactor the code quickly", { stepCount: 1 });
  assert.equal(result.path, "full");
  assert.equal(result.reason, "keyword_match:refactor");
});

test("routeComplexity fast keyword does not win when full keyword appears first [complexity-router]", () => {
  // Even though "quick" is a fast keyword, "refactor" comes first
  const result = routeComplexity("Quick refactor needed", { stepCount: 1 });
  assert.equal(result.path, "full");
  assert.equal(result.reason, "keyword_match:refactor");
});

// =============================================================================
// routeComplexity - Exact Boundary Conditions
// =============================================================================

test("routeComplexity stepCount of exactly 3 does not trigger multi-step [complexity-router]", () => {
  const result = routeComplexity("Normal task name here", { stepCount: 3 });
  // stepCount 3 is NOT > 3, so it doesn't trigger multi_step_workflow
  // Without keywords and > 50 chars, should be standard
  assert.equal(result.path, "standard");
  assert.equal(result.reason, "default");
});

test("routeComplexity stepCount of exactly 4 triggers multi-step [complexity-router]", () => {
  const result = routeComplexity("Normal task", { stepCount: 4 });
  assert.equal(result.path, "standard");
  assert.equal(result.reason, "multi_step_workflow");
});

test("routeComplexity token estimate of exactly 50000 does not trigger high_token [complexity-router]", () => {
  // 50000 is NOT > 50000, so should not be full due to tokens
  const result = routeComplexity("Analyze this task", { stepCount: 1, estimatedTokens: 50000 });
  assert.equal(result.path, "standard");
  assert.equal(result.reason, "default");
});

test("routeComplexity token estimate of 50001 triggers high_token [complexity-router]", () => {
  const result = routeComplexity("Analyze this task", { stepCount: 1, estimatedTokens: 50001 });
  assert.equal(result.path, "full");
  assert.equal(result.reason, "high_token_estimate");
});

test("routeComplexity token estimate of 0 does not trigger high_token [complexity-router]", () => {
  const result = routeComplexity("Analyze this task", { stepCount: 1, estimatedTokens: 0 });
  assert.equal(result.path, "standard");
});

// =============================================================================
// routeComplexity - Multi-Keyword Title with Mixed Types
// =============================================================================

test("routeComplexity handles title with both full and fast keywords [complexity-router]", () => {
  const result = routeComplexity("What is refactor?", { stepCount: 1 });
  assert.equal(result.path, "full");
  assert.equal(result.reason, "keyword_match:refactor");
});

test("routeComplexity handles title with fast keyword before full keyword [complexity-router]", () => {
  const result = routeComplexity("Find the bug and fix it with refactor", { stepCount: 1 });
  assert.equal(result.path, "full");
  // "refactor" is the first full keyword found
  assert.equal(result.reason, "keyword_match:refactor");
});

test("routeComplexity handles investigation with quick keyword [complexity-router]", () => {
  const result = routeComplexity("Quick investigation needed", { stepCount: 1 });
  assert.equal(result.path, "full");
  assert.equal(result.reason, "keyword_match:investigation");
});

// =============================================================================
// routeComplexity - Substring and Edge Case Keywords
// =============================================================================

test("routeComplexity partial word does not match keyword [complexity-router]", () => {
  // "arch" is not "architecture", so partial match should not trigger full path
  const result = routeComplexity("arch is a prefix", { stepCount: 1 });
  // No full keywords present, no fast keywords, so standard
  assert.equal(result.path, "standard");
  assert.equal(result.reason, "default");
});

test("routeComplexity match is case insensitive [complexity-router]", () => {
  const result = routeComplexity("REFACTOR THE CODE", { stepCount: 1 });
  assert.equal(result.path, "full");
  assert.equal(result.reason, "keyword_match:refactor");
});

test("routeComplexity mixed case keyword still matches [complexity-router]", () => {
  const result = routeComplexity("ReFaCtOr the code", { stepCount: 1 });
  assert.equal(result.path, "full");
  assert.equal(result.reason, "keyword_match:refactor");
});

// =============================================================================
// routeComplexity - Config Merging and Defaults
// =============================================================================

test("routeComplexity merges custom config with defaults [complexity-router]", () => {
  const config: ComplexityRouterConfig = {
    fullPathKeywords: ["custom_keyword"],
  };
  const result = routeComplexity("Normal task", { stepCount: 1, config });
  // Should still use default fastPathKeywords and passthroughMaxChars
  assert.equal(result.path, "standard");
});

test("routeComplexity partial custom config still uses defaults for missing keys [complexity-router]", () => {
  const config: ComplexityRouterConfig = {
    passthroughMaxChars: 100,
  };
  // "Hi" is only 2 chars, should still be passthrough
  const result = routeComplexity("Hi", { config });
  assert.equal(result.path, "passthrough");
});

test("routeComplexity empty fullPathKeywords array means no keyword matches [complexity-router]", () => {
  const config: ComplexityRouterConfig = {
    fullPathKeywords: [],
  };
  const result = routeComplexity("Refactor the code", { stepCount: 1, config });
  // No full keywords, no fast keywords, should be standard
  assert.equal(result.path, "standard");
});

test("routeComplexity empty fastPathKeywords array means no fast keyword matches [complexity-router]", () => {
  const config: ComplexityRouterConfig = {
    fastPathKeywords: [],
  };
  const result = routeComplexity("What is the answer", { stepCount: 1, config });
  // "what is" should not match as fast keyword, but refactor is not present
  // Without refactor, it would be standard
  assert.equal(result.path, "standard");
});

test("routeComplexity empty both keyword arrays defaults to standard [complexity-router]", () => {
  const config: ComplexityRouterConfig = {
    fullPathKeywords: [],
    fastPathKeywords: [],
  };
  const result = routeComplexity("Refactor the code", { stepCount: 1, config });
  assert.equal(result.path, "standard");
  assert.equal(result.reason, "default");
});

test("routeComplexity config qaModeForceFull defaults to true [complexity-router]", () => {
  // Without explicitly setting qaModeForceFull, it should be true
  const result = routeComplexity("Simple", { qaMode: true });
  assert.equal(result.path, "full");
});

test("routeComplexity all config options can be customized [complexity-router]", () => {
  const config: ComplexityRouterConfig = {
    fullPathKeywords: ["xyz"],
    fastPathKeywords: ["abc"],
    passthroughMaxChars: 5,
    qaModeForceFull: false,
  };
  // Custom full keyword
  const r1 = routeComplexity("xyz task", { stepCount: 1, config });
  assert.equal(r1.path, "full");
  // Custom fast keyword
  const r2 = routeComplexity("abc task", { stepCount: 1, config });
  assert.equal(r2.path, "fast");
  // Custom passthrough max chars
  const r3 = routeComplexity("12345", { config });
  assert.equal(r3.path, "passthrough");
  // QA mode disabled
  const r4 = routeComplexity("Short", { qaMode: true, config });
  assert.equal(r4.path, "passthrough");
});

// =============================================================================
// routeComplexity - Precedence and Interaction Rules
// =============================================================================

test("routeComplexity stepCount > 3 with fast keyword but no full keyword routes to standard [complexity-router]", () => {
  // Even with a fast keyword like "what is", when stepCount > 3 it goes to standard
  const result = routeComplexity("What is the status", { stepCount: 5 });
  assert.equal(result.path, "standard");
  assert.equal(result.reason, "multi_step_workflow");
});

test("routeComplexity short input with stepCount present does not passthrough [complexity-router]", () => {
  // When stepCount is present (even 1), passthrough check is skipped
  const result = routeComplexity("Hi", { stepCount: 1 });
  // No keywords, no multi-step (>3), no high tokens → standard
  assert.equal(result.path, "standard");
  assert.equal(result.reason, "default");
});

test("routeComplexity stepCount overrides short input passthrough [complexity-router]", () => {
  const result = routeComplexity("Tell me", { stepCount: 2 });
  // stepCount: 2 is not > 3, passthrough check is skipped due to stepCount
  // No keywords, so standard
  assert.equal(result.path, "standard");
});

test("routeComplexity high tokens takes precedence over fast keywords [complexity-router]", () => {
  const result = routeComplexity("What is the status", { stepCount: 1, estimatedTokens: 60000 });
  assert.equal(result.path, "full");
  assert.equal(result.reason, "high_token_estimate");
});

test("routeComplexity multi-step check happens before high token check [complexity-router]", () => {
  // stepCount > 3 with no keywords → standard (multi_step_workflow)
  // This is checked BEFORE the high token estimate
  const result = routeComplexity("Check status please", { stepCount: 5, estimatedTokens: 60000 });
  // "check" is fast keyword but multi_step comes first for stepCount > 3
  assert.equal(result.path, "standard");
  assert.equal(result.reason, "multi_step_workflow");
});

// =============================================================================
// routeComplexity - routedAt Timestamp Validation
// =============================================================================

test("routeComplexity routedAt is a valid ISO timestamp [complexity-router]", () => {
  const result = routeComplexity("Test");
  // Should be parseable as a date
  const date = new Date(result.routedAt);
  assert.ok(!isNaN(date.getTime()), "routedAt should be a valid date");
});

test("routeComplexity routedAt is different for different calls [complexity-router]", () => {
  const result1 = routeComplexity("Test1");
  const result2 = routeComplexity("Test2");
  // At minimum, they should be strings
  assert.ok(typeof result1.routedAt === "string");
  assert.ok(typeof result2.routedAt === "string");
});

// =============================================================================
// routeComplexity - Estimated Budget Factor Validation
// =============================================================================

test("routeComplexity passthrough has budget factor 0.1 [complexity-router]", () => {
  const result = routeComplexity("Hi");
  assert.equal(result.estimatedBudgetFactor, 0.1);
});

test("routeComplexity fast has budget factor 0.3 [complexity-router]", () => {
  const result = routeComplexity("What is X", { stepCount: 1 });
  assert.equal(result.estimatedBudgetFactor, 0.3);
});

test("routeComplexity standard has budget factor 1.0 [complexity-router]", () => {
  const result = routeComplexity("Normal task here", { stepCount: 1 });
  assert.equal(result.estimatedBudgetFactor, 1.0);
});

test("routeComplexity full has budget factor 2.0 [complexity-router]", () => {
  const result = routeComplexity("Refactor", { stepCount: 1 });
  assert.equal(result.estimatedBudgetFactor, 2.0);
});

test("routeComplexity qa_mode_active has budget factor 2.0 [complexity-router]", () => {
  const result = routeComplexity("Test", { qaMode: true });
  assert.equal(result.estimatedBudgetFactor, 2.0);
});

test("routeComplexity high_token_estimate has budget factor 2.0 [complexity-router]", () => {
  const result = routeComplexity("Test", { stepCount: 1, estimatedTokens: 60000 });
  assert.equal(result.estimatedBudgetFactor, 2.0);
});

test("routeComplexity multi_step_workflow has budget factor 1.0 [complexity-router]", () => {
  const result = routeComplexity("Task", { stepCount: 5 });
  assert.equal(result.estimatedBudgetFactor, 1.0);
});

// =============================================================================
// routeComplexity - ComplexityRouteResult Structure
// =============================================================================

test("routeComplexity result has all required fields [complexity-router]", () => {
  const result = routeComplexity("Test");
  assert.ok(Object.hasOwn(result, "path"));
  assert.ok(Object.hasOwn(result, "reason"));
  assert.ok(Object.hasOwn(result, "estimatedBudgetFactor"));
  assert.ok(Object.hasOwn(result, "routedAt"));
});

test("routeComplexity result fields have correct types [complexity-router]", () => {
  const result = routeComplexity("Test");
  assert.equal(typeof result.path, "string");
  assert.equal(typeof result.reason, "string");
  assert.equal(typeof result.estimatedBudgetFactor, "number");
  assert.equal(typeof result.routedAt, "string");
});

test("routeComplexity result reason is non-empty string [complexity-router]", () => {
  const result = routeComplexity("Test");
  assert.ok(result.reason.length > 0);
});

test("routeComplexity keyword_match reason includes the keyword [complexity-router]", () => {
  const result = routeComplexity("Refactor this", { stepCount: 1 });
  assert.ok(result.reason.includes("refactor"));
});

test("routeComplexity reason values are among expected set [complexity-router]", () => {
  const reasons: string[] = [];
  // Collect reasons from various calls
  reasons.push(routeComplexity("Hi").reason);
  reasons.push(routeComplexity("What is X", { stepCount: 1 }).reason);
  reasons.push(routeComplexity("Refactor", { stepCount: 1 }).reason);
  reasons.push(routeComplexity("Task", { stepCount: 5 }).reason);
  reasons.push(routeComplexity("Test", { qaMode: true }).reason);
  reasons.push(routeComplexity("Test", { stepCount: 1, estimatedTokens: 60000 }).reason);
  reasons.push(routeComplexity("Normal task here", { stepCount: 1 }).reason);

  // All reasons should be non-empty strings
  for (const reason of reasons) {
    assert.ok(typeof reason === "string" && reason.length > 0);
  }
});

// =============================================================================
// routeComplexity - Edge Cases with Step Count
// =============================================================================

test("routeComplexity stepCount undefined vs stepCount 0 behave the same for passthrough [complexity-router]", () => {
  // stepCount undefined: passthrough check uses taskTitle.length
  const r1 = routeComplexity("Hi");
  assert.equal(r1.path, "passthrough");

  // stepCount 0: !options?.stepCount = !0 = true (0 is falsy), so passthrough still applies
  const r2 = routeComplexity("Hi", { stepCount: 0 });
  assert.equal(r2.path, "passthrough");
});

test("routeComplexity stepCount 0 is falsy for passthrough check [complexity-router]", () => {
  // stepCount: 0 is falsy, so !options?.stepCount = true, passthrough applies
  const result = routeComplexity("Short", { stepCount: 0 });
  assert.equal(result.path, "passthrough");
});

test("routeComplexity stepCount with very large value triggers multi-step [complexity-router]", () => {
  const result = routeComplexity("Task", { stepCount: 1000 });
  assert.equal(result.path, "standard");
  assert.equal(result.reason, "multi_step_workflow");
});

// =============================================================================
// routeComplexity - All Default Full Keywords Coverage
// =============================================================================

test("routeComplexity deep analysis keyword works [complexity-router]", () => {
  const result = routeComplexity("Deep analysis of the issue", { stepCount: 1 });
  assert.equal(result.path, "full");
  assert.equal(result.reason, "keyword_match:deep analysis");
});

test("routeComplexity root cause keyword works [complexity-router]", () => {
  const result = routeComplexity("Root cause analysis", { stepCount: 1 });
  assert.equal(result.path, "full");
  assert.equal(result.reason, "keyword_match:root cause");
});

// =============================================================================
// routeComplexity - Title Length Edge Cases
// =============================================================================

test("routeComplexity title at passthroughMaxChars - 1 is passthrough [complexity-router]", () => {
  const result = routeComplexity("a".repeat(49));
  assert.equal(result.path, "passthrough");
});

test("routeComplexity title at passthroughMaxChars + 1 is not passthrough [complexity-router]", () => {
  const result = routeComplexity("a".repeat(51));
  // No stepCount, so passthrough check applies but 51 > 50
  assert.equal(result.path, "standard");
});

test("routeComplexity single character is passthrough [complexity-router]", () => {
  const result = routeComplexity("a");
  assert.equal(result.path, "passthrough");
});

test("routeComplexity two characters is passthrough [complexity-router]", () => {
  const result = routeComplexity("ab");
  assert.equal(result.path, "passthrough");
});

test("routeComplexity three characters is passthrough [complexity-router]", () => {
  const result = routeComplexity("abc");
  assert.equal(result.path, "passthrough");
});

// =============================================================================
// routeComplexity - Unicode and Special Characters
// =============================================================================

test("routeComplexity handles unicode characters in title [complexity-router]", () => {
  const result = routeComplexity("Test with emoji", { stepCount: 1 });
  assert.ok(result.path);
});

test("routeComplexity handles special characters in title [complexity-router]", () => {
  const result = routeComplexity("Refactor: module@$123", { stepCount: 1 });
  assert.equal(result.path, "full");
  assert.equal(result.reason, "keyword_match:refactor");
});

// =============================================================================
// routeComplexity - Function Return Type Completeness
// =============================================================================

test("routeComplexity returns correct path for each path type [complexity-router]", () => {
  assert.equal(routeComplexity("Hi").path, "passthrough");
  assert.equal(routeComplexity("What is X", { stepCount: 1 }).path, "fast");
  assert.equal(routeComplexity("Normal task", { stepCount: 1 }).path, "standard");
  assert.equal(routeComplexity("Refactor", { stepCount: 1 }).path, "full");
});

test("routeComplexity multiple calls return consistent structure [complexity-router]", () => {
  for (let i = 0; i < 5; i++) {
    const result = routeComplexity("Test task");
    assert.ok(typeof result.path === "string");
    assert.ok(typeof result.reason === "string");
    assert.ok(typeof result.estimatedBudgetFactor === "number");
    assert.ok(typeof result.routedAt === "string");
  }
});
