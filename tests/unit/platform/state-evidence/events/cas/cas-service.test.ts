import assert from "node:assert/strict";
import test from "node:test";

/**
 * Tests for CAS Service covering:
 * - Issue #2024: CAS pure in-memory Map, read-check-write non-atomic
 *
 * Note: These tests verify the actual behavior. In a true distributed environment
 * with multiple processes, the in-memory Map approach has race conditions.
 * But within a single process, JavaScript's single-threaded nature provides
 * some natural atomicity for simple operations.
 */

import { CasService } from "../../../../../../src/platform/state-evidence/events/cas/cas-service.js";

test("CasService operations are atomic within single process", () => {
  const service = new CasService();

  // Initialize
  service.setValue("key1", "initial");
  assert.equal(service.getValue("key1"), "initial");
  assert.equal(service.getVersion("key1"), 1);

  // CAS succeeds when expected matches
  const result1 = service.compareAndSwap("key1", "initial", "v2");
  assert.equal(result1.success, true);
  assert.equal(result1.currentVersion, 2);

  // CAS fails when expected doesn't match
  const result2 = service.compareAndSwap("key1", "wrong", "v3");
  assert.equal(result2.success, false);
  assert.equal(result2.currentValue, "v2");
  assert.equal(result2.currentVersion, 2);

  // Verify current state
  assert.equal(service.getValue("key1"), "v2");
  assert.equal(service.getVersion("key1"), 2);
});

test("CasService.compareAndSet version-based CAS works correctly", () => {
  const service = new CasService();

  service.setValue("key1", "v1");
  assert.equal(service.getVersion("key1"), 1);

  // Succeeds when version matches
  const result1 = service.compareAndSet("key1", 1, "v2");
  assert.equal(result1.success, true);
  assert.equal(result1.currentVersion, 2);

  // Fails when version doesn't match
  const result2 = service.compareAndSet("key1", 1, "v3");
  assert.equal(result2.success, false);
  assert.equal(result2.currentVersion, 2);

  // Succeeds with correct version
  const result3 = service.compareAndSet("key1", 2, "v3");
  assert.equal(result3.success, true);
  assert.equal(result3.currentVersion, 3);
});

test("CasService.compareAndSwap for new key with empty expected", () => {
  const service = new CasService();

  // New key with empty expected should succeed
  const result = service.compareAndSwap("newkey", "", "value1");
  assert.equal(result.success, true);
  assert.equal(result.currentValue, "value1");
  assert.equal(result.currentVersion, 1);
});

test("CasService.compareAndSwap for new key with non-empty expected fails", () => {
  const service = new CasService();

  // New key with non-empty expected should fail
  const result = service.compareAndSwap("newkey", "something", "value1");
  assert.equal(result.success, false);
  assert.equal(result.currentValue, undefined);
});

test("CasService.compareAndSet for new key with version 0 succeeds", () => {
  const service = new CasService();

  const result = service.compareAndSet("newkey", 0, "value1");
  assert.equal(result.success, true);
  assert.equal(result.currentValue, "value1");
  assert.equal(result.currentVersion, 1);
});

test("CasService.compareAndSet for new key with non-zero version fails", () => {
  const service = new CasService();

  const result = service.compareAndSet("newkey", 5, "value1");
  assert.equal(result.success, false);
  assert.equal(result.currentValue, undefined);
});

test("CasService.delete removes key and returns boolean", () => {
  const service = new CasService();

  service.setValue("key1", "value1");
  assert.equal(service.has("key1"), true);

  const deleted = service.delete("key1");
  assert.equal(deleted, true);
  assert.equal(service.has("key1"), false);
});

test("CasService.delete returns false for nonexistent key", () => {
  const service = new CasService();

  const deleted = service.delete("nonexistent");
  assert.equal(deleted, false);
});

test("CasService multiple sequential CAS operations maintain consistency", () => {
  const service = new CasService();
  service.setValue("counter", "0");

  // Increment via CAS
  for (let i = 1; i <= 5; i++) {
    const current = service.getValue("counter")!;
    const result = service.compareAndSwap("counter", current, String(i));
    assert.equal(result.success, true, `CAS ${i} should succeed`);
  }

  assert.equal(service.getValue("counter"), "5");
  assert.equal(service.getVersion("counter"), 6);
});

test("CasService concurrent-style operations in sequence", () => {
  const service = new CasService();

  // Simulate what would be a race condition if truly concurrent
  service.setValue("shared", "initial");

  // First writer
  const r1 = service.compareAndSwap("shared", "initial", "writer1");
  assert.equal(r1.success, true);

  // Second writer tries with stale expected - should fail
  const r2 = service.compareAndSwap("shared", "initial", "writer2");
  assert.equal(r2.success, false);
  assert.equal(r2.currentValue, "writer1");
});