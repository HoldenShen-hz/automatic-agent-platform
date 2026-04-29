/**
 * Unit tests for ID Generation and Timestamp Utilities
 *
 * @see src/platform/contracts/types/ids.ts
 */

import assert from "node:assert/strict";
import test from "node:test";
import { newId, nowIso } from "../../../src/platform/contracts/types/ids.js";

// ─────────────────────────────────────────────────────────────────────────────
// newId Tests
// ─────────────────────────────────────────────────────────────────────────────

test("newId generates IDs with correct format", () => {
  const id = newId("task");
  assert.ok(id.startsWith("task_"), `ID should start with "task_", got: ${id}`);
  assert.ok(id.length > 5, "ID should have meaningful length");
});

test("newId generates unique IDs on each call", () => {
  const id1 = newId("exec");
  const id2 = newId("exec");
  assert.notStrictEqual(id1, id2, "Each call should generate a unique ID");
});

test("newId works with various prefixes", () => {
  const prefixes = ["task", "exec", "sess", "evt", "user", "tenant", "plan", "node"];

  for (const prefix of prefixes) {
    const id = newId(prefix);
    assert.ok(id.startsWith(`${prefix}_`), `ID should start with "${prefix}_", got: ${id}`);
  }
});

test("newId generates UUID-compliant suffixes", () => {
  const id = newId("test");
  const uuidPart = id.substring(id.indexOf("_") + 1);

  // UUID format: 8-4-4-4-12 hex characters
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  assert.ok(uuidRegex.test(uuidPart), `UUID part should match UUID format, got: ${uuidPart}`);
});

test("newId handles empty string prefix", () => {
  const id = newId("");
  assert.ok(id.startsWith("_"), "ID should still have underscore even with empty prefix");
  const uuidPart = id.substring(1);
  assert.ok(uuidPart.length > 0, "UUID part should still exist");
});

test("newId handles special characters in prefix", () => {
  const id = newId("task-type_a");
  assert.ok(id.startsWith("task-type_a_"), "ID should preserve special characters in prefix");
});

// ─────────────────────────────────────────────────────────────────────────────
// nowIso Tests
// ─────────────────────────────────────────────────────────────────────────────

test("nowIso returns ISO 8601 formatted timestamp", () => {
  const timestamp = nowIso();

  // ISO 8601 format: 2026-04-29T12:00:00.000Z
  const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
  assert.ok(isoRegex.test(timestamp), `Timestamp should match ISO 8601 format, got: ${timestamp}`);
});

test("nowIso returns a valid date string", () => {
  const timestamp = nowIso();
  const date = new Date(timestamp);

  assert.ok(!isNaN(date.getTime()), "Timestamp should be parseable to a valid Date");
});

test("nowIso returns current time (within acceptable drift)", () => {
  const before = Date.now();
  const timestamp = nowIso();
  const after = Date.now();

  const parsedTime = new Date(timestamp).getTime();

  assert.ok(parsedTime >= before, "Timestamp should not be before the call time");
  assert.ok(parsedTime <= after + 1000, "Timestamp should not be significantly after the call time");
});

test("nowIso timestamps are chronologically ordered", () => {
  const ts1 = nowIso();
  // Small delay to ensure time progresses
  const ts2 = nowIso();

  assert.ok(ts2 >= ts1, "Later call to nowIso should return greater or equal timestamp");
});

test("nowIso can be parsed by Date constructor", () => {
  const timestamp = nowIso();

  // Should not throw
  const date = new Date(timestamp);
  assert.ok(date instanceof Date, "Should create valid Date instance");
});

// ─────────────────────────────────────────────────────────────────────────────
// Integration of newId and nowIso
// ─────────────────────────────────────────────────────────────────────────────

test("newId and nowIso can be used together for record creation", () => {
  const record = {
    id: newId("rec"),
    createdAt: nowIso(),
    type: "test",
  };

  assert.ok(record.id.startsWith("rec_"));
  assert.ok(new Date(record.createdAt).getTime() > 0);
});
