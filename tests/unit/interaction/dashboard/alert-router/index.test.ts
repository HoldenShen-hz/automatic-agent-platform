import assert from "node:assert/strict";
import test from "node:test";

import { sortAttentionQueue } from "../../../../../src/interaction/dashboard/alert-router/index.js";
import type { AttentionItem } from "../../../../../src/interaction/dashboard/index.js";

function makeAttentionItem(overrides: Partial<AttentionItem>): AttentionItem {
  return {
    id: overrides.id ?? "attention-item",
    itemType: overrides.itemType ?? "incident",
    priority: overrides.priority ?? "normal",
    title: overrides.title ?? "Untitled",
    description: overrides.description ?? "No description",
    actionOptions: overrides.actionOptions ?? [],
    createdAt: overrides.createdAt ?? "2026-04-19T00:00:00.000Z",
    domainId: overrides.domainId ?? "d1",
  };
}

test("sortAttentionQueue sorts by priority (critical first)", () => {
  const items: AttentionItem[] = [
    makeAttentionItem({ id: "low", itemType: "incident", priority: "low", title: "Low", description: "d" }),
    makeAttentionItem({ id: "critical", itemType: "incident", priority: "critical", title: "Critical", description: "c" }),
    makeAttentionItem({ id: "high", itemType: "incident", priority: "high", title: "High", description: "b" }),
    makeAttentionItem({ id: "normal", itemType: "incident", priority: "normal", title: "Normal", description: "a" }),
  ];

  const sorted = sortAttentionQueue(items);

  assert.equal(sorted[0]!.priority, "critical");
  assert.equal(sorted[1]!.priority, "high");
  assert.equal(sorted[2]!.priority, "normal");
  assert.equal(sorted[3]!.priority, "low");
});

test("sortAttentionQueue sorts by createdAt within same priority", () => {
  const items: AttentionItem[] = [
    makeAttentionItem({ id: "second", itemType: "incident", priority: "normal", title: "Second", description: "s", createdAt: "2026-04-19T02:00:00.000Z" }),
    makeAttentionItem({ id: "first", itemType: "incident", priority: "normal", title: "First", description: "f", createdAt: "2026-04-19T01:00:00.000Z" }),
    makeAttentionItem({ id: "third", itemType: "incident", priority: "normal", title: "Third", description: "t", createdAt: "2026-04-19T03:00:00.000Z" }),
  ];

  const sorted = sortAttentionQueue(items);

  assert.equal(sorted[0]!.title, "Third");
  assert.equal(sorted[1]!.title, "Second");
  assert.equal(sorted[2]!.title, "First");
});

test("sortAttentionQueue does not mutate original array", () => {
  const items: AttentionItem[] = [
    makeAttentionItem({ id: "low", itemType: "incident", priority: "low", title: "Low", description: "d" }),
    makeAttentionItem({ id: "critical", itemType: "incident", priority: "critical", title: "Critical", description: "c" }),
  ];

  const originalFirst = items[0];
  sortAttentionQueue(items);

  assert.equal(items[0], originalFirst);
});

test("sortAttentionQueue handles empty array", () => {
  const sorted = sortAttentionQueue([]);
  assert.deepEqual(sorted, []);
});

test("sortAttentionQueue handles single item [alert-router-index]", () => {
  const items: AttentionItem[] = [
    makeAttentionItem({ id: "single", itemType: "approval_needed", priority: "high", title: "Single", description: "s" }),
  ];

  const sorted = sortAttentionQueue(items);

  assert.equal(sorted.length, 1);
  assert.equal(sorted[0]!.title, "Single");
});

test("sortAttentionQueue sorts all priorities correctly", () => {
  const items: AttentionItem[] = [
    makeAttentionItem({ id: "low", itemType: "suggestion", priority: "low", title: "low", description: "l" }),
    makeAttentionItem({ id: "normal", itemType: "budget_warning", priority: "normal", title: "normal", description: "n" }),
    makeAttentionItem({ id: "high", itemType: "quality_alert", priority: "high", title: "high", description: "h" }),
    makeAttentionItem({ id: "critical", itemType: "incident", priority: "critical", title: "critical", description: "c" }),
  ];

  const sorted = sortAttentionQueue(items);

  assert.equal(sorted[0]!.priority, "critical");
  assert.equal(sorted[1]!.priority, "high");
  assert.equal(sorted[2]!.priority, "normal");
  assert.equal(sorted[3]!.priority, "low");
});
