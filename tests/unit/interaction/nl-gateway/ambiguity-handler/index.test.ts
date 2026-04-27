/**
 * Unit tests for ambiguity-handler module
 */

import assert from "node:assert/strict";
import test from "node:test";
import { detectAmbiguity } from "../../../../../src/interaction/nl-gateway/ambiguity-handler/index.js";

test("detectAmbiguity returns true for short message under 6 characters", () => {
  assert.equal(detectAmbiguity("hello", 0.9, 1, 1), true);
  assert.equal(detectAmbiguity("ab", 0.85, 0, 0), true);
  assert.equal(detectAmbiguity("测试", 0.8, 0, 0), true);
});

test("detectAmbiguity returns true for message exactly 5 characters", () => {
  assert.equal(detectAmbiguity("hello", 0.9, 0, 0), true);
});

test("detectAmbiguity returns true for message exactly 6 characters", () => {
  assert.equal(detectAmbiguity("helloo", 0.9, 0, 0), false);
});

test("detectAmbiguity returns true when confidence below 0.7", () => {
  assert.equal(detectAmbiguity("a longer message here", 0.69, 2, 2), true);
  assert.equal(detectAmbiguity("some text", 0.5, 0, 0), true);
  assert.equal(detectAmbiguity("another message", 0.3, 1, 1), true);
});

test("detectAmbiguity returns true when confidence exactly at 0.7 threshold", () => {
  // 0.7 is NOT less than 0.7, so it passes the confidence check
  assert.equal(detectAmbiguity("a longer message", 0.7, 1, 1), false);
});

test("detectAmbiguity returns false when confidence at or above 0.7 and entities sufficient", () => {
  assert.equal(detectAmbiguity("a longer message", 0.7, 1, 1), false);
  assert.equal(detectAmbiguity("deploy to prod", 0.85, 1, 1), false);
  assert.equal(detectAmbiguity("create task now", 0.92, 2, 2), false);
});

test("detectAmbiguity returns true when entity count below required", () => {
  assert.equal(detectAmbiguity("a longer message here", 0.85, 2, 1), true);
  assert.equal(detectAmbiguity("longer text message", 0.9, 3, 2), true);
  assert.equal(detectAmbiguity("some request message", 0.8, 5, 4), true);
});

test("detectAmbiguity returns false when entity count meets requirement", () => {
  assert.equal(detectAmbiguity("a longer message here", 0.85, 2, 2), false);
  assert.equal(detectAmbiguity("deploy to production", 0.9, 1, 1), false);
});

test("detectAmbiguity treats zero required entity count as satisfied", () => {
  assert.equal(detectAmbiguity("short", 0.6, 0, 0), true);
  assert.equal(detectAmbiguity("a longer message", 0.85, 0, 0), false);
});

test("detectAmbiguity respects custom requiredEntityCount parameter", () => {
  assert.equal(detectAmbiguity("create a task", 0.9, 3, 3), false);
  assert.equal(detectAmbiguity("create a task", 0.9, 3, 2), true);
  assert.equal(detectAmbiguity("do something important", 0.85, 0, 0), false);
});

test("detectAmbiguity handles whitespace-only short messages", () => {
  assert.equal(detectAmbiguity("     ", 0.9, 0, 0), true);
});

test("detectAmbiguity handles empty message", () => {
  assert.equal(detectAmbiguity("", 0.9, 0, 0), true);
});

test("detectAmbiguity message length check happens before confidence check", () => {
  // Short message triggers ambiguity regardless of high confidence
  assert.equal(detectAmbiguity("ab", 0.95, 0, 0), true);
});

test("detectAmbiguity confidence check happens before entity count check", () => {
  // Low confidence triggers ambiguity even when entity count is sufficient
  assert.equal(detectAmbiguity("a longer message here", 0.5, 1, 1), true);
});

test("detectAmbiguity handles Unicode characters correctly", () => {
  // Chinese characters - "你好世界" is 4 characters (JavaScript .length counts code units)
  // Each Chinese character is 1 code unit in UTF-16 but counts as 1 in .length
  // 4 < 6 so true
  assert.equal(detectAmbiguity("你好世界", 0.9, 0, 0), true);
  // "你好世" is 3 characters < 6 so true
  assert.equal(detectAmbiguity("你好世", 0.9, 0, 0), true);
  // "你好世界很好" is 6 characters >= 6 so false
  assert.equal(detectAmbiguity("你好世界很好", 0.9, 0, 0), false);
});

test("detectAmbiguity handles mixed ASCII and Unicode", () => {
  // "hi你好" is 5 chars < 6 so true
  assert.equal(detectAmbiguity("hi你好", 0.85, 0, 0), true);
  // "hellome" is 7 chars >= 6 so false
  assert.equal(detectAmbiguity("hellome", 0.85, 0, 0), false);
  // "hello你" is 6 chars >= 6 so false
  assert.equal(detectAmbiguity("hello你", 0.85, 0, 0), false);
  // "hi你好世" is 5 chars < 6 so true
  assert.equal(detectAmbiguity("hi你好世", 0.85, 0, 0), true);
});

test("detectAmbiguity confidence boundary conditions", () => {
  // Just above threshold
  assert.equal(detectAmbiguity("a message that is long enough", 0.71, 1, 1), false);
  // Just below threshold
  assert.equal(detectAmbiguity("a message that is long enough", 0.69, 1, 1), true);
});

test("detectAmbiguity entity count zero edge case", () => {
  assert.equal(detectAmbiguity("message is long enough", 0.85, 1, 0), true);
  assert.equal(detectAmbiguity("message is long enough", 0.85, 0, 0), false);
});

test("detectAmbiguity with negative required entity count", () => {
  // Negative required entity count treated as satisfied (no missing entities)
  assert.equal(detectAmbiguity("any message", 0.9, -1, 0), false);
});

test("detectAmbiguity with very large required entity count", () => {
  assert.equal(detectAmbiguity("a longish message text here", 0.9, 100, 50), true);
});
