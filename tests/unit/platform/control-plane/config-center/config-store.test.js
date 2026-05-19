/**
 * Unit tests for ConfigStore
 */
import assert from "node:assert/strict";
import test from "node:test";
import { ConfigStore } from "../../../../../src/platform/control-plane/config-center/config-store.js";
test("ConfigStore.set and get basic operations", () => {
    const store = new ConfigStore();
    store.set("key1", "value1");
    store.set("key2", 42);
    assert.equal(store.get("key1"), "value1");
    assert.equal(store.get("key2"), 42);
});
test("ConfigStore.get with non-existent key returns undefined", () => {
    const store = new ConfigStore();
    assert.equal(store.get("nonexistent"), undefined);
});
test("ConfigStore.getRequired throws for missing key", () => {
    const store = new ConfigStore();
    assert.throws(() => store.getRequired("missing"), { code: /config_key_not_found:missing/ });
});
test("ConfigStore.getRequired returns value when key exists", () => {
    const store = new ConfigStore();
    store.set("existing", "value");
    assert.equal(store.getRequired("existing"), "value");
});
test("ConfigStore.has detects existing keys", () => {
    const store = new ConfigStore();
    store.set("present", "value");
    assert.ok(store.has("present"));
    assert.ok(!store.has("absent"));
});
test("ConfigStore.delete removes entries", () => {
    const store = new ConfigStore();
    store.set("todelete", "value");
    assert.ok(store.has("todelete"));
    store.delete("todelete");
    assert.ok(!store.has("todelete"));
});
test("ConfigStore.delete returns true for existing key, false otherwise", () => {
    const store = new ConfigStore();
    store.set("todelete", "value");
    assert.equal(store.delete("todelete"), true);
    assert.equal(store.delete("nonexistent"), false);
});
test("ConfigStore.toObject returns all entries", () => {
    const store = new ConfigStore();
    store.set("a", 1);
    store.set("b", 2);
    const obj = store.toObject();
    assert.deepEqual(obj, { a: 1, b: 2 });
});
test("ConfigStore.snapshot captures current state", () => {
    const store = new ConfigStore({ initialEntries: { x: 1 } });
    store.set("y", 2);
    store.set("z", 3);
    const snapshot = store.snapshot();
    assert.equal(snapshot.entries["x"]?.value, 1);
    assert.equal(snapshot.entries["y"]?.value, 2);
    assert.equal(snapshot.entries["z"]?.value, 3);
    assert.ok(snapshot.version > 0);
    assert.ok(snapshot.createdAt.length > 0);
});
test("ConfigStore.restore restores from snapshot", () => {
    const store = new ConfigStore();
    store.set("a", 1);
    const snapshot = store.snapshot();
    store.set("b", 2);
    store.restore(snapshot);
    assert.equal(store.get("a"), 1);
    assert.ok(!store.has("b"));
});
test("ConfigStore.restore throws on invalid snapshot", () => {
    const store = new ConfigStore();
    assert.throws(() => store.restore({ entries: {}, version: 0, createdAt: "" }), { code: /invalid_snapshot/ });
});
test("ConfigStore.merge adds multiple entries", () => {
    const store = new ConfigStore();
    store.set("existing", "old");
    store.merge({
        existing: "updated",
        new1: "value1",
        new2: "value2",
    });
    assert.equal(store.get("existing"), "updated");
    assert.equal(store.get("new1"), "value1");
    assert.equal(store.get("new2"), "value2");
});
test("ConfigStore.clear removes all entries", () => {
    const store = new ConfigStore();
    store.set("a", 1);
    store.set("b", 2);
    store.set("c", 3);
    store.clear();
    assert.ok(!store.has("a"));
    assert.ok(!store.has("b"));
    assert.ok(!store.has("c"));
});
test("ConfigStore.getVersion increments on changes", () => {
    const store = new ConfigStore();
    const initialVersion = store.getVersion();
    store.set("key", "value");
    assert.equal(store.getVersion(), initialVersion + 1);
    store.delete("key");
    assert.equal(store.getVersion(), initialVersion + 2);
    store.clear();
    assert.equal(store.getVersion(), initialVersion + 3);
});
test("ConfigStore.onChange notifies listeners on value change", () => {
    const store = new ConfigStore();
    let callCount = 0;
    let receivedKey = "";
    let receivedOldValue;
    let receivedNewValue;
    store.onChange((key, oldValue, newValue) => {
        callCount++;
        receivedKey = key;
        receivedOldValue = oldValue;
        receivedNewValue = newValue;
    });
    store.set("key", "new");
    assert.equal(callCount, 1);
    assert.equal(receivedKey, "key");
    assert.equal(receivedOldValue, undefined);
    assert.equal(receivedNewValue, "new");
    // Setting same value should not trigger change
    store.set("key", "new");
    assert.equal(callCount, 1);
    // Changing value should trigger change
    store.set("key", "updated");
    assert.equal(callCount, 2);
    assert.equal(receivedOldValue, "new");
    assert.equal(receivedNewValue, "updated");
});
test("ConfigStore.offChange removes listener", () => {
    const store = new ConfigStore();
    let callCount = 0;
    const listener = () => callCount++;
    store.onChange(listener);
    store.set("key", "value1");
    assert.equal(callCount, 1);
    store.offChange(listener);
    store.set("key", "value2");
    assert.equal(callCount, 1); // Should not have incremented
});
test("ConfigStore constructor with initialEntries", () => {
    const store = new ConfigStore({
        initialEntries: { a: 1, b: "hello" },
        source: "test",
    });
    assert.equal(store.get("a"), 1);
    assert.equal(store.get("b"), "hello");
    assert.ok(store.has("a"));
    assert.ok(store.has("b"));
});
test("ConfigStore version increments correctly for multiple operations", () => {
    const store = new ConfigStore();
    const versions = [store.getVersion()];
    store.set("a", 1);
    versions.push(store.getVersion());
    store.set("b", 2);
    versions.push(store.getVersion());
    store.delete("a");
    versions.push(store.getVersion());
    store.merge({ c: 3 });
    versions.push(store.getVersion());
    // Verify each version is strictly increasing
    for (let i = 1; i < versions.length; i++) {
        assert.ok(versions[i] > versions[i - 1], `Version ${versions[i]} should be > ${versions[i - 1]}`);
    }
});
test("ConfigStore stores different value types correctly", () => {
    const store = new ConfigStore();
    store.set("string", "value");
    store.set("number", 42);
    store.set("boolean", true);
    store.set("object", { nested: { key: "value" } });
    store.set("array", [1, 2, 3]);
    store.set("null", null);
    store.set("undefined", undefined);
    assert.equal(store.get("string"), "value");
    assert.equal(store.get("number"), 42);
    assert.equal(store.get("boolean"), true);
    assert.deepEqual(store.get("object"), { nested: { key: "value" } });
    assert.deepEqual(store.get("array"), [1, 2, 3]);
    assert.equal(store.get("null"), null);
    assert.equal(store.get("undefined"), undefined);
});
//# sourceMappingURL=config-store.test.js.map