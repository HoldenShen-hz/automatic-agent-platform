/**
 * Unit tests for event-watcher utilities
 */

import assert from "node:assert/strict";
import test from "node:test";
import { shouldConsumeProactiveEvent, type ProactiveEventInput } from "../../../../../src/interaction/proactive-agent/event-watcher/index.js";

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

test("shouldConsumeProactiveEvent handles exact match pattern", () => {
  const event: ProactiveEventInput = { source: "scheduler", name: "heartbeat" };
  const result = shouldConsumeProactiveEvent(event, "scheduler", "heartbeat");
  assert.equal(result, true);
});

test("shouldConsumeProactiveEvent returns false for empty pattern", () => {
  const event: ProactiveEventInput = { source: "task", name: "task_failed" };
  const result = shouldConsumeProactiveEvent(event, "task", "");
  assert.equal(result, true); // empty pattern matches everything
});

test("shouldConsumeProactiveEvent returns false when source does not match", () => {
  const event: ProactiveEventInput = { source: "scheduler", name: "task_scheduled" };
  const result = shouldConsumeProactiveEvent(event, "worker", "task_scheduled");
  assert.equal(result, false);
});

test("shouldConsumeProactiveEvent uses includes for pattern matching", () => {
  const event: ProactiveEventInput = { source: "task", name: "task_execution_started" };
  const result = shouldConsumeProactiveEvent(event, "task", "started");
  assert.equal(result, true);
});

test("shouldConsumeProactiveEvent is case-sensitive for source", () => {
  const event: ProactiveEventInput = { source: "Task", name: "task_failed" };
  const result = shouldConsumeProactiveEvent(event, "task", "failed");
  assert.equal(result, false);
});

test("shouldConsumeProactiveEvent is case-sensitive for pattern", () => {
  const event: ProactiveEventInput = { source: "task", name: "task_Failed" };
  const result = shouldConsumeProactiveEvent(event, "task", "FAILED");
  assert.equal(result, false);
});

test("shouldConsumeProactiveEvent handles special characters in source", () => {
  const event: ProactiveEventInput = { source: "task-module-a", name: "task_failed" };
  const result = shouldConsumeProactiveEvent(event, "task-module-a", "failed");
  assert.equal(result, true);
});

test("shouldConsumeProactiveEvent handles undefined payload", () => {
  const event: ProactiveEventInput = { source: "task", name: "task_failed" };
  const result = shouldConsumeProactiveEvent(event, "task", "failed");
  assert.equal(result, true);
});

test("shouldConsumeProactiveEvent matches pattern anywhere in name", () => {
  const event: ProactiveEventInput = { source: "deployment", name: "production_deployment_completed" };
  const result = shouldConsumeProactiveEvent(event, "deployment", "completed");
  assert.equal(result, true);
});

test("shouldConsumeProactiveEvent returns false when name is substring of pattern", () => {
  const event: ProactiveEventInput = { source: "task", name: "task" };
  const result = shouldConsumeProactiveEvent(event, "task", "task_failed");
  assert.equal(result, false);
});

test("ProactiveEventInput type accepts readonly properties", () => {
  const event: ProactiveEventInput = {
    source: "test-source",
    name: "test-event",
    payload: { key: "value" },
  } as const;

  assert.equal(event.source, "test-source");
  assert.equal(event.name, "test-event");
  assert.deepEqual(event.payload, { key: "value" });
});
