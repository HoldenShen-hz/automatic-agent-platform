import assert from "node:assert/strict";
import test from "node:test";
import { orderFairQueue, type FairQueueItem } from "../../../../../src/scale-ecosystem/resource-manager/fair-queue/index.js";

test("orderFairQueue sorts by priority and age score", () => {
  const items: FairQueueItem[] = [
    { itemId: "a", tenantId: "t1", priority: 1, ageMs: 0 },
    { itemId: "b", tenantId: "t1", priority: 3, ageMs: 0 },
    { itemId: "c", tenantId: "t2", priority: 2, ageMs: 120_000 },
  ];

  const sorted = orderFairQueue(items);

  assert.equal(sorted[0]?.itemId, "a");
  assert.equal(sorted[1]?.itemId, "c");
  assert.equal(sorted[2]?.itemId, "b");
});

test("orderFairQueue applies age penalty capped at 99", () => {
  const items: FairQueueItem[] = [
    { itemId: "old", tenantId: "t1", priority: 1, ageMs: 600_000 },
    { itemId: "new", tenantId: "t1", priority: 2, ageMs: 0 },
  ];

  const sorted = orderFairQueue(items);

  assert.equal(sorted[0]?.itemId, "old");
});

test("orderFairQueue handles empty array", () => {
  const sorted = orderFairQueue([]);
  assert.deepEqual(sorted, []);
});

test("orderFairQueue handles single item", () => {
  const items: FairQueueItem[] = [
    { itemId: "only", tenantId: "t1", priority: 5, ageMs: 1000 },
  ];

  const sorted = orderFairQueue(items);

  assert.equal(sorted.length, 1);
  assert.equal(sorted[0]?.itemId, "only");
});

test("orderFairQueue does not mutate original array", () => {
  const items: FairQueueItem[] = [
    { itemId: "a", tenantId: "t1", priority: 1, ageMs: 0 },
  ];

  orderFairQueue(items);

  assert.equal(items[0]?.itemId, "a");
});
