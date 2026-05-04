/**
 * Unit tests for CasService - Issue #2024
 *
 * Tests that verify CAS (Compare-And-Swap) operations are atomic.
 * Issue #2024: CAS pure in-memory Map, read-check-write non-atomic
 *
 * The bug is that in a multi-process distributed environment, the in-memory Map
 * approach does not provide true atomicity. However, within a single process,
 * JavaScript's single-threaded nature provides natural atomicity for simple operations.
 *
 * These tests verify:
 * - CAS operations succeed when expected value matches
 * - CAS operations fail when expected value does not match
 * - Version numbers are properly incremented
 * - Concurrent-style operations maintain consistency
 */

import assert from "node:assert/strict";
import test from "node:test";

import { CasService } from "../../../../../../src/platform/state-evidence/events/cas/cas-service.js";

test("CasService compareAndSwap succeeds when expected value matches", () => {
  const service = new CasService();

  // Initialize a key
  service.setValue("key1", "initialValue");
  assert.equal(service.getValue("key1"), "initialValue");
  assert.equal(service.getVersion("key1"), 1);

  // CAS succeeds when expected matches current
  const result = service.compareAndSwap("key1", "initialValue", "newValue");
  assert.equal(result.success, true, "CAS should succeed when expected matches");
  assert.equal(result.currentValue, "newValue");
  assert.equal(result.currentVersion, 2);

  // Verify current state
  assert.equal(service.getValue("key1"), "newValue");
  assert.equal(service.getVersion("key1"), 2);
});

test("CasService compareAndSwap fails when expected value does not match", () => {
  const service = new CasService();

  service.setValue("key1", "currentValue");

  // CAS fails when expected doesn't match current value
  const result = service.compareAndSwap("key1", "wrongExpected", "newValue");
  assert.equal(result.success, false, "CAS should fail when expected doesn't match");
  assert.equal(result.currentValue, "currentValue");
  assert.equal(result.currentVersion, 1);

  // Verify state unchanged
  assert.equal(service.getValue("key1"), "currentValue");
  assert.equal(service.getVersion("key1"), 1);
});

test("CasService compareAndSwap for new key with empty expected value", () => {
  const service = new CasService();

  // New key with empty expected should succeed (key doesn't exist)
  const result = service.compareAndSwap("newKey", "", "firstValue");
  assert.equal(result.success, true, "CAS should succeed for new key with empty expected");
  assert.equal(result.currentValue, "firstValue");
  assert.equal(result.currentVersion, 1);
});

test("CasService compareAndSwap for new key with non-empty expected fails", () => {
  const service = new CasService();

  // New key with non-empty expected should fail (key doesn't exist but expected is not empty/null)
  const result = service.compareAndSwap("newKey", "something", "value");
  assert.equal(result.success, false, "CAS should fail for new key with non-empty expected");
  assert.equal(result.currentValue, undefined);
});

test("CasService compareAndSet version-based CAS succeeds when version matches", () => {
  const service = new CasService();

  service.setValue("key1", "v1");
  assert.equal(service.getVersion("key1"), 1);

  // CAS succeeds when version matches
  const result = service.compareAndSet("key1", 1, "v2");
  assert.equal(result.success, true);
  assert.equal(result.currentValue, "v2");
  assert.equal(result.currentVersion, 2);
});

test("CasService compareAndSet version-based CAS fails when version does not match", () => {
  const service = new CasService();

  service.setValue("key1", "v1");

  // CAS fails when version doesn't match
  const result = service.compareAndSet("key1", 5, "v2");
  assert.equal(result.success, false);
  assert.equal(result.currentValue, "v1");
  assert.equal(result.currentVersion, 1);
});

test("CasService compareAndSet for new key with version 0 succeeds", () => {
  const service = new CasService();

  // New key with expectedVersion 0 should succeed
  const result = service.compareAndSet("newKey", 0, "firstValue");
  assert.equal(result.success, true);
  assert.equal(result.currentValue, "firstValue");
  assert.equal(result.currentVersion, 1);
});

