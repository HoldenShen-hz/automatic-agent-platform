import assert from "node:assert/strict";
import test from "node:test";

import { sortAttentionQueue } from "../../../../src/interaction/dashboard/alert-router/index.js";
import type { AttentionItem } from "../../../../src/interaction/dashboard/index.js";

function makeAttentionItem(overrides: Partial<AttentionItem> = {}): AttentionItem {
  return {
    itemType: "incident",
    priority: "high",
    title: "Test Alert",
    description: "Test description",
    actionOptions: ["inspect", "retry"],
    createdAt: "2026-04-19T00:00:00.000Z",
    domainId: "general_ops",
    ...overrides,
  };
}

test("sortAttentionQueue sorts by priority then createdAt", () => {
  const items = [
    makeAttentionItem({ priority: "low", createdAt: "2026-04-19T00:00:00.000Z" }),
    makeAttentionItem({ priority: "critical", createdAt: "2026-04-19T00:00:00.000Z" }),
    makeAttentionItem({ priority: "normal", createdAt: "2026-04-19T00:00:00.000Z" }),
    makeAttentionItem({ priority: "high", createdAt: "2026-04-19T00:00:00.000Z" }),
  ];

  const sorted = sortAttentionQueue(items);

  assert.equal(sorted[0]!.priority, "critical");
  assert.equal(sorted[1]!.priority, "high");
  assert.equal(sorted[2]!.priority, "normal");
  assert.equal(sorted[3]!.priority, "low");
});

test("sortAttentionQueue respects createdAt within same priority", () => {
  const items = [
    makeAttentionItem({ priority: "critical", createdAt: "2026-04-20T00:00:00.000Z" }),
    makeAttentionItem({ priority: "critical", createdAt: "2026-04-19T00:00:00.000Z" }),
  ];

  const sorted = sortAttentionQueue(items);

  assert.ok(sorted[0]!.createdAt < sorted[1]!.createdAt);
});

test("sortAttentionQueue handles empty array", () => {
  const sorted = sortAttentionQueue([]);
  assert.equal(sorted.length, 0);
});

test("sortAttentionQueue handles single item", () => {
  const items = [makeAttentionItem({ priority: "critical" })];
  const sorted = sortAttentionQueue(items);
  assert.equal(sorted.length, 1);
  assert.equal(sorted[0]!.priority, "critical");
});

test("sortAttentionQueue is stable for items with same priority and createdAt", () => {
  const items = [
    makeAttentionItem({ priority: "high", createdAt: "2026-04-19T00:00:00.000Z" }),
    makeAttentionItem({ priority: "high", createdAt: "2026-04-19T00:00:00.000Z" }),
  ];

  const sorted = sortAttentionQueue(items);
  assert.equal(sorted.length, 2);
});
