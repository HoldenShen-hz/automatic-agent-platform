import assert from "node:assert/strict";
import test from "node:test";

import { sortAttentionQueue } from "../../../../src/interaction/dashboard/alert-router/index.js";
import type { AttentionItem } from "../../../../src/interaction/dashboard/index.js";

test("sortAttentionQueue sorts by priority (critical first)", () => {
  const items: AttentionItem[] = [
    { itemType: "incident", priority: "low", title: "Low", description: "d", actionOptions: [], createdAt: "2026-04-19T00:00:00.000Z", domainId: "d1" },
    { itemType: "incident", priority: "critical", title: "Critical", description: "c", actionOptions: [], createdAt: "2026-04-19T00:00:00.000Z", domainId: "d1" },
    { itemType: "incident", priority: "high", title: "High", description: "b", actionOptions: [], createdAt: "2026-04-19T00:00:00.000Z", domainId: "d1" },
    { itemType: "incident", priority: "normal", title: "Normal", description: "a", actionOptions: [], createdAt: "2026-04-19T00:00:00.000Z", domainId: "d1" },
  ];

  const sorted = sortAttentionQueue(items);

  assert.equal(sorted[0]!.priority, "critical");
  assert.equal(sorted[1]!.priority, "high");
  assert.equal(sorted[2]!.priority, "normal");
  assert.equal(sorted[3]!.priority, "low");
});

test("sortAttentionQueue sorts by createdAt within same priority", () => {
  const items: AttentionItem[] = [
    { itemType: "incident", priority: "normal", title: "Second", description: "s", actionOptions: [], createdAt: "2026-04-19T02:00:00.000Z", domainId: "d1" },
    { itemType: "incident", priority: "normal", title: "First", description: "f", actionOptions: [], createdAt: "2026-04-19T01:00:00.000Z", domainId: "d1" },
    { itemType: "incident", priority: "normal", title: "Third", description: "t", actionOptions: [], createdAt: "2026-04-19T03:00:00.000Z", domainId: "d1" },
  ];

  const sorted = sortAttentionQueue(items);

  assert.equal(sorted[0]!.title, "First");
  assert.equal(sorted[1]!.title, "Second");
  assert.equal(sorted[2]!.title, "Third");
});

test("sortAttentionQueue does not mutate original array", () => {
  const items: AttentionItem[] = [
    { itemType: "incident", priority: "low", title: "Low", description: "d", actionOptions: [], createdAt: "2026-04-19T00:00:00.000Z", domainId: "d1" },
    { itemType: "incident", priority: "critical", title: "Critical", description: "c", actionOptions: [], createdAt: "2026-04-19T00:00:00.000Z", domainId: "d1" },
  ];

  const originalFirst = items[0];
  sortAttentionQueue(items);

  assert.equal(items[0], originalFirst);
});

test("sortAttentionQueue handles empty array", () => {
  const sorted = sortAttentionQueue([]);
  assert.deepEqual(sorted, []);
});

test("sortAttentionQueue handles single item", () => {
  const items: AttentionItem[] = [
    { itemType: "approval_needed", priority: "high", title: "Single", description: "s", actionOptions: [], createdAt: "2026-04-19T00:00:00.000Z", domainId: "d1" },
  ];

  const sorted = sortAttentionQueue(items);

  assert.equal(sorted.length, 1);
  assert.equal(sorted[0]!.title, "Single");
});

test("sortAttentionQueue sorts all priorities correctly", () => {
  const items: AttentionItem[] = [
    { itemType: "suggestion", priority: "low", title: "low", description: "l", actionOptions: [], createdAt: "2026-04-19T00:00:00.000Z", domainId: "d1" },
    { itemType: "budget_warning", priority: "normal", title: "normal", description: "n", actionOptions: [], createdAt: "2026-04-19T00:00:00.000Z", domainId: "d1" },
    { itemType: "quality_alert", priority: "high", title: "high", description: "h", actionOptions: [], createdAt: "2026-04-19T00:00:00.000Z", domainId: "d1" },
    { itemType: "incident", priority: "critical", title: "critical", description: "c", actionOptions: [], createdAt: "2026-04-19T00:00:00.000Z", domainId: "d1" },
  ];

  const sorted = sortAttentionQueue(items);

  assert.equal(sorted[0]!.priority, "critical");
  assert.equal(sorted[1]!.priority, "high");
  assert.equal(sorted[2]!.priority, "normal");
  assert.equal(sorted[3]!.priority, "low");
});