test("CasService compareAndSet for new key with non-zero version fails", () => {
  const service = new CasService();

  // New key with expectedVersion != 0 should fail
  const result = service.compareAndSet("newKey", 1, "value");
  assert.equal(result.success, false);
});

test("CasService sequential CAS operations maintain consistency", () => {
  const service = new CasService();
  service.setValue("counter", "0");

  // Simulate increment via CAS
  for (let i = 1; i <= 5; i++) {
    const current = service.getValue("counter")!;
    const result = service.compareAndSwap("counter", current, String(i));
    assert.equal(result.success, true, `CAS ${i} should succeed`);
    assert.equal(service.getValue("counter"), String(i));
    assert.equal(service.getVersion("counter"), i + 1);
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
  assert.equal(r1.currentVersion, 2);

  // Second writer tries with stale expected - should fail
  const r2 = service.compareAndSwap("shared", "initial", "writer2");
  assert.equal(r2.success, false);
  assert.equal(r2.currentValue, "writer1");
  assert.equal(r2.currentVersion, 2);
});

test("CasService multiple keys operate independently", () => {
  const service = new CasService();

  service.setValue("key1", "value1");
  service.setValue("key2", "value2");

  // CAS on key1 should not affect key2
  const result = service.compareAndSwap("key1", "value1", "newValue1");
  assert.equal(result.success, true);
  assert.equal(service.getValue("key1"), "newValue1");
  assert.equal(service.getValue("key2"), "value2");
});

test("CasService delete removes key", () => {
  const service = new CasService();

  service.setValue("key1", "value1");
  assert.equal(service.has("key1"), true);

  const deleted = service.delete("key1");
  assert.equal(deleted, true);
  assert.equal(service.has("key1"), false);
  assert.equal(service.getValue("key1"), undefined);
});

test("CasService delete returns false for nonexistent key", () => {
  const service = new CasService();

  const deleted = service.delete("nonexistent");
  assert.equal(deleted, false);
});

test("CasService has returns true for existing key", () => {
  const service = new CasService();

  service.setValue("key1", "value1");
  assert.equal(service.has("key1"), true);
});

test("CasService has returns false for nonexistent key", () => {
  const service = new CasService();

  assert.equal(service.has("nonexistent"), false);
});

test("CasService getValue returns undefined for nonexistent key", () => {
  const service = new CasService();

  assert.equal(service.getValue("nonexistent"), undefined);
});

test("CasService getVersion returns undefined for nonexistent key", () => {
  const service = new CasService();

  assert.equal(service.getVersion("nonexistent"), undefined);
});

test("CasService setValue overwrites existing value and increments version", () => {
  const service = new CasService();

  service.setValue("key1", "value1");
  service.setValue("key1", "value2");

  assert.equal(service.getValue("key1"), "value2");
  assert.equal(service.getVersion("key1"), 2);
});

test("CasService compareAndSwap handles empty string as expected value", () => {
  const service = new CasService();

  // Set empty string value
  service.setValue("key1", "");

  // CAS with empty string expected should succeed
  const result = service.compareAndSwap("key1", "", "newValue");
  assert.equal(result.success, true);
  assert.equal(service.getValue("key1"), "newValue");
});

test("CasService compareAndSwap handles null as expected value", () => {
  const service = new CasService();

  // New key - null expected should succeed (key doesn't exist)
  const result = service.compareAndSwap("newKey", null as unknown as string, "value");
  assert.equal(result.success, true);
});

test("CasService compareAndSwap handles undefined as expected value", () => {
  const service = new CasService();

  // New key - undefined expected should succeed (key doesn't exist)
  const result = service.compareAndSwap("newKey", undefined as unknown as string, "value");
  assert.equal(result.success, true);
});
