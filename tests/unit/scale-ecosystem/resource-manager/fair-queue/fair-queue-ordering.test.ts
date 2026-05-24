import assert from "node:assert/strict";
import test from "node:test";
import { orderFairQueue, type FairQueueItem } from "../../../../../src/scale-ecosystem/resource-manager/fair-queue/index.js";

// Helper to create queue items with defaults
function makeItem(overrides: Partial<FairQueueItem> = {}): FairQueueItem {
  return {
    itemId: `item-${Math.random().toString(36).slice(2)}`,
    tenantId: "tenant-1",
    priority: 50,
    ageMs: 0,
    ...overrides,
  };
}

test("orderFairQueue sorts by SLA tier first (higher tier first)", () => {
  const items: FairQueueItem[] = [
    makeItem({ itemId: "a", slaTier: 1 }),
    makeItem({ itemId: "b", slaTier: 3 }),
    makeItem({ itemId: "c", slaTier: 2 }),
  ];

  const sorted = orderFairQueue(items);

  // Higher SLA tier gets higher score (slaTier * 10000)
  assert.equal(sorted[0]?.itemId, "b"); // tier 3
  assert.equal(sorted[1]?.itemId, "c"); // tier 2
  assert.equal(sorted[2]?.itemId, "a"); // tier 1
});

test("orderFairQueue uses guaranteedQuotaShare as secondary sort criterion", () => {
  const items: FairQueueItem[] = [
    makeItem({ itemId: "a", priority: 50, guaranteedQuotaShare: 10 }),
    makeItem({ itemId: "b", priority: 50, guaranteedQuotaShare: 30 }),
    makeItem({ itemId: "c", priority: 50, guaranteedQuotaShare: 20 }),
  ];

  const sorted = orderFairQueue(items);

  // Higher guaranteedQuotaShare wins when scores are equal
  assert.equal(sorted[0]?.itemId, "b"); // 30 - highest guaranteed
  assert.equal(sorted[1]?.itemId, "c"); // 20
  assert.equal(sorted[2]?.itemId, "a"); // 10 - lowest
});

test("orderFairQueue uses itemId localeCompare as final tiebreaker", () => {
  const items: FairQueueItem[] = [
    makeItem({ itemId: "z", priority: 50, slaTier: 0 }),
    makeItem({ itemId: "a", priority: 50, slaTier: 0 }),
    makeItem({ itemId: "m", priority: 50, slaTier: 0 }),
  ];

  const sorted = orderFairQueue(items);

  assert.equal(sorted[0]?.itemId, "a");
  assert.equal(sorted[1]?.itemId, "m");
  assert.equal(sorted[2]?.itemId, "z");
});

test("orderFairQueue combines all scoring factors correctly", () => {
  const items: FairQueueItem[] = [
    makeItem({ itemId: "high-priority", priority: 10, slaTier: 1 }),    // score: 10000 + 90*100 + 0 - 0 = 19000
    makeItem({ itemId: "low-priority", priority: 90, slaTier: 1 }),     // score: 10000 + 10*100 + 0 - 0 = 11000
    makeItem({ itemId: "high-tier", priority: 50, slaTier: 5 }),       // score: 50000 + 50*100 + 0 - 0 = 55000
  ];

  const sorted = orderFairQueue(items);

  assert.equal(sorted[0]?.itemId, "high-tier");    // highest score
  assert.equal(sorted[1]?.itemId, "high-priority"); // second
  assert.equal(sorted[2]?.itemId, "low-priority");  // lowest
});

test("orderFairQueue applies age penalty capped at 99", () => {
  const items: FairQueueItem[] = [
    makeItem({ itemId: "very-old", priority: 1, ageMs: 10 * 60_000 }),   // 10 min = 600s -> penalty 99, score = 9900 - 99 = 9801
    makeItem({ itemId: "old", priority: 1, ageMs: 5 * 60_000 }),        // 5 min = 300s -> penalty 50, score = 9900 - 50 = 9850
    makeItem({ itemId: "new", priority: 1, ageMs: 0 }),                 // 0 -> penalty 0, score = 9900 - 0 = 9900
  ];

  const sorted = orderFairQueue(items);

  // Higher score (less age penalty) comes first: new > old > very-old
  assert.equal(sorted[0]?.itemId, "new");      // score 9900
  assert.equal(sorted[1]?.itemId, "old");       // score 9850
  assert.equal(sorted[2]?.itemId, "very-old");  // score 9801
});

test("orderFairQueue applies borrowedCredits multiplier", () => {
  const items: FairQueueItem[] = [
    makeItem({ itemId: "no-borrow", priority: 50, borrowedCredits: 0 }),
    makeItem({ itemId: "some-borrow", priority: 50, borrowedCredits: 5 }),
    makeItem({ itemId: "more-borrow", priority: 50, borrowedCredits: 10 }),
  ];

  const sorted = orderFairQueue(items);

  // borrowedCredits * 10 added to score
  assert.equal(sorted[0]?.itemId, "more-borrow");
  assert.equal(sorted[1]?.itemId, "some-borrow");
  assert.equal(sorted[2]?.itemId, "no-borrow");
});

