import test from "node:test";
import { strict as assert } from "node:assert/strict";
import { detectAmbiguity } from "../../../../../../src/interaction/nl-gateway/ambiguity-handler/index.js";

test("detectAmbiguity returns true for short messages under 6 characters", () => {
  assert.strictEqual(detectAmbiguity("Hi", 0.9, 1, 1), true);
  assert.strictEqual(detectAmbiguity("Ok", 0.9, 1, 1), true);
  assert.strictEqual(detectAmbiguity("Yes", 0.9, 1, 1), true);
  assert.strictEqual(detectAmbiguity("No", 0.9, 1, 1), true);
});

test("detectAmbiguity returns true for low confidence below 0.7", () => {
  assert.strictEqual(detectAmbiguity("Please perform the task", 0.5, 1, 1), true);
  assert.strictEqual(detectAmbiguity("Run something", 0.6, 1, 1), true);
  assert.strictEqual(detectAmbiguity("Execute this", 0.69, 1, 1), true);
});

test("detectAmbiguity returns true when extractedEntityCount < requiredEntityCount", () => {
  assert.strictEqual(detectAmbiguity("Please do something", 0.9, 3, 1), true);
  assert.strictEqual(detectAmbiguity("Run the thing", 0.9, 2, 0), true);
  assert.strictEqual(detectAmbiguity("Execute task", 0.9, 5, 2), true);
});

test("detectAmbiguity returns false when all conditions pass", () => {
  assert.strictEqual(detectAmbiguity("Create a new user account for John Doe", 0.9, 1, 1), false);
  assert.strictEqual(detectAmbiguity("Please analyze the report", 0.8, 1, 1), false);
  assert.strictEqual(detectAmbiguity("Run the deployment pipeline", 0.75, 2, 2), false);
});

test("detectAmbiguity uses default requiredEntityCount of 1", () => {
  assert.strictEqual(detectAmbiguity("Some message", 0.9), true);
  assert.strictEqual(detectAmbiguity("Complex enough message here", 0.9, 1, 1), false);
});

test("detectAmbiguity treats confidence of exactly 0.7 as not ambiguous", () => {
  assert.strictEqual(detectAmbiguity("Sufficiently long message", 0.7, 1, 1), false);
});

test("detectAmbiguity treats exactly 0.69 as ambiguous", () => {
  assert.strictEqual(detectAmbiguity("Sufficiently long message", 0.69, 1, 1), true);
});

test("detectAmbiguity treats confidence of 0.7 and above as not low", () => {
  assert.strictEqual(detectAmbiguity("Test message", 0.71, 1, 1), true);
});

test("detectAmbiguity trims whitespace before length check", () => {
  assert.strictEqual(detectAmbiguity("      ", 0.9, 1, 1), true);
  assert.strictEqual(detectAmbiguity("   Hi   ", 0.9, 1, 1), true);
});

test("detectAmbiguity with exact entity count matches required", () => {
  assert.strictEqual(detectAmbiguity("Test message", 0.9, 2, 2), true);
  assert.strictEqual(detectAmbiguity("Test message", 0.9, 2, 3), true);
});

test("detectAmbiguity returns false for long message with high confidence and sufficient entities", () => {
  assert.strictEqual(
    detectAmbiguity("Please create a new virtual machine with 8 cores and 32GB RAM", 0.85, 2, 3),
    false,
  );
});

test("detectAmbiguity handles very long messages with low confidence", () => {
  const longMessage = "This is a very long message that contains many words and should be considered for ambiguity detection";
  assert.strictEqual(detectAmbiguity(longMessage, 0.5, 1, 1), true);
});

test("detectAmbiguity handles zero requiredEntityCount", () => {
  assert.strictEqual(detectAmbiguity("Short", 0.9, 0, 0), true);
  assert.strictEqual(detectAmbiguity("A sufficiently long message here", 0.9, 0, 0), false);
});

test("detectAmbiguity with high confidence but short message", () => {
  assert.strictEqual(detectAmbiguity("Ab", 0.95, 1, 1), true);
  assert.strictEqual(detectAmbiguity("Short", 0.95, 1, 1), true);
});

test("detectAmbiguity with all required entities extracted", () => {
  assert.strictEqual(detectAmbiguity("Create user John with email john@example.com", 0.9, 2, 3), false);
});

test("detectAmbiguity edge case at message length boundary", () => {
  assert.strictEqual(detectAmbiguity("12345", 0.9, 1, 1), true);
  assert.strictEqual(detectAmbiguity("123456", 0.9, 1, 1), false);
});

test("detectAmbiguity handles high confidence but missing entities", () => {
  assert.strictEqual(detectAmbiguity("Please complete the task", 0.95, 5, 0), true);
});

test("detectAmbiguity with maximum confidence value", () => {
  assert.strictEqual(detectAmbiguity("Short", 1.0, 1, 1), true);
  assert.strictEqual(detectAmbiguity("Sufficiently long message", 1.0, 1, 1), false);
});

test("detectAmbiguity with extractedEntityCount greater than required", () => {
  assert.strictEqual(detectAmbiguity("Test message", 0.9, 1, 5), false);
});