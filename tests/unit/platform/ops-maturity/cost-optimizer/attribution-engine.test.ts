import test from "node:test";
import { strict as assert } from "node:assert/strict";
import { aggregateCostAttribution, type CostAttributionEntry } from "../../../../../../src/ops-maturity/cost-optimizer/attribution-engine/index.js";
import { putExplanationCacheEntry, type ExplanationCacheEntry } from "../../../../../../src/ops-maturity/explainability/explanation-cache/index.js";

test("aggregateCostAttribution sums amounts for same subjectId", () => {
  const entries: CostAttributionEntry[] = [
    { subjectId: "agent-1", amountUsd: 0.10 },
    { subjectId: "agent-1", amountUsd: 0.20 },
    { subjectId: "agent-1", amountUsd: 0.15 },
  ];

  const result = aggregateCostAttribution(entries);

  assert.strictEqual(result["agent-1"], 0.45);
});

test("aggregateCostAttribution handles different subjectIds", () => {
  const entries: CostAttributionEntry[] = [
    { subjectId: "agent-1", amountUsd: 0.10 },
    { subjectId: "agent-2", amountUsd: 0.25 },
    { subjectId: "agent-3", amountUsd: 0.15 },
  ];

  const result = aggregateCostAttribution(entries);

  assert.strictEqual(result["agent-1"], 0.10);
  assert.strictEqual(result["agent-2"], 0.25);
  assert.strictEqual(result["agent-3"], 0.15);
});

test("aggregateCostAttribution returns empty object for empty array", () => {
  const entries: readonly CostAttributionEntry[] = [];

  const result = aggregateCostAttribution(entries);

  assert.deepStrictEqual(result, {});
});

test("aggregateCostAttribution rounds to 4 decimal places", () => {
  const entries: CostAttributionEntry[] = [
    { subjectId: "agent-1", amountUsd: 0.1 },
    { subjectId: "agent-1", amountUsd: 0.2 },
  ];

  const result = aggregateCostAttribution(entries);

  assert.strictEqual(result["agent-1"], 0.30);
});

test("aggregateCostAttribution handles very small amounts", () => {
  const entries: CostAttributionEntry[] = [
    { subjectId: "agent-1", amountUsd: 0.0001 },
    { subjectId: "agent-1", amountUsd: 0.0002 },
  ];

  const result = aggregateCostAttribution(entries);

  assert.strictEqual(result["agent-1"], 0.0003);
});

test("aggregateCostAttribution handles single entry", () => {
  const entries: CostAttributionEntry[] = [
    { subjectId: "agent-1", amountUsd: 1.5 },
  ];

  const result = aggregateCostAttribution(entries);

  assert.strictEqual(result["agent-1"], 1.5);
});

test("aggregateCostAttribution handles readonly input", () => {
  const entries: readonly CostAttributionEntry[] = [
    { subjectId: "agent-1", amountUsd: 0.5 },
  ];

  const result = aggregateCostAttribution(entries);

  assert.strictEqual(result["agent-1"], 0.5);
});

test("putExplanationCacheEntry adds entry to cache", () => {
  const cache: Record<string, ExplanationCacheEntry> = {};
  const entry: ExplanationCacheEntry = {
    cacheKey: "key-1",
    summary: "Test summary",
  };

  const result = putExplanationCacheEntry(cache, entry);

  assert.strictEqual(result["key-1"]?.cacheKey, "key-1");
  assert.strictEqual(result["key-1"]?.summary, "Test summary");
});

test("putExplanationCacheEntry preserves existing entries", () => {
  const cache: Record<string, ExplanationCacheEntry> = {
    existing: { cacheKey: "existing", summary: "Existing summary" },
  };
  const entry: ExplanationCacheEntry = {
    cacheKey: "new-key",
    summary: "New summary",
  };

  const result = putExplanationCacheEntry(cache, entry);

  assert.strictEqual(result["existing"]?.summary, "Existing summary");
  assert.strictEqual(result["new-key"]?.summary, "New summary");
});

test("putExplanationCacheEntry handles empty cache", () => {
  const cache: Record<string, ExplanationCacheEntry> = {};
  const entry: ExplanationCacheEntry = {
    cacheKey: "key-1",
    summary: "First entry",
  };

  const result = putExplanationCacheEntry(cache, entry);

  assert.strictEqual(Object.keys(result).length, 1);
});

test("putExplanationCacheEntry uses spread operator for immutability", () => {
  const cache: Record<string, ExplanationCacheEntry> = {};
  const entry: ExplanationCacheEntry = {
    cacheKey: "key-1",
    summary: "Test",
  };

  const result = putExplanationCacheEntry(cache, entry);

  assert.strictEqual(cache["key-1"], undefined);
  assert.ok(result !== cache);
});

test("aggregateCostAttribution handles zero amount", () => {
  const entries: CostAttributionEntry[] = [
    { subjectId: "agent-1", amountUsd: 0 },
    { subjectId: "agent-1", amountUsd: 0.1 },
  ];

  const result = aggregateCostAttribution(entries);

  assert.strictEqual(result["agent-1"], 0.1);
});

test("aggregateCostAttribution handles many entries for same subject", () => {
  const entries: CostAttributionEntry[] = Array.from({ length: 100 }, (_, i) => ({
    subjectId: "agent-1",
    amountUsd: 0.01,
  }));

  const result = aggregateCostAttribution(entries);

  assert.strictEqual(result["agent-1"], 1);
});

test("aggregateCostAttribution handles mixed subjectIds", () => {
  const entries: CostAttributionEntry[] = [
    { subjectId: "a", amountUsd: 1 },
    { subjectId: "b", amountUsd: 2 },
    { subjectId: "a", amountUsd: 3 },
    { subjectId: "b", amountUsd: 4 },
    { subjectId: "c", amountUsd: 5 },
  ];

  const result = aggregateCostAttribution(entries);

  assert.strictEqual(result["a"], 4);
  assert.strictEqual(result["b"], 6);
  assert.strictEqual(result["c"], 5);
});

test("putExplanationCacheEntry allows overwriting existing key", () => {
  const cache: Record<string, ExplanationCacheEntry> = {
    "duplicate-key": { cacheKey: "duplicate-key", summary: "Old summary" },
  };
  const entry: ExplanationCacheEntry = {
    cacheKey: "duplicate-key",
    summary: "New summary",
  };

  const result = putExplanationCacheEntry(cache, entry);

  assert.strictEqual(result["duplicate-key"]?.summary, "New summary");
});

test("ExplanationCacheEntry has correct structure", () => {
  const entry: ExplanationCacheEntry = {
    cacheKey: "test-key",
    summary: "Test summary text",
  };

  assert.strictEqual(entry.cacheKey, "test-key");
  assert.strictEqual(entry.summary, "Test summary text");
});

test("CostAttributionEntry has correct structure", () => {
  const entry: CostAttributionEntry = {
    subjectId: "test-agent",
    amountUsd: 1.234,
  };

  assert.strictEqual(entry.subjectId, "test-agent");
  assert.strictEqual(entry.amountUsd, 1.234);
});

test("aggregateCostAttribution preserves fractional precision", () => {
  const entries: CostAttributionEntry[] = [
    { subjectId: "agent-1", amountUsd: 0.3333 },
    { subjectId: "agent-1", amountUsd: 0.3333 },
    { subjectId: "agent-1", amountUsd: 0.3334 },
  ];

  const result = aggregateCostAttribution(entries);

  assert.strictEqual(result["agent-1"], 1);
});