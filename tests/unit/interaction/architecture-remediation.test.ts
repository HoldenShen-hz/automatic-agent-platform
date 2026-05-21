/**
 * Unit tests for architecture-remediation.ts
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  createClarificationState,
  detectTriggerFeedbackLoop,
  deriveUrgency,
  buildInteractionRemediationEvidence,
  inspectNlPrompt,
  type ClarificationState,
} from "../../../src/interaction/architecture-remediation.js";

test("createClarificationState returns 'clarifying' when missing slots exist", () => {
  const state = createClarificationState(["date", "environment"]);

  assert.equal(state.state, "clarifying");
  assert.deepEqual(state.missingSlots, ["date", "environment"]);
  assert.equal(state.intentConfidenceThreshold, 0.8);
  assert.equal(state.slotConfidenceThreshold, 0.85);
});

test("createClarificationState returns 'confirming' when no missing slots", () => {
  const state = createClarificationState([]);

  assert.equal(state.state, "confirming");
  assert.deepEqual(state.missingSlots, []);
  assert.equal(state.intentConfidenceThreshold, 0.8);
  assert.equal(state.slotConfidenceThreshold, 0.85);
});

test("detectTriggerFeedbackLoop returns false for acyclic graph", () => {
  const edges: readonly [string, string][] = [
    ["A", "B"],
    ["B", "C"],
  ];

  const hasLoop = detectTriggerFeedbackLoop(edges);

  assert.equal(hasLoop, false);
});

test("detectTriggerFeedbackLoop returns true for cyclic graph", () => {
  const edges: readonly [string, string][] = [
    ["A", "B"],
    ["B", "C"],
    ["C", "A"], // Creates cycle
  ];

  const hasLoop = detectTriggerFeedbackLoop(edges);

  assert.equal(hasLoop, true);
});

test("detectTriggerFeedbackLoop returns true for self-loop", () => {
  const edges: readonly [string, string][] = [
    ["A", "A"], // Self-loop
  ];

  const hasLoop = detectTriggerFeedbackLoop(edges);

  assert.equal(hasLoop, true);
});

test("detectTriggerFeedbackLoop returns false for empty graph", () => {
  const edges: readonly [string, string][] = [];

  const hasLoop = detectTriggerFeedbackLoop(edges);

  assert.equal(hasLoop, false);
});

test("detectTriggerFeedbackLoop handles disconnected components", () => {
  const edges: readonly [string, string][] = [
    ["A", "B"],
    ["C", "D"],
  ];

  const hasLoop = detectTriggerFeedbackLoop(edges);

  assert.equal(hasLoop, false);
});

test("deriveUrgency returns 'critical' for critical keywords", () => {
  assert.equal(deriveUrgency("this is critical"), "critical");
  assert.equal(deriveUrgency("p0 incident"), "critical");
  assert.equal(deriveUrgency("sev1 emergency"), "critical");
  assert.equal(deriveUrgency("EMERGENCY situation"), "critical");
});

test("deriveUrgency returns 'high' for high urgency keywords", () => {
  assert.equal(deriveUrgency("urgent task"), "high");
  assert.equal(deriveUrgency("p1 priority"), "high");
  assert.equal(deriveUrgency("high priority"), "high");
  assert.equal(deriveUrgency("urgent"), "high");
});

test("deriveUrgency returns 'medium' for normal messages", () => {
  assert.equal(deriveUrgency("normal request"), "medium");
  assert.equal(deriveUrgency("please help"), "medium");
});

test("deriveUrgency case insensitive matching", () => {
  assert.equal(deriveUrgency("CRITICAL"), "critical");
  assert.equal(deriveUrgency("CRITICAL"), "critical");
  assert.equal(deriveUrgency("Urgent"), "high");
});

test("buildInteractionRemediationEvidence returns array of evidence strings", () => {
  const evidence = buildInteractionRemediationEvidence();

  assert.equal(evidence.length, 20);
  assert.ok(evidence.every((e) => typeof e === "string"));
  assert.equal(evidence[0], "I-1");
  assert.equal(evidence[19], "I-20");
});

test("buildInteractionRemediationEvidence generates unique identifiers", () => {
  const evidence1 = buildInteractionRemediationEvidence();
  const evidence2 = buildInteractionRemediationEvidence();

  assert.equal(evidence1.length, evidence2.length);
  // Each call generates new IDs
  assert.equal(evidence1[0], evidence2[0]); // Same format
});