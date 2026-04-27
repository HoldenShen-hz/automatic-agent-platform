import assert from "node:assert/strict";
import test from "node:test";

import { sortAttentionQueue } from "../../../../../src/interaction/dashboard/alert-router/index.js";

interface AttentionItem {
  readonly id: string;
  readonly priority: "critical" | "high" | "normal" | "low";
  readonly createdAt: string;
  readonly message: string;
}

function makeItem(overrides: Partial<AttentionItem> = {}): AttentionItem {
  return {
    id: "item-1",
    priority: "normal",
    createdAt: "2026-04-01T00:00:00.000Z",
    message: "Test item",
    ...overrides,
  };
}

test("sortAttentionQueue returns empty array for empty input", () => {
  const result = sortAttentionQueue([]);

  assert.equal(result.length, 0);
});

test("sortAttentionQueue sorts by priority critical first", () => {
  const items = [
    makeItem({ id: "low", priority: "low", createdAt: "2026-04-01T00:00:00.000Z" }),
    makeItem({ id: "critical", priority: "critical", createdAt: "2026-04-01T00:00:00.000Z" }),
    makeItem({ id: "high", priority: "high", createdAt: "2026-04-01T00:00:00.000Z" }),
  ];

  const result = sortAttentionQueue(items);

  assert.equal(result[0]?.id, "critical");
  assert.equal(result[1]?.id, "high");
  assert.equal(result[2]?.id, "low");
});

test("sortAttentionQueue sorts by priority high before normal", () => {
  const items = [
    makeItem({ id: "normal", priority: "normal", createdAt: "2026-04-01T00:00:00.000Z" }),
    makeItem({ id: "high", priority: "high", createdAt: "2026-04-01T00:00:00.000Z" }),
  ];

  const result = sortAttentionQueue(items);

  assert.equal(result[0]?.id, "high");
  assert.equal(result[1]?.id, "normal");
});

test("sortAttentionQueue sorts by priority normal before low", () => {
  const items = [
    makeItem({ id: "low", priority: "low", createdAt: "2026-04-01T00:00:00.000Z" }),
    makeItem({ id: "normal", priority: "normal", createdAt: "2026-04-01T00:00:00.000Z" }),
  ];

  const result = sortAttentionQueue(items);

  assert.equal(result[0]?.id, "normal");
  assert.equal(result[1]?.id, "low");
});

test("sortAttentionQueue sorts by createdAt within same priority", () => {
  const items = [
    makeItem({ id: "later", priority: "normal", createdAt: "2026-04-02T00:00:00.000Z" }),
    makeItem({ id: "earlier", priority: "normal", createdAt: "2026-04-01T00:00:00.000Z" }),
  ];

  const result = sortAttentionQueue(items);

  assert.equal(result[0]?.id, "earlier");
  assert.equal(result[1]?.id, "later");
});

test("sortAttentionQueue does not mutate original array", () => {
  const items = [
    makeItem({ id: "item", priority: "high", createdAt: "2026-04-01T00:00:00.000Z" }),
  ];

  sortAttentionQueue(items);

  assert.equal(items[0]?.id, "item");
});

test("sortAttentionQueue handles all same priority", () => {
  const items = [
    makeItem({ id: "c", priority: "normal", createdAt: "2026-04-03T00:00:00.000Z" }),
    makeItem({ id: "a", priority: "normal", createdAt: "2026-04-01T00:00:00.000Z" }),
    makeItem({ id: "b", priority: "normal", createdAt: "2026-04-02T00:00:00.000Z" }),
  ];

  const result = sortAttentionQueue(items);

  assert.equal(result[0]?.id, "a");
  assert.equal(result[1]?.id, "b");
  assert.equal(result[2]?.id, "c");
});

test("sortAttentionQueue handles mixed priorities and times", () => {
  const items = [
    makeItem({ id: "late-high", priority: "high", createdAt: "2026-04-05T00:00:00.000Z" }),
    makeItem({ id: "early-critical", priority: "critical", createdAt: "2026-04-01T00:00:00.000Z" }),
    makeItem({ id: "early-normal", priority: "normal", createdAt: "2026-04-01T00:00:00.000Z" }),
  ];

  const result = sortAttentionQueue(items);

  // critical always comes before high, even if high is earlier
  assert.equal(result[0]?.id, "early-critical");
  assert.equal(result[1]?.id, "late-high");
  assert.equal(result[2]?.id, "early-normal");
});

test("sortAttentionQueue handles single item", () => {
  const items = [makeItem({ id: "only" })];

  const result = sortAttentionQueue(items);

  assert.equal(result.length, 1);
  assert.equal(result[0]?.id, "only");
});

test("sortAttentionQueue preserves readonly input", () => {
  const items: readonly AttentionItem[] = [
    makeItem({ id: "a", priority: "low", createdAt: "2026-04-01T00:00:00.000Z" }),
    makeItem({ id: "b", priority: "critical", createdAt: "2026-04-01T00:00:00.000Z" }),
  ];

  const result = sortAttentionQueue(items);

  assert.equal(result[0]?.id, "b");
});