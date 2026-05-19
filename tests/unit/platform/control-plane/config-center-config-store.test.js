import assert from "node:assert/strict";
import test from "node:test";

import {
  ConfigStore,
} from "../../../../../../src/platform/control-plane/config-center/config-store.js";

test("config-store set and get basic values", () => {
  const store = new ConfigStore();
  store.set("key1", "value1");
  assert.equal(store.get("key1"), "value1");
});

test("config-store get returns undefined for missing key", () => {
  const store = new ConfigStore();
  assert.equal(store.get("nonexistent"), undefined);
});

test("config-store getRequired throws for missing key", () => {
  const store = new ConfigStore();
  assert.throws(
    () => store.getRequired("nonexistent"),
    Error,
    "ValidationError",
  );
});

test("config-store has returns correct boolean", () => {
  const store = new ConfigStore();
  store.set("key1", "value1");
  assert.equal(store.has("key1"), true);
  assert.equal(store.has("nonexistent"), false);
});

test("config-store delete removes entry", () => {
  const store = new ConfigStore();
  store.set("key1", "value1");
  assert.equal(store.delete("key1"), true);
  assert.equal(store.has("key1"), false);
});

test("config-store delete returns false for missing key", () => {
  const store = new ConfigStore();
  assert.equal(store.delete("nonexistent"), false);
});

test("config-store toObject returns all entries", () => {
  const store = new ConfigStore();
  store.set("key1", "value1");
  store.set("key2", 42);
  const obj = store.toObject();
  assert.equal(obj.key1, "value1");
  assert.equal(obj.key2, 42);
});

test("config-store version increments on set", () => {
  const store = new ConfigStore();
  const initialVersion = store.getVersion();
  store.set("key1", "value1");
  assert.ok(store.getVersion() > initialVersion);
});

test("config-store snapshot and restore", () => {
  const store = new ConfigStore();
  store.set("key1", "value1");
  store.set("key2", 42);

  const snapshot = store.snapshot();
  assert.ok(snapshot.entries.key1);
  assert.equal(snapshot.version, store.getVersion());

  const store2 = new ConfigStore();
  store2.restore(snapshot);
  assert.equal(store2.get("key1"), "value1");
  assert.equal(store2.get("key2"), 42);
});

test("config-store restore throws on invalid snapshot", () => {
  const store = new ConfigStore();
  assert.throws(
    () => store.restore({} as any),
    Error,
    "ValidationError",
  );
});

test("config-store merge adds entries", () => {
  const store = new ConfigStore();
  store.set("key1", "value1");
  store.merge({ key2: "value2", key3: "value3" });
  assert.equal(store.get("key1"), "value1");
  assert.equal(store.get("key2"), "value2");
  assert.equal(store.get("key3"), "value3");
});

test("config-store clear removes all entries", () => {
  const store = new ConfigStore();
  store.set("key1", "value1");
  store.set("key2", "value2");
  store.clear();
  assert.equal(store.get("key1"), undefined);
  assert.equal(store.get("key2"), undefined);
  assert.ok(store.getVersion() > 0);
});

test("config-store onChange listener is called", () => {
  const store = new ConfigStore();
  let callCount = 0;
  store.onChange(() => callCount++);
  store.set("key1", "value1");
  assert.equal(callCount, 1);
  store.set("key1", "value2");
  assert.equal(callCount, 2);
});

test("config-store offChange removes listener", () => {
  const store = new ConfigStore();
  let callCount = 0;
  const listener = () => callCount++;
  store.onChange(listener);
  store.set("key1", "value1");
  assert.equal(callCount, 1);
  store.offChange(listener);
  store.set("key1", "value2");
  assert.equal(callCount, 1);
});

test("config-store initialEntries populates store", () => {
  const store = new ConfigStore({ initialEntries: { key1: "value1", key2: 42 } });
  assert.equal(store.get("key1"), "value1");
  assert.equal(store.get("key2"), 42);
});

test("config-store version increments on delete", () => {
  const store = new ConfigStore();
  store.set("key1", "value1");
  const versionAfterSet = store.getVersion();
  store.delete("key1");
  assert.ok(store.getVersion() > versionAfterSet);
});