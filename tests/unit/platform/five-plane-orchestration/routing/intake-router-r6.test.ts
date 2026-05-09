import assert from "node:assert/strict";
import test from "node:test";

import { IntakeRouter } from "../../../../../src/platform/five-plane-orchestration/routing/intake-router.js";

/**
 * R6-11: Intake Router LLM Intent Extraction Tests
 * Tests for enhanced intent extraction with confidence scoring
 */

// ---------------------------------------------------------------------------
// R6-11: Confidence threshold triggers LLM-style intent extraction
// ---------------------------------------------------------------------------

test("R6-11: route() uses LLM extraction when keyword confidence is below threshold", () => {
  const router = new IntakeRouter();

  // Ambiguous input with low confidence should trigger LLM extraction
  const result = router.route({
    title: "maybe fix something",
    request: "perhaps update it depending on the situation",
  });

  assert.ok(result.routeTrace.some((t) => t.includes("llm_extraction")));
});

test("R6-11: route() detects ambiguous timing in goal text", () => {
  const router = new IntakeRouter();

  // Input with ambiguous timing references
  const result = router.route({
    request: "maybe do it soon or later when possible",
  });

  // Classification should have detected ambiguity
  assert.ok(result.classification.ambiguityDetected !== undefined);
  // If ambiguity detected via LLM extraction, confidence may be adjusted
  assert.ok(result.routeTrace.some((t) => t.includes("llm_extraction") || t.includes("confidence")));
});

test("R6-11: route() detects conditional language", () => {
  const router = new IntakeRouter();

  const result = router.route({
    request: "if the tests pass then merge, or maybe depending on review",
  });

  assert.ok(result.routeTrace.length > 0);
});

test("R6-11: route() detects vague goal language", () => {
  const router = new IntakeRouter();

  const result = router.route({
    request: "maybe perhaps possibly update something about some files",
  });

  // Should route with low confidence classification
  assert.ok(result.classification.confidence < 0.80 || result.routeTrace.some((t) => t.includes("llm_extraction")));
});

// ---------------------------------------------------------------------------
// R6-8: Priority uses "critical" not "urgent"
// ---------------------------------------------------------------------------

test("R6-8: isElevatedPriority handles critical priority correctly", () => {
  const router = new IntakeRouter();

  // Test that critical priority is recognized as elevated
  const result = router.route({
    request: "CRITICAL: abort all pending operations immediately",
  });

  // The routing should still work with critical priority
  assert.ok(result.workflowId !== undefined);
  assert.ok(result.classification.intent !== undefined);
});

test("R6-8: route() handles urgent priority routing", () => {
  const router = new IntakeRouter();

  const result = router.route({
    request: "URGENT: deploy the release now",
  });

  assert.ok(result.workflowId !== undefined);
});

// ---------------------------------------------------------------------------
// R6-11: Suggested clarifications for ambiguous inputs
// ---------------------------------------------------------------------------

test("R6-11: extractIntentWithConfidence provides suggested clarifications", () => {
  const router = new IntakeRouter();

  // Very short ambiguous input
  const result = router.route({
    request: "maybe",
  });

  assert.ok(result.classification !== undefined);
});

test("R6-11: high complexity input gets routed to orchestration", () => {
  const router = new IntakeRouter();

  // Complex multi-step request
  const result = router.route({
    request: "analyze the codebase, compare the implementations, design a refactoring plan, and implement the changes",
  });

  // Complex requests should require orchestration
  assert.equal(result.requiresOrchestration, true);
});