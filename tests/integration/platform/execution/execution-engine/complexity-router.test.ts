/**
 * Integration Test: Complexity Router
 *
 * Verifies the complexity router correctly classifies tasks into
 * passthrough, fast, standard, and full complexity paths based on
 * keyword matching, token estimates, and task characteristics.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  routeComplexity,
  type ComplexityPath,
  type ComplexityRouteResult,
  type ComplexityRouterConfig,
} from "../../../../../src/platform/five-plane-execution/execution-engine/complexity-router.js";

test("complexity router: short input routes to passthrough", () => {
  const result = routeComplexity("Hello");
  assert.equal(result.path, "passthrough", "Short input should route to passthrough");
  assert.equal(result.reason, "short_input", "Should indicate short_input reason");
  assert.ok(result.estimatedBudgetFactor < 0.5, "Budget factor should be small");
});

test("complexity router: passthrough respects configured max chars", () => {
  // "Short" is 5 chars, which is <= 10
  const result = routeComplexity("Short", {
    config: { passthroughMaxChars: 10 },
  });
  assert.equal(result.path, "passthrough", "Input within max chars should route to passthrough");
});

test("complexity router: fast path keywords trigger fast routing", () => {
  // Strings must be > 50 chars to avoid passthrough routing (default passthroughMaxChars is 50)
  const fastKeywords = [
    "what is the weather today and give me detailed information",
    "show me the files in the current directory with full paths",
    "list all users in the system with their permissions",
    "find the configuration file for my application setup",
    "quick check on the status of things around here now",
    "simple question about something complex that needs explanation",
  ];

  for (const request of fastKeywords) {
    const result = routeComplexity(request);
    assert.equal(result.path, "fast", `Fast keyword in "${request}" should route to fast`);
    assert.ok(result.reason.includes("keyword_match"), "Reason should include keyword_match");
    assert.ok(result.estimatedBudgetFactor < 0.5, "Budget factor should be small for fast path");
  }
});

test("complexity router: full path keywords trigger full routing", () => {
  // Strings must be > 50 chars to avoid passthrough routing
  const fullKeywords = [
    "refactor the entire codebase to improve maintainability and reduce technical debt",
    "redesign the architecture for better scalability and improved performance",
    "migrate to the new system with zero downtime and full data integrity",
    "security audit required for compliance with industry standards and regulations",
    "performance analysis needed for production issues and optimization opportunities",
    "comprehensive review of all existing implementations and their dependencies",
  ];

  for (const request of fullKeywords) {
    const result = routeComplexity(request);
    assert.equal(result.path, "full", `Full keyword in "${request}" should route to full`);
    assert.ok(result.reason.includes("keyword_match"), "Reason should include keyword_match");
    assert.equal(result.estimatedBudgetFactor, 2.0, "Budget factor should be 2.0 for full path");
  }
});

test("complexity router: high token estimate routes to full", () => {
  // String must be > 50 chars to avoid passthrough
  const result = routeComplexity("Analyze this request with detailed context and full information", {
    estimatedTokens: 60000,
  });
  assert.equal(result.path, "full", "High token estimate should route to full");
  assert.equal(result.reason, "high_token_estimate", "Reason should indicate high token estimate");
});

test("complexity router: multi-step workflows get at least standard", () => {
  const result = routeComplexity("Quick question", {
    stepCount: 5,
  });
  assert.equal(result.path, "standard", "Multi-step should get at least standard");
  assert.equal(result.reason, "multi_step_workflow", "Reason should indicate multi-step");
});

test("complexity router: multi-step with full keyword routes to full", () => {
  const result = routeComplexity("Refactor files in the project", {
    stepCount: 4,
  });
  assert.equal(result.path, "full", "Multi-step with full keyword should route to full");
  assert.equal(result.reason, "keyword_match:refactor", "Reason should indicate full keyword match");
});

test("complexity router: QA mode forces full path regardless of input", () => {
  const result = routeComplexity("simple question", {
    qaMode: true,
  });
  assert.equal(result.path, "full", "QA mode should force full path");
  assert.equal(result.reason, "qa_mode_active", "Reason should indicate QA mode");
});

test("complexity router: QA mode respects qaModeForceFull config", () => {
  const result = routeComplexity("simple question with detailed context", {
    qaMode: true,
    config: { qaModeForceFull: false },
  });
  assert.notEqual(result.path, "full", "Should not force full when qaModeForceFull is false");
});

test("complexity router: default route is standard", () => {
  const result = routeComplexity("Please help me with my task that requires multiple steps to complete");
  assert.equal(result.path, "standard", "Default route should be standard");
  assert.equal(result.reason, "default", "Reason should indicate default");
});

test("complexity router: custom keywords override defaults", () => {
  // String must be > 50 chars to avoid passthrough
  const result = routeComplexity("urgent fix needed in the system right away please respond", {
    config: {
      fullPathKeywords: ["urgent"],
      fastPathKeywords: [],
      passthroughMaxChars: 50,
      qaModeForceFull: false,
    },
  });
  assert.equal(result.path, "full", "Custom full keyword should route to full");
  assert.equal(result.reason, "keyword_match:urgent", "Reason should match custom keyword");
});

test("complexity router: routing result includes routedAt timestamp", () => {
  const result = routeComplexity("Test request with some context and details here");
  assert.ok(result.routedAt != null, "Should have routedAt timestamp");
  assert.ok(new Date(result.routedAt).getTime() > 0, "routedAt should be valid ISO date");
});

test("complexity router: case insensitive keyword matching", () => {
  // Strings must be > 50 chars to avoid passthrough
  const upper = routeComplexity("REFACTOR the entire codebase with changes and updates");
  const lower = routeComplexity("refactor the entire codebase with changes and updates");
  const mixed = routeComplexity("ReFaCtOr the entire codebase with changes and updates");

  assert.equal(upper.path, "full", "Uppercase keyword should match");
  assert.equal(lower.path, "full", "Lowercase keyword should match");
  assert.equal(mixed.path, "full", "Mixed case keyword should match");
});

test("complexity router: budget factor scales with complexity path", () => {
  const passthrough = routeComplexity("Hi");
  const fast = routeComplexity("what is the weather today with details please and thanks");
  const standard = routeComplexity("Help me with a moderate complexity task that requires some work to complete properly");
  const full = routeComplexity("refactor the entire system architecture immediately with all the changes");

  assert.ok(passthrough.estimatedBudgetFactor < fast.estimatedBudgetFactor,
    "Passthrough should have lower budget than fast");
  assert.ok(fast.estimatedBudgetFactor < standard.estimatedBudgetFactor,
    "Fast should have lower budget than standard");
  assert.ok(standard.estimatedBudgetFactor < full.estimatedBudgetFactor,
    "Standard should have lower budget than full");
});

test("complexity router: multiple matching keywords uses first match", () => {
  // String must be > 50 chars to avoid passthrough
  const result = routeComplexity("refactor and redesign the architecture in detail with full implementation");
  // "refactor" appears first in the default full keywords
  assert.equal(result.path, "full", "Should route to full");
  assert.ok(result.reason.includes("refactor"), "Should indicate refactor keyword match");
});

test("complexity router: zero tokens uses default", () => {
  const result = routeComplexity("Test request with some additional context", {
    estimatedTokens: 0,
  });
  assert.notEqual(result.path, "full", "Zero tokens should not force full");
  assert.notEqual(result.reason, "high_token_estimate", "Zero tokens should not trigger high token reason");
});

test("complexity router: exactly passthrough max chars routes to passthrough", () => {
  // Default passthroughMaxChars is 50
  const exact = routeComplexity("12345678901234567890123456789012345678901234567890"); // 50 chars
  assert.equal(exact.path, "passthrough", "Exactly max chars should route to passthrough");
});

test("complexity router: just over passthrough max chars routes to standard", () => {
  const over = routeComplexity("123456789012345678901234567890123456789012345678901"); // 51 chars
  assert.notEqual(over.path, "passthrough", "Just over max chars should not route to passthrough");
});
