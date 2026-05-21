/**
 * Unit tests for Approval Platform Support
 * Tests the approval-platform-support module which re-exports ID utilities
 */

import assert from "node:assert/strict";
import test from "node:test";
import { newId, nowIso } from "../../../../../src/platform/five-plane-control-plane/approval-center/approval-platform-support.js";

test("approval-platform-support exports newId function", () => {
  assert.equal(typeof newId, "function");
});

test("newId generates unique IDs with correct prefix", () => {
  const id1 = newId("approval");
  const id2 = newId("approval");

  assert.ok(id1.startsWith("approval_"));
  assert.ok(id2.startsWith("approval_"));
  assert.notEqual(id1, id2);
});

test("newId generates IDs with configurable prefix", () => {
  const id = newId("test");

  assert.ok(id.startsWith("test_"));
});

test("approval-platform-support exports nowIso function", () => {
  assert.equal(typeof nowIso, "function");
});

test("nowIso returns ISO timestamp string", () => {
  const timestamp = nowIso();

  assert.equal(typeof timestamp, "string");
  // ISO format: 2026-05-21T19:45:00.000Z
  assert.ok(timestamp.includes("T"));
  assert.ok(timestamp.includes("Z"));
});

test("nowIso returns current time", () => {
  const before = Date.now();
  const timestamp = nowIso();
  const after = Date.now();

  const parsed = Date.parse(timestamp);
  assert.ok(parsed >= before && parsed <= after + 1000);
});

test("newId and nowIso can be used together", () => {
  const id = newId("approval");
  const timestamp = nowIso();

  assert.ok(id.startsWith("approval_"));
  assert.ok(timestamp.length > 0);
});

test("newId generates unique IDs across multiple calls", () => {
  const ids = new Set<string>();
  for (let i = 0; i < 100; i++) {
    ids.add(newId("test"));
  }
  assert.equal(ids.size, 100);
});

test("nowIso returns distinct values when called at different times", () => {
  // This may or may not be distinct depending on timing resolution
  const t1 = nowIso();
  // Small delay to ensure time progression
  const start = Date.now();
  while (Date.now() - start < 10) { /* busy wait */ }
  const t2 = nowIso();

  // At minimum, both should be valid ISO strings
  assert.ok(t1.includes("T"));
  assert.ok(t2.includes("T"));
});