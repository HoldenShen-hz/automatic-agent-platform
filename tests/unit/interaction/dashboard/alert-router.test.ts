import assert from "node:assert/strict";
import test from "node:test";

import { sortAttentionQueue } from "../../../../src/interaction/dashboard/alert-router/index.js";
import type { AttentionItem } from "../../../../src/interaction/dashboard/index.js";

test("sortAttentionQueue sorts by priority order critical > high > normal > low", () => {
  const items: AttentionItem[] = [
    {
      itemType: "suggestion",
      priority: "low",
      title: "Low Priority Item",
      description: "This is a low priority item",
      actionOptions: ["ignore"],
      createdAt: "2026-04-23T10:00:00.000Z",
      domainId: "test",
    },
    {
      itemType: "incident",
      priority: "critical",
      title: "Critical Issue",
      description: "This is critical",
      actionOptions: ["fix"],
      createdAt: "2026-04-23T10:00:00.000Z",
      domainId: "test",
    },
    {
      itemType: "budget_warning",
      priority: "high",
      title: "High Priority Budget",
      description: "Budget warning",
      actionOptions: ["review"],
      createdAt: "2026-04-23T10:00:00.000Z",
      domainId: "test",
    },
    {
      itemType: "approval_needed",
      priority: "normal",
      title: "Normal Approval",
      description: "Needs approval",
      actionOptions: ["approve"],
      createdAt: "2026-04-23T10:00:00.000Z",
      domainId: "test",
    },
  ];

  const sorted = sortAttentionQueue(items);

  assert.equal(sorted[0]?.priority, "critical");
  assert.equal(sorted[1]?.priority, "high");
  assert.equal(sorted[2]?.priority, "normal");
  assert.equal(sorted[3]?.priority, "low");
});

test("sortAttentionQueue sorts by createdAt within same priority", () => {
  const items: AttentionItem[] = [
    {
      itemType: "incident",
      priority: "high",
      title: "Second Created",
      description: "Created later",
      actionOptions: ["fix"],
      createdAt: "2026-04-23T12:00:00.000Z",
      domainId: "test",
    },
    {
      itemType: "incident",
      priority: "high",
      title: "First Created",
      description: "Created first",
      actionOptions: ["fix"],
      createdAt: "2026-04-23T08:00:00.000Z",
      domainId: "test",
    },
    {
      itemType: "incident",
      priority: "high",
      title: "Third Created",
      description: "Created last",
      actionOptions: ["fix"],
      createdAt: "2026-04-23T14:00:00.000Z",
      domainId: "test",
    },
  ];

  const sorted = sortAttentionQueue(items);

  assert.equal(sorted[0]?.title, "First Created");
  assert.equal(sorted[1]?.title, "Second Created");
  assert.equal(sorted[2]?.title, "Third Created");
});

test("sortAttentionQueue does not mutate original array", () => {
  const items: AttentionItem[] = [
    {
      itemType: "incident",
      priority: "high",
      title: "High Priority",
      description: "Test",
      actionOptions: ["fix"],
      createdAt: "2026-04-23T10:00:00.000Z",
      domainId: "test",
    },
    {
      itemType: "incident",
      priority: "critical",
      title: "Critical",
      description: "Test",
      actionOptions: ["fix"],
      createdAt: "2026-04-23T09:00:00.000Z",
      domainId: "test",
    },
  ];

  const original = [...items];
  sortAttentionQueue(items);

  assert.deepEqual(items, original);
});

test("sortAttentionQueue handles empty array", () => {
  const sorted = sortAttentionQueue([]);
  assert.deepEqual(sorted, []);
});

test("sortAttentionQueue handles single item", () => {
  const items: AttentionItem[] = [
    {
      itemType: "incident",
      priority: "normal",
      title: "Single Item",
      description: "Only one",
      actionOptions: ["fix"],
      createdAt: "2026-04-23T10:00:00.000Z",
      domainId: "test",
    },
  ];

  const sorted = sortAttentionQueue(items);
  assert.equal(sorted.length, 1);
  assert.equal(sorted[0]?.title, "Single Item");
});
