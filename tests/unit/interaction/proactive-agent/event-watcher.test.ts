/**
 * Unit tests for event-watcher utilities
 */

import assert from "node:assert/strict";
import test from "node:test";
import { shouldConsumeProactiveEvent, type ProactiveEventInput } from "../../../../src/interaction/proactive-agent/event-watcher/index.js";

test("shouldConsumeProactiveEvent returns true for matching source and pattern", () => {
  const event: ProactiveEventInput = { source: "task", name: "task_failed" };
  const result = shouldConsumeProactiveEvent(event, "task", "failed");
  assert.equal(result, true);
});

test("shouldConsumeProactiveEvent returns false for non-matching source", () => {
  const event: ProactiveEventInput = { source: "worker", name: "task_failed" };
  const result = shouldConsumeProactiveEvent(event, "task", "failed");
  assert.equal(result, false);
});

test("shouldConsumeProactiveEvent returns false when pattern not found in name", () => {
  const event: ProactiveEventInput = { source: "task", name: "task_completed" };
  const result = shouldConsumeProactiveEvent(event, "task", "failed");
  assert.equal(result, false);
});

test("shouldConsumeProactiveEvent handles payload if provided", () => {
  const event: ProactiveEventInput = { source: "task", name: "task_failed", payload: { severity: "high" } };
  const result = shouldConsumeProactiveEvent(event, "task", "failed");
  assert.equal(result, true);
});
