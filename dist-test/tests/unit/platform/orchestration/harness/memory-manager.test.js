import test from "node:test";
import assert from "node:assert/strict";
import { HarnessMemoryManager } from "../../../../../src/platform/orchestration/harness/memory-manager.js";
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
    const result = manager.read("shared", "scope-1", "complex-key");
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
    result1.push({});
    assert.equal(manager.list("run", "scope-1").length, 1);
});
//# sourceMappingURL=memory-manager.test.js.map