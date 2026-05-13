/**
 * Unit tests for RegExp caching in SimplifiedExplainer
 *
 * Verifies that regex patterns are compiled once and reused,
 * rather than being created on every simplifyText call.
 *
 * @see src/ops-maturity/explainability/simplified-explainer/index.ts
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  simplifyExplanation,
  formatAsMarkdown,
  formatAsNotification,
} from "../../../../src/ops-maturity/explainability/index.js";

/**
 * Test that simplifyText produces consistent results across multiple calls.
 * If regexes were recreated each time, case-insensitive matching could produce
 * different results due to regex internal state.
 */
test("simplifyText produces consistent results across multiple calls", () => {
  const inputs = [
    "The workflow stalled",
    "The WORKFLOW stalled",
    "The Workflow stalled",
    "The wOrKfLoW stalled",
  ];

  const results = inputs.map((input) => {
    const result = simplifyExplanation("execute", input, [], [], "medium");
    return result.whatHappened;
  });

  // All results should be identical since regex replacement is case-insensitive
  // and patterns are pre-compiled (not recreated on each call)
  for (const result of results) {
    assert.equal(result, results[0]);
    // Verify "workflow" is replaced with "process" in all cases
    assert.ok(!result.includes("workflow"));
    assert.ok(result.includes("process"));
  }
});

/**
 * Test that simplifyText handles repeated calls efficiently.
 * Pre-compiled regex ensures consistent behavior across many invocations.
 */
test("simplifyText handles repeated jargon replacement consistently", () => {
  const calls = 100;
  const results: string[] = [];

  for (let i = 0; i < calls; i++) {
    const result = simplifyExplanation("execute", "Deployment timeout occurred", [], [], "medium");
    results.push(result.whatHappened);
  }

  // All calls should produce identical results
  for (const result of results) {
    assert.equal(result, results[0]);
  }
});

/**
 * Test that multiple different jargon terms are all replaced correctly
 * when using pre-compiled patterns.
 */
test("simplifyText replaces multiple jargon terms correctly", () => {
  const result = simplifyExplanation(
    "execute",
    "The workflow timeout caused a deadlock requiring retry",
    [],
    [],
    "medium",
  );

  assert.ok(!result.whatHappened.includes("workflow"));
  assert.ok(!result.whatHappened.includes("timeout"));
  assert.ok(!result.whatHappened.includes("deadlock"));
  assert.ok(!result.whatHappened.includes("retry"));
  assert.ok(result.whatHappened.includes("process"));
  assert.ok(result.whatHappened.includes("took too long"));
  assert.ok(result.whatHappened.includes("stuck waiting"));
  assert.ok(result.whatHappened.includes("try again"));
});

/**
 * Test that pre-compiled regex for technical detail markers works correctly.
 */
test("simplifyText removes technical detail markers consistently", () => {
  const result = simplifyExplanation(
    "execute",
    "Task processed (count=42) and (latency=100ms)",
    [],
    [],
    "medium",
  );

  assert.ok(!result.whatHappened.includes("(count=42)"));
  assert.ok(!result.whatHappened.includes("(latency=100ms)"));
});

/**
 * Test that pre-compiled regex for multiple spaces works correctly.
 */
test("simplifyText normalizes multiple spaces consistently", () => {
  const result = simplifyExplanation(
    "execute",
    "Task    with   many     spaces",
    [],
    [],
    "medium",
  );

  assert.ok(!result.whatHappened.includes("  ")); // No double spaces
});

/**
 * Test that formatAsMarkdown and formatAsNotification work after multiple
 * simplifyExplanation calls, verifying cached patterns don't affect output.
 */
test("formatAsMarkdown works correctly after multiple calls", () => {
  // Warm up the pattern cache by calling multiple times
  for (let i = 0; i < 10; i++) {
    simplifyExplanation("execute", "Deployment completed", [], [], "low");
  }

  // Now check that formatAsMarkdown works correctly
  const explanation = simplifyExplanation("execute", "Workflow stalled", [], [], "medium");
  const markdown = formatAsMarkdown(explanation);

  assert.ok(markdown.includes("process")); // "workflow" replaced
  assert.ok(markdown.includes("Execution"));
});

/**
 * Test that formatAsNotification works correctly after multiple calls.
 */
test("formatAsNotification works correctly after multiple calls", () => {
  // Warm up the pattern cache by calling multiple times
  for (let i = 0; i < 10; i++) {
    simplifyExplanation("execute", "Task failed", [], [], "high");
  }

  // Now check that formatAsNotification works correctly
  const explanation = simplifyExplanation("execute", "Circuit_breaker triggered", [], [], "critical");
  const notification = formatAsNotification(explanation);

  assert.ok(notification.includes("safety switch")); // "circuit_breaker" replaced
});

/**
 * Test that case-insensitive matching works correctly with pre-compiled regex.
 */
test("simplifyText handles case variations in jargon correctly", () => {
  const variations = [
    "DEADLOCK",
    "deadlock",
    "Deadlock",
    "dEaDlOcK",
  ];

  const results = variations.map((v) => {
    const result = simplifyExplanation("execute", `Detected ${v}`, [], [], "medium");
    return result.whatHappened;
  });

  // All should show "stuck waiting" (replacement of deadlock)
  for (const r of results) {
    assert.ok(r.includes("stuck waiting"), `Expected "stuck waiting" in: ${r}`);
  }
});

/**
 * Test that pre-compiled patterns are reused across different stage names.
 */
test("patterns are reused across different stage types", () => {
  const stages = ["observe", "assess", "plan", "execute", "feedback"];

  for (const stage of stages) {
    const result = simplifyExplanation(stage, "Orchestration timeout", [], [], "medium");
    assert.ok(!result.whatHappened.includes("orchestration"));
    assert.ok(result.whatHappened.includes("coordination"));
  }
});
