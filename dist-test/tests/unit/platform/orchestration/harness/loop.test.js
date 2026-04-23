import test from "node:test";
import assert from "node:assert/strict";
import { HarnessMemoryManager } from "../../../../../src/platform/orchestration/harness/memory-manager.js";
test("HarnessMemoryManager is exported and can be instantiated", () => {
    const manager = new HarnessMemoryManager();
    assert.ok(manager !== undefined);
    assert.equal(typeof manager.write, "function");
    assert.equal(typeof manager.read, "function");
});
test("HarnessMemoryManager.write and read roundtrip", () => {
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
test("HarnessMemoryManager.list returns all records in scope", () => {
    const manager = new HarnessMemoryManager();
    manager.write("run", "scope-1", "key-a", "value-a");
    manager.write("run", "scope-1", "key-b", "value-b");
    const result = manager.list("run", "scope-1");
    assert.equal(result.length, 2);
});
test("HarnessMemoryManager.namespaces are isolated", () => {
    const manager = new HarnessMemoryManager();
    manager.write("run", "scope-1", "key-a", "run-value");
    manager.write("domain", "scope-1", "key-a", "domain-value");
    manager.write("shared", "scope-1", "key-a", "shared-value");
    assert.equal(manager.read("run", "scope-1", "key-a"), "run-value");
    assert.equal(manager.read("domain", "scope-1", "key-a"), "domain-value");
    assert.equal(manager.read("shared", "scope-1", "key-a"), "shared-value");
});
//# sourceMappingURL=loop.test.js.map