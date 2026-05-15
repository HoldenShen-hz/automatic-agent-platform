import test from "node:test";
import assert from "node:assert/strict";
import { HarnessMemoryManager, type HarnessMemoryNamespace } from "../../../../../src/platform/five-plane-orchestration/harness/memory-manager.js";

test("HarnessMemoryNamespace type exists", () => {
  const ns: HarnessMemoryNamespace = "run";
  assert.equal(ns, "run");
});

test("HarnessMemoryManager.write stores value in run namespace", () => {
  const manager = new HarnessMemoryManager();
  manager.write("run", "scope-1", "key-a", "value-1");

  const result = manager.read("run", "scope-1", "key-a");
  assert.equal(result, "value-1");
});

test("HarnessMemoryManager.write stores value in domain namespace", () => {
  const manager = new HarnessMemoryManager();
  manager.write("domain", "scope-1", "key-b", "domain-value");

  const result = manager.read("domain", "scope-1", "key-b");
  assert.equal(result, "domain-value");
});

test("HarnessMemoryManager.write stores value in shared namespace", () => {
  const manager = new HarnessMemoryManager();
  manager.write("shared", "scope-1", "key-c", "shared-value");

  const result = manager.read("shared", "scope-1", "key-c");
  assert.equal(result, "shared-value");
});

test("HarnessMemoryManager.read returns null for missing key", () => {
  const manager = new HarnessMemoryManager();
  const result = manager.read("run", "scope-1", "nonexistent");
  assert.equal(result, null);
});

test("HarnessMemoryManager.read returns null for missing scopeId", () => {
  const manager = new HarnessMemoryManager();
  const result = manager.read("run", "unknown-scope", "key-a");
  assert.equal(result, null);
});

test("HarnessMemoryManager.list returns all records in scope", () => {
  const manager = new HarnessMemoryManager();
  manager.write("run", "scope-1", "key-a", "value-a");
  manager.write("run", "scope-1", "key-b", "value-b");

  const result = manager.list("run", "scope-1");
  assert.equal(result.length, 2);
});

test("HarnessMemoryManager.list returns empty for missing scope", () => {
  const manager = new HarnessMemoryManager();
  const result = manager.list("run", "unknown-scope");
  assert.deepEqual(result, []);
});

test("HarnessMemoryManager.write overwrites existing value", () => {
  const manager = new HarnessMemoryManager();
  manager.write("run", "scope-1", "key-a", "value-1");
  manager.write("run", "scope-1", "key-a", "value-2");

  const result = manager.read("run", "scope-1", "key-a");
  assert.equal(result, "value-2");
});

test("HarnessMemoryManager handles complex values", () => {
  const manager = new HarnessMemoryManager();
  const complex = { nested: { deep: [1, 2, 3] }, bool: true };
  manager.write("shared", "scope-1", "complex-key", complex);

  const result = manager.read("shared", "scope-1", "complex-key") as typeof complex;
  assert.deepEqual(result, complex);
});

test("HarnessMemoryManager namespaces are isolated", () => {
  const manager = new HarnessMemoryManager();
  manager.write("run", "scope-1", "key-a", "run-value");
  manager.write("domain", "scope-1", "key-a", "domain-value");
  manager.write("shared", "scope-1", "key-a", "shared-value");

  assert.equal(manager.read("run", "scope-1", "key-a"), "run-value");
  assert.equal(manager.read("domain", "scope-1", "key-a"), "domain-value");
  assert.equal(manager.read("shared", "scope-1", "key-a"), "shared-value");
});
