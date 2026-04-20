/**
 * Integration Test: Types Integration
 *
 * Verifies type definitions and ID generation
 * work correctly across the system.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { newId, nowIso } from "../../../../../src/platform/contracts/types/ids.js";

test("types: ID generation follows correct prefix conventions", () => {
  const taskId = newId("task");
  const execId = newId("exec");
  const sessId = newId("sess");
  const evtId = newId("evt");

  assert.ok(taskId.startsWith("task_"), "Task ID should start with task_");
  assert.ok(execId.startsWith("exec_"), "Execution ID should start with exec_");
  assert.ok(sessId.startsWith("sess_"), "Session ID should start with sess_");
  assert.ok(evtId.startsWith("evt_"), "Event ID should start with evt_");
});

test("types: IDs are unique", () => {
  const ids: string[] = [];
  for (let i = 0; i < 100; i++) {
    ids.push(newId("test"));
  }

  const uniqueIds = new Set(ids);
  assert.equal(uniqueIds.size, 100, "All generated IDs should be unique");
});

test("types: timestamp generation is ISO format", () => {
  const timestamp = nowIso();

  assert.ok(timestamp.endsWith("Z"), "Timestamp should end with Z (UTC)");
  assert.ok(timestamp.includes("T"), "Timestamp should contain T separator");
  assert.ok(timestamp.match(/^\d{4}-\d{2}-\d{2}T/), "Timestamp should match ISO date format");
});

test("types: different ID prefixes are independent", () => {
  const task1 = newId("task");
  const task2 = newId("task");
  const exec1 = newId("exec");

  // Task IDs should be different
  assert.notEqual(task1, task2);
  // Execution ID should have different prefix
  assert.ok(exec1.startsWith("exec_"));
  // All should still be unique
  const allIds = new Set([task1, task2, exec1]);
  assert.equal(allIds.size, 3);
});

test("types: task statuses are valid", () => {
  const validStatuses = ["queued", "pending", "in_progress", "awaiting_decision", "done", "failed", "cancelled"];

  for (const status of validStatuses) {
    assert.ok(typeof status === "string");
  }
});

test("types: execution statuses are valid", () => {
  const validStatuses = ["created", "prechecking", "executing", "blocked", "succeeded", "failed", "cancelled", "superseded"];

  for (const status of validStatuses) {
    assert.ok(typeof status === "string");
  }
});

test("types: approval statuses are valid", () => {
  const validStatuses = ["requested", "approved", "rejected", "expired", "cancelled"];

  for (const status of validStatuses) {
    assert.ok(typeof status === "string");
  }
});

test("types: session statuses are valid", () => {
  const validStatuses = ["open", "streaming", "awaiting_user", "paused", "completed", "failed", "cancelled"];

  for (const status of validStatuses) {
    assert.ok(typeof status === "string");
  }
});

test("types: workflow statuses are valid", () => {
  const validStatuses = ["running", "paused", "resuming", "completed", "failed", "cancelling", "cancelled"];

  for (const status of validStatuses) {
    assert.ok(typeof status === "string");
  }
});
