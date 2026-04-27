import test from "node:test";
import assert from "node:assert/strict";
import { HarnessMemoryManager, type HarnessMemoryNamespace } from "../../../../../src/platform/orchestration/harness/memory-manager.js";

test("HarnessMemoryManager.write stores value", () => {
  const manager = new HarnessMemoryManager();
  manager.write("run", "scope-1", "key-a", "value-1");

  const result = manager.read("run", "scope-1", "key-a");
  assert.equal(result, "value-1");
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

test("HarnessMemoryManager.read returns null for wrong namespace", () => {
  const manager = new HarnessMemoryManager();
  manager.write("run", "scope-1", "key-a", "value-1");
  const result = manager.read("domain", "scope-1", "key-a");
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

test("HarnessMemoryManager.list returns defensive copy", () => {
  const manager = new HarnessMemoryManager();
  manager.write("run", "scope-1", "key-a", "value-a");

  const result1 = manager.list("run", "scope-1");
  const result2 = manager.list("run", "scope-1");

  // Results should be equal but not same reference
  assert.equal(result1.length, result2.length);
  // Modifying returned array shouldn't affect internal state
  (result1 as unknown as Array<unknown>).push({} as unknown);
  assert.equal(manager.list("run", "scope-1").length, 1);
});

test("HarnessMemoryManager.list returns correct record structure", () => {
  const manager = new HarnessMemoryManager();
  manager.write("run", "scope-1", "key-a", "value-a");

  const result = manager.list("run", "scope-1");
  assert.equal(result.length, 1);
  assert.equal(result[0].namespace, "run");
  assert.equal(result[0].scopeId, "scope-1");
  assert.equal(result[0].key, "key-a");
  assert.equal(result[0].value, "value-a");
});

test("HarnessMemoryManager handles multiple scopes in same namespace", () => {
  const manager = new HarnessMemoryManager();
  manager.write("run", "scope-1", "key-a", "value-a");
  manager.write("run", "scope-2", "key-b", "value-b");
  manager.write("run", "scope-3", "key-c", "value-c");

  assert.equal(manager.read("run", "scope-1", "key-a"), "value-a");
  assert.equal(manager.read("run", "scope-2", "key-b"), "value-b");
  assert.equal(manager.read("run", "scope-3", "key-c"), "value-c");
  assert.equal(manager.list("run", "scope-1").length, 1);
  assert.equal(manager.list("run", "scope-2").length, 1);
  assert.equal(manager.list("run", "scope-3").length, 1);
});

test("HarnessMemoryManager handles multiple keys in same scope", () => {
  const manager = new HarnessMemoryManager();
  manager.write("domain", "scope-1", "key-1", "value-1");
  manager.write("domain", "scope-1", "key-2", "value-2");
  manager.write("domain", "scope-1", "key-3", "value-3");

  const result = manager.list("domain", "scope-1");
  assert.equal(result.length, 3);
  assert.equal(manager.read("domain", "scope-1", "key-1"), "value-1");
  assert.equal(manager.read("domain", "scope-1", "key-2"), "value-2");
  assert.equal(manager.read("domain", "scope-1", "key-3"), "value-3");
});

test("HarnessMemoryManager handles null value", () => {
  const manager = new HarnessMemoryManager();
  manager.write("shared", "scope-1", "null-key", null);

  const result = manager.read("shared", "scope-1", "null-key");
  assert.equal(result, null);
});

test("HarnessMemoryManager handles undefined value", () => {
  const manager = new HarnessMemoryManager();
  manager.write("shared", "scope-1", "undefined-key", undefined);

  // When storing undefined, read returns null because undefined value in Map
  // is treated similarly to a missing key due to implementation details
  const result = manager.read("shared", "scope-1", "undefined-key");
  assert.equal(result, null);
});

test("HarnessMemoryManager handles empty string key", () => {
  const manager = new HarnessMemoryManager();
  manager.write("run", "scope-1", "", "empty-key-value");

  const result = manager.read("run", "scope-1", "");
  assert.equal(result, "empty-key-value");
});

test("HarnessMemoryManager handles empty string scopeId", () => {
  const manager = new HarnessMemoryManager();
  manager.write("run", "", "key-a", "value-a");

  const result = manager.read("run", "", "key-a");
  assert.equal(result, "value-a");
  assert.equal(manager.list("run", "").length, 1);
});

test("HarnessMemoryManager handles zero as value", () => {
  const manager = new HarnessMemoryManager();
  manager.write("run", "scope-1", "zero-key", 0);

  const result = manager.read("run", "scope-1", "zero-key");
  assert.equal(result, 0);
});

test("HarnessMemoryManager handles false as value", () => {
  const manager = new HarnessMemoryManager();
  manager.write("run", "scope-1", "false-key", false);

  const result = manager.read("run", "scope-1", "false-key");
  assert.equal(result, false);
});

test("HarnessMemoryManager handles empty object as value", () => {
  const manager = new HarnessMemoryManager();
  manager.write("domain", "scope-1", "obj-key", {});

  const result = manager.read("domain", "scope-1", "obj-key");
  assert.deepEqual(result, {});
});

test("HarnessMemoryManager handles empty array as value", () => {
  const manager = new HarnessMemoryManager();
  manager.write("domain", "scope-1", "array-key", []);

  const result = manager.read("domain", "scope-1", "array-key");
  assert.deepEqual(result, []);
});

test("HarnessMemoryManager handles array with mixed values", () => {
  const manager = new HarnessMemoryManager();
  const arr = [1, "two", true, null, { nested: "object" }];
  manager.write("shared", "scope-1", "mixed-array", arr);

  const result = manager.read("shared", "scope-1", "mixed-array") as typeof arr;
  assert.deepEqual(result, arr);
});

test("HarnessMemoryManager all three namespaces work independently", () => {
  const manager = new HarnessMemoryManager();

  // Write to all namespaces with same scopeId and key
  manager.write("run", "scope-x", "key", "run-value");
  manager.write("domain", "scope-x", "key", "domain-value");
  manager.write("shared", "scope-x", "key", "shared-value");

  // Verify each namespace has its own value
  assert.equal(manager.read("run", "scope-x", "key"), "run-value");
  assert.equal(manager.read("domain", "scope-x", "key"), "domain-value");
  assert.equal(manager.read("shared", "scope-x", "key"), "shared-value");

  // Verify list for each namespace
  const runList = manager.list("run", "scope-x");
  const domainList = manager.list("domain", "scope-x");
  const sharedList = manager.list("shared", "scope-x");

  assert.equal(runList.length, 1);
  assert.equal(domainList.length, 1);
  assert.equal(sharedList.length, 1);

  assert.equal(runList[0].value, "run-value");
  assert.equal(domainList[0].value, "domain-value");
  assert.equal(sharedList[0].value, "shared-value");
});

test("HarnessMemoryManager overwrite updates list result", () => {
  const manager = new HarnessMemoryManager();
  manager.write("run", "scope-1", "key-a", "original");
  manager.write("run", "scope-1", "key-a", "updated");

  const result = manager.read("run", "scope-1", "key-a");
  assert.equal(result, "updated");

  const list = manager.list("run", "scope-1");
  assert.equal(list.length, 1);
  assert.equal(list[0].value, "updated");
});

test("HarnessMemoryManager list returns new array each call", () => {
  const manager = new HarnessMemoryManager();
  manager.write("run", "scope-1", "key-a", "value-a");

  const result1 = manager.list("run", "scope-1");
  const result2 = manager.list("run", "scope-1");

  // Each call returns a different array reference
  assert.notStrictEqual(result1, result2);
  assert.deepStrictEqual(result1, result2);
});

test("HarnessMemoryManager record value property is mutable object", () => {
  const manager = new HarnessMemoryManager();
  const obj = { nested: "original" };
  manager.write("run", "scope-1", "key-a", obj);

  const result = manager.list("run", "scope-1");
  // The record itself is frozen but the value inside can be mutated
  (result[0].value as { nested: string }).nested = "mutated";
  const readResult = manager.read("run", "scope-1", "key-a") as typeof obj;
  assert.equal(readResult.nested, "mutated");
});