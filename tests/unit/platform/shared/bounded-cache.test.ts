import { test } from "node:test";
import assert from "node:assert/strict";
import { BoundedCache } from "../../../../src/platform/shared/utils/bounded-cache.js";

test("BoundedCache - basic get/set operations", () => {
  const cache = new BoundedCache<string, number>(3);

  cache.set("a", 1);
  cache.set("b", 2);
  cache.set("c", 3);

  assert.equal(cache.get("a"), 1);
  assert.equal(cache.get("b"), 2);
  assert.equal(cache.get("c"), 3);
  assert.equal(cache.size, 3);
});

test("BoundedCache - eviction of oldest entry when at capacity", () => {
  const cache = new BoundedCache<string, number>(3);

  cache.set("a", 1);
  cache.set("b", 2);
  cache.set("c", 3);
  cache.set("d", 4); // Should evict "a"

  assert.equal(cache.get("a"), undefined);
  assert.equal(cache.get("b"), 2);
  assert.equal(cache.get("c"), 3);
  assert.equal(cache.get("d"), 4);
  assert.equal(cache.size, 3);
});

test("BoundedCache - updating existing key does not evict", () => {
  const cache = new BoundedCache<string, number>(3);

  cache.set("a", 1);
  cache.set("b", 2);
  cache.set("a", 10); // Update existing key

  assert.equal(cache.get("a"), 10);
  assert.equal(cache.size, 2);
});

test("BoundedCache - has and delete operations", () => {
  const cache = new BoundedCache<string, number>(3);

  cache.set("a", 1);
  cache.set("b", 2);

  assert.equal(cache.has("a"), true);
  assert.equal(cache.has("c"), false);

  assert.equal(cache.delete("a"), true);
  assert.equal(cache.has("a"), false);
  assert.equal(cache.get("a"), undefined);
  assert.equal(cache.size, 1);
});

test("BoundedCache - clear removes all entries", () => {
  const cache = new BoundedCache<string, number>(3);

  cache.set("a", 1);
  cache.set("b", 2);
  cache.set("c", 3);
  cache.clear();

  assert.equal(cache.size, 0);
  assert.equal(cache.get("a"), undefined);
  assert.equal(cache.get("b"), undefined);
});

test("BoundedCache - default capacity is 100", () => {
  const cache = new BoundedCache<string, number>();
  assert.equal((cache as unknown as { maxEntries: number }).maxEntries, 100);
});

test("BoundedCache - negative maxEntries defaults to 1", () => {
  const cache = new BoundedCache<string, number>(-5);
  assert.equal((cache as unknown as { maxEntries: number }).maxEntries, 1);
});

test("BoundedCache - zero maxEntries defaults to 1", () => {
  const cache = new BoundedCache<string, number>(0);
  assert.equal((cache as unknown as { maxEntries: number }).maxEntries, 1);
});

test("BoundedCache - fractional maxEntries is truncated", () => {
  const cache = new BoundedCache<string, number>(3.7);
  assert.equal((cache as unknown as { maxEntries: number }).maxEntries, 3);
});

test("BoundedCache - iteration over entries", () => {
  const cache = new BoundedCache<string, number>(3);

  cache.set("a", 1);
  cache.set("b", 2);

  const entries = [...cache.entries()];
  assert.equal(entries.length, 2);
  assert.ok(entries.some(([k, v]) => k === "a" && v === 1));
  assert.ok(entries.some(([k, v]) => k === "b" && v === 2));
});

test("BoundedCache - iteration over keys", () => {
  const cache = new BoundedCache<string, number>(3);

  cache.set("a", 1);
  cache.set("b", 2);

  const keys = [...cache.keys()];
  assert.equal(keys.length, 2);
  assert.ok(keys.includes("a"));
  assert.ok(keys.includes("b"));
});

test("BoundedCache - iteration over values", () => {
  const cache = new BoundedCache<number, string>(3);

  cache.set(1, "one");
  cache.set(2, "two");

  const values = [...cache.values()];
  assert.equal(values.length, 2);
  assert.ok(values.includes("one"));
  assert.ok(values.includes("two"));
});

test("BoundedCache - symbol iterator", () => {
  const cache = new BoundedCache<string, number>(3);

  cache.set("a", 1);
  cache.set("b", 2);

  const entries: [string, number][] = [];
  for (const entry of cache) {
    entries.push(entry);
  }

  assert.equal(entries.length, 2);
});

test("BoundedCache - different key types", () => {
  const cache = new BoundedCache<number, string>(3);

  cache.set(1, "one");
  cache.set(2, "two");

  assert.equal(cache.get(1), "one");
  assert.equal(cache.get(2), "two");
});

test("BoundedCache - update moves key to most recent", () => {
  const cache = new BoundedCache<string, number>(3);

  cache.set("a", 1);
  cache.set("b", 2);
  cache.set("c", 3);
  cache.set("a", 10); // Update "a" to move it to most recent
  cache.set("d", 4);  // Should evict "b" (oldest after "a" was updated)

  assert.equal(cache.get("a"), 10);
  assert.equal(cache.get("b"), undefined);
  assert.equal(cache.get("c"), 3);
  assert.equal(cache.get("d"), 4);
});