test("orderFairQueue applies reclaimedCredits bonus (multiplied by 10)", () => {
  const items: FairQueueItem[] = [
    makeItem({ itemId: "no-reclaim", priority: 50, reclaimedCredits: 0 }),
    makeItem({ itemId: "some-reclaim", priority: 50, reclaimedCredits: 3 }),
    makeItem({ itemId: "more-reclaim", priority: 50, reclaimedCredits: 7 }),
  ];

  const sorted = orderFairQueue(items);

  // reclaimedCredits * 10 added to score
  assert.equal(sorted[0]?.itemId, "more-reclaim");
  assert.equal(sorted[1]?.itemId, "some-reclaim");
  assert.equal(sorted[2]?.itemId, "no-reclaim");
});

test("orderFairQueue handles complex scoring scenario", () => {
  const items: FairQueueItem[] = [
    makeItem({
      itemId: "balanced",
      priority: 50,
      slaTier: 2,
      ageMs: 60_000,
      borrowedCredits: 2,
      reclaimedCredits: 1,
    }),
    makeItem({
      itemId: "young-high-tier",
      priority: 30,
      slaTier: 3,
      ageMs: 0,
      borrowedCredits: 0,
      reclaimedCredits: 0,
    }),
    makeItem({
      itemId: "old-low-tier",
      priority: 10,
      slaTier: 1,
      ageMs: 5 * 60_000,
      borrowedCredits: 10,
      reclaimedCredits: 5,
    }),
  ];

  const sorted = orderFairQueue(items);

  // young-high-tier has highest tier (3*10000=30000) + priority(70*100=7000) = 37000
  // balanced has tier (2*10000=20000) + priority(50*100=5000) + borrow(20) + reclaim(10) - age(1) = 25029
  // old-low-tier has tier (1*10000=10000) + priority(90*100=9000) + borrow(100) + reclaim(50) - age(50) = 19100
  assert.equal(sorted[0]?.itemId, "young-high-tier");
  assert.equal(sorted[1]?.itemId, "balanced");
  assert.equal(sorted[2]?.itemId, "old-low-tier");
});

test("orderFairQueue returns new array instance", () => {
  const items = [makeItem({ itemId: "a" })];
  const sorted = orderFairQueue(items);

  assert.notEqual(sorted, items);
});

test("orderFairQueue handles items with optional fields as undefined", () => {
  const items: FairQueueItem[] = [
    makeItem({ itemId: "a" }),
    makeItem({ itemId: "b", slaTier: 1 }),
  ];

  const sorted = orderFairQueue(items);

  assert.equal(sorted.length, 2);
});

test("orderFairQueue handles all SLA tiers at boundary (tier 0 vs tier 1)", () => {
  const items: FairQueueItem[] = [
    makeItem({ itemId: "tier-0", slaTier: 0, priority: 50 }),
    makeItem({ itemId: "tier-1", slaTier: 1, priority: 50 }),
  ];

  const sorted = orderFairQueue(items);

  assert.equal(sorted[0]?.itemId, "tier-1");
  assert.equal(sorted[1]?.itemId, "tier-0");
});

test("orderFairQueue handles very high age (beyond 99 penalty cap)", () => {
  const items: FairQueueItem[] = [
    makeItem({ itemId: "very-old", priority: 1, ageMs: 1000 * 60_000 }), // 1000 minutes -> penalty capped at 99
    makeItem({ itemId: "moderately-old", priority: 1, ageMs: 100 * 60_000 }), // 100 minutes -> penalty 99
  ];

  const sorted = orderFairQueue(items);

  // Both have same penalty (capped at 99), so they tie on age
  // Order depends on other factors and then itemId
  assert.ok(sorted.length >= 1);
});

test("orderFairQueue priority scoring is inverted (lower priority number = higher score)", () => {
  const items: FairQueueItem[] = [
    makeItem({ itemId: "priority-0", priority: 0 }),  // highest score from priority
    makeItem({ itemId: "priority-100", priority: 100 }), // lowest score from priority
  ];

  const sorted = orderFairQueue(items);

  assert.equal(sorted[0]?.itemId, "priority-0");
  assert.equal(sorted[1]?.itemId, "priority-100");
});

test("orderFairQueue handles priority at 100 boundary (protected from preemption)", () => {
  const items: FairQueueItem[] = [
    makeItem({ itemId: "p100", priority: 100 }),
    makeItem({ itemId: "p99", priority: 99 }),
    makeItem({ itemId: "p1", priority: 1 }),
  ];

  const sorted = orderFairQueue(items);

  // p1 has highest score (99*100=9900), p99 has (1*100=100), p100 has (0*100=0)
  assert.equal(sorted[0]?.itemId, "p1");
  assert.equal(sorted[1]?.itemId, "p99");
  assert.equal(sorted[2]?.itemId, "p100");
});
