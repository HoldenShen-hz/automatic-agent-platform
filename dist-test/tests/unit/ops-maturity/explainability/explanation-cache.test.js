/**
 * Unit tests for ExplanationCache
 *
 * @see src/ops-maturity/explainability/explanation-cache/index.ts
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { putExplanationCacheEntry, } from "../../../../src/ops-maturity/explainability/index.js";
describe("ExplanationCache", () => {
    describe("putExplanationCacheEntry", () => {
        test("adds a new entry to empty cache", () => {
            const cache = {};
            const entry = { cacheKey: "task-1:plan:L2", summary: "Task completed" };
            const result = putExplanationCacheEntry(cache, entry);
            assert.equal(result["task-1:plan:L2"]?.summary, "Task completed");
        });
        test("adds entry to non-empty cache preserving existing entries", () => {
            const cache = {
                "existing-key": { cacheKey: "existing-key", summary: "Existing summary" },
            };
            const entry = { cacheKey: "new-key", summary: "New summary" };
            const result = putExplanationCacheEntry(cache, entry);
            assert.equal(result["existing-key"]?.summary, "Existing summary");
            assert.equal(result["new-key"]?.summary, "New summary");
        });
        test("overwrites existing entry with same cache key", () => {
            const cache = {
                "task-1:stage:L2": { cacheKey: "task-1:stage:L2", summary: "Old summary" },
            };
            const entry = {
                cacheKey: "task-1:stage:L2",
                summary: "Updated summary",
            };
            const result = putExplanationCacheEntry(cache, entry);
            assert.equal(Object.keys(result).length, 1);
            assert.equal(result["task-1:stage:L2"]?.summary, "Updated summary");
        });
        test("returns new cache object without mutating original", () => {
            const original = {};
            const entry = { cacheKey: "key", summary: "summary" };
            const result = putExplanationCacheEntry(original, entry);
            assert.ok(!original["key"]);
            assert.ok(result["key"]);
        });
        test("handles cache with multiple entries", () => {
            const cache = {
                "task-1:stage1:L1": { cacheKey: "task-1:stage1:L1", summary: "Summary 1" },
                "task-1:stage2:L2": { cacheKey: "task-1:stage2:L2", summary: "Summary 2" },
                "task-2:stage1:L2": { cacheKey: "task-2:stage1:L2", summary: "Summary 3" },
            };
            const entry = {
                cacheKey: "task-2:stage2:L3",
                summary: "Summary 4",
            };
            const result = putExplanationCacheEntry(cache, entry);
            assert.equal(Object.keys(result).length, 4);
            assert.equal(result["task-2:stage2:L3"]?.summary, "Summary 4");
        });
        test("returned cache contains the new entry", () => {
            const cache = {};
            const entry = { cacheKey: "key", summary: "summary" };
            const result = putExplanationCacheEntry(cache, entry);
            assert.equal(result["key"]?.cacheKey, "key");
            assert.equal(result["key"]?.summary, "summary");
        });
    });
});
//# sourceMappingURL=explanation-cache.test.js.map