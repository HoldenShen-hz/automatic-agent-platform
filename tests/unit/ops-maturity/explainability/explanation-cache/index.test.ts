import assert from "node:assert/strict";
import test from "node:test";

import {
  ExplanationCacheEntry,
  putExplanationCacheEntry,
} from "../../../../../src/ops-maturity/explainability/explanation-cache/index.js";

test("putExplanationCacheEntry adds entry to empty cache", () => {
  const cache: Record<string, ExplanationCacheEntry> = {};
  const entry: ExplanationCacheEntry = { cacheKey: "key1", summary: "Summary 1", ttlHours: 1 };

  const result = putExplanationCacheEntry(cache, entry);

  assert.equal(result["key1"]?.summary, "Summary 1");
  assert.equal(result["key1"]?.ttlHours, 1);
  assert.equal(Object.keys(result).length, 1);
});

test("putExplanationCacheEntry preserves existing entries", () => {
  const cache: Record<string, ExplanationCacheEntry> = {
    existing: { cacheKey: "existing", summary: "Existing summary", ttlHours: 1 },
  };
  const entry: ExplanationCacheEntry = { cacheKey: "new", summary: "New summary", ttlHours: 1 };

  const result = putExplanationCacheEntry(cache, entry);

  assert.equal(result["existing"], cache["existing"]);
  assert.equal(result["new"]?.summary, "New summary");
  assert.equal(Object.keys(result).length, 2);
});

test("putExplanationCacheEntry overwrites existing entry with same key", () => {
  const cache: Record<string, ExplanationCacheEntry> = {
    key1: { cacheKey: "key1", summary: "Old summary", ttlHours: 1 },
  };
  const entry: ExplanationCacheEntry = { cacheKey: "key1", summary: "New summary", ttlHours: 1 };

  const result = putExplanationCacheEntry(cache, entry);

  assert.equal(result["key1"]?.summary, "New summary");
  assert.equal(Object.keys(result).length, 1);
});

test("putExplanationCacheEntry returns new object (immutability)", () => {
  const cache: Record<string, ExplanationCacheEntry> = {};
  const entry: ExplanationCacheEntry = { cacheKey: "key1", summary: "Summary 1", ttlHours: 1 };

  const result = putExplanationCacheEntry(cache, entry);

  assert.notEqual(result, cache);
});

test("putExplanationCacheEntry handles multiple entries", () => {
  let cache: Record<string, ExplanationCacheEntry> = {};

  cache = putExplanationCacheEntry(cache, { cacheKey: "a", summary: "A", ttlHours: 1 });
  cache = putExplanationCacheEntry(cache, { cacheKey: "b", summary: "B", ttlHours: 1 });
  cache = putExplanationCacheEntry(cache, { cacheKey: "c", summary: "C", ttlHours: 1 });

  assert.equal(Object.keys(cache).length, 3);
  assert.equal(cache["a"]?.summary, "A");
  assert.equal(cache["b"]?.summary, "B");
  assert.equal(cache["c"]?.summary, "C");
});
