/**
 * Unit tests for schedule-manager parseDurationMs function
 */

import assert from "node:assert/strict";
import test from "node:test";
import { shouldRunScheduleTrigger } from "../../../../../src/interaction/proactive-agent/schedule-manager/index.js";

test("parseDurationMs parses millisecond duration", () => {
  // 500ms cooldown, 600ms elapsed should be >= 500ms
  const result = shouldRunScheduleTrigger("2026-04-19T01:00:00.000Z", "2026-04-19T01:00:00.600Z", "500ms");
  assert.equal(result, true);
});

test("parseDurationMs parses second duration", () => {
  // 3s cooldown, 2 seconds elapsed
  const result = shouldRunScheduleTrigger("2026-04-19T01:00:00.000Z", "2026-04-19T01:00:02.000Z", "3s");
  assert.equal(result, false);
});

test("parseDurationMs parses minute duration", () => {
  // 5m cooldown, 4 minutes elapsed
  const result = shouldRunScheduleTrigger("2026-04-19T01:00:00.000Z", "2026-04-19T01:04:00.000Z", "5m");
  assert.equal(result, false);
});

test("parseDurationMs parses hour duration", () => {
  // 1h cooldown, 30 minutes elapsed
  const result = shouldRunScheduleTrigger("2026-04-19T01:00:00.000Z", "2026-04-19T01:30:00.000Z", "1h");
  assert.equal(result, false);
});

test("parseDurationMs parses day duration", () => {
  // 1d cooldown, 12 hours elapsed
  const result = shouldRunScheduleTrigger("2026-04-19T01:00:00.000Z", "2026-04-19T13:00:00.000Z", "1d");
  assert.equal(result, false);
});

test("parseDurationMs handles whitespace in duration string", () => {
  // Duration string with whitespace
  const result = shouldRunScheduleTrigger("2026-04-19T01:00:00.000Z", "2026-04-19T01:00:00.500Z", " 500ms ");
  assert.equal(result, true);
});

test("parseDurationMs returns 0 for invalid duration format", () => {
  // Invalid format should return 0 cooldown, so should fire immediately
  const result = shouldRunScheduleTrigger("2026-04-19T01:00:00.000Z", "2026-04-19T02:00:00.000Z", "invalid");
  assert.equal(result, true);
});

test("parseDurationMs returns 0 for empty duration string", () => {
  // Empty string should return 0 cooldown
  const result = shouldRunScheduleTrigger("2026-04-19T01:00:00.000Z", "2026-04-19T02:00:00.000Z", "");
  assert.equal(result, true);
});

test("parseDurationMs handles duration at exact boundary", () => {
  // Exactly at 3s boundary
  const result = shouldRunScheduleTrigger("2026-04-19T01:00:00.000Z", "2026-04-19T01:00:03.000Z", "3s");
  assert.equal(result, true);
});

test("parseDurationMs handles duration just before boundary", () => {
  // Just before 3s boundary (1ms less)
  const result = shouldRunScheduleTrigger("2026-04-19T01:00:00.000Z", "2026-04-19T01:00:02.999Z", "3s");
  assert.equal(result, false);
});

test("shouldRunScheduleTrigger returns true for null lastFiredAt regardless of cooldown", () => {
  const result = shouldRunScheduleTrigger(null, "2026-04-19T01:00:00.000Z", "1d");
  assert.equal(result, true);
});

test("shouldRunScheduleTrigger returns true when time difference exceeds cooldown", () => {
  const result = shouldRunScheduleTrigger("2026-04-19T01:00:00.000Z", "2026-04-19T02:00:01.000Z", "1h");
  assert.equal(result, true);
});

test("shouldRunScheduleTrigger returns true when time difference equals cooldown", () => {
  const result = shouldRunScheduleTrigger("2026-04-19T01:00:00.000Z", "2026-04-19T02:00:00.000Z", "1h");
  assert.equal(result, true);
});

test("shouldRunScheduleTrigger fires immediately for very short cooldown", () => {
  // 1ms cooldown, 1ms elapsed
  const result = shouldRunScheduleTrigger("2026-04-19T01:00:00.000Z", "2026-04-19T01:00:00.001Z", "1ms");
  assert.equal(result, true);
});

test("shouldRunScheduleTrigger respects exact millisecond boundary", () => {
  // 500ms cooldown, exactly 500ms elapsed
  const result = shouldRunScheduleTrigger("2026-04-19T01:00:00.000Z", "2026-04-19T01:00:00.500Z", "500ms");
  assert.equal(result, true);
});

test("shouldRunScheduleTrigger handles large duration values", () => {
  // 7d cooldown, 1 day elapsed
  const result = shouldRunScheduleTrigger("2026-04-19T01:00:00.000Z", "2026-04-20T01:00:00.000Z", "7d");
  assert.equal(result, false);
});
