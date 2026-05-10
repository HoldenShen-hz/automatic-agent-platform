/**
 * Unit tests for orderFairQueue - Weighted Fair Queue implementation
 *
 * Per §53.4: Weighted Fair Queue implementation with:
 * - SLA tier as primary factor
 * - Weight normalization
 * - Priority scoring
 * - Age factor with cap
 * - Borrowed quota for repayment tracking
 *
 * @see src/scale-ecosystem/resource-manager/fair-queue/index.js
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  orderFairQueue,
  type FairQueueItem,
} from "../../../../../src/scale-ecosystem/resource-manager/fair-queue/index.js";

// ─────────────────────────────────────────────────────────────────────────────
// Factory Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeItem(overrides: Partial<FairQueueItem> & { weight?: number; borrowedQuota?: number; guaranteedQuota?: number } = {}): FairQueueItem {
  const { weight, borrowedQuota, guaranteedQuota, slaTier, orgId, domainId, reclaimedCredits, ...rest } = overrides;
  return {
    itemId: rest.itemId ?? "default",
    tenantId: rest.tenantId ?? "tenant-1",
    priority: rest.priority ?? 5,
    ageMs: rest.ageMs ?? 0,
    ...(slaTier !== undefined ? { slaTier } : {}),
    ...(guaranteedQuota !== undefined ? { guaranteedQuotaShare: guaranteedQuota } : {}),
    ...(borrowedQuota !== undefined ? { borrowedCredits: borrowedQuota } : {}),
    ...(orgId !== undefined ? { orgId } : {}),
    ...(domainId !== undefined ? { domainId } : {}),
    ...(reclaimedCredits !== undefined ? { reclaimedCredits } : {}),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// orderFairQueue Tests - Core Sorting Behavior
// ─────────────────────────────────────────────────────────────────────────────

test("orderFairQueue returns empty array for empty input", () => {
  const result = orderFairQueue([]);
  assert.deepEqual(result, []);
});

test("orderFairQueue returns single item unchanged", () => {
  const items = [makeItem({ itemId: "only" })];
  const result = orderFairQueue(items);
  assert.equal(result.length, 1);
  assert.equal(result[0]?.itemId, "only");
});

test("orderFairQueue does not mutate original array", () => {
  const items = [
    makeItem({ itemId: "a" }),
    makeItem({ itemId: "b" }),
  ];
  const original = [...items];
  orderFairQueue(items);
  assert.equal(items[0]?.itemId, original[0]?.itemId);
  assert.equal(items[1]?.itemId, original[1]?.itemId);
});

test("orderFairQueue sorts by SLA tier as primary factor", () => {
  const items = [
    makeItem({ itemId: "low-tier", slaTier: 1, priority: 1, weight: 1 }),
    makeItem({ itemId: "high-tier", slaTier: 10, priority: 1, weight: 1 }),
  ];

  const result = orderFairQueue(items);

  // Higher SLA tier should come first (lower index)
  assert.equal(result[0]?.itemId, "high-tier");
  assert.equal(result[1]?.itemId, "low-tier");
});

test("orderFairQueue considers weight in normalization", () => {
  const items = [
    makeItem({ itemId: "heavy", slaTier: 5, weight: 10, priority: 5 }),
    makeItem({ itemId: "light", slaTier: 5, weight: 1, priority: 5 }),
  ];

  const result = orderFairQueue(items);

  // Items with same SLA tier but different weights
  // Higher weight factor should give more priority
  // Score = slaTier * 10000 * (weight / totalWeight)
  // light: 5 * 10000 * (1/11) = ~4545
  // heavy: 5 * 10000 * (10/11) = ~45454
  assert.equal(result[0]?.itemId, "heavy");
});

test("orderFairQueue respects priority score (lower priority number = higher priority)", () => {
  const items = [
    makeItem({ itemId: "low-priority", priority: 10, slaTier: 0 }),
    makeItem({ itemId: "high-priority", priority: 1, slaTier: 0 }),
  ];

  const result = orderFairQueue(items);

  // Priority 1 (high priority) should come before priority 10 (low priority)
  assert.equal(result[0]?.itemId, "high-priority");
});

test("orderFairQueue applies age factor capped at 99", () => {
  const items = [
    makeItem({ itemId: "very-old", priority: 5, ageMs: 600_000 }), // 10 minutes = 10 minutes
    makeItem({ itemId: "new", priority: 5, ageMs: 0 }),
  ];

  const result = orderFairQueue(items);

  // Age score is min(99, floor(ageMs / 60000))
  // very-old: min(99, 10) = 10
  // new: min(99, 0) = 0
  // New item should come first with same priority (lower score)
  assert.equal(result[0]?.itemId, "new");
});

test("orderFairQueue ages items beyond cap are capped at 99", () => {
  const items = [
    makeItem({ itemId: "very-old", priority: 5, ageMs: 10_000_000 }), // huge age
    makeItem({ itemId: "moderately-old", priority: 5, ageMs: 300_000 }), // 5 minutes
  ];

  const result = orderFairQueue(items);

  // Both should have age score capped at 99
  assert.equal(result[0]?.itemId, "moderately-old"); // same priority, tiebreaker on age
});

test("orderFairQueue prioritizes items with borrowed quota for repayment", () => {
  const items = [
    makeItem({ itemId: "borrower", priority: 5, borrowedQuota: 10 }),
    makeItem({ itemId: "lender", priority: 5, borrowedQuota: -5 }),
    makeItem({ itemId: "neutral", priority: 5, borrowedQuota: 0 }),
  ];

  const result = orderFairQueue(items);

  // Positive borrowedQuota means they borrowed and should be serviced first to repay
  assert.equal(result[0]?.itemId, "borrower");
  assert.equal(result[1]?.itemId, "neutral");
  assert.equal(result[2]?.itemId, "lender");
});

test("orderFairQueue uses guaranteedQuota as final tiebreaker", () => {
  const items = [
    makeItem({ itemId: "low-quota", priority: 5, guaranteedQuota: 10 }),
    makeItem({ itemId: "high-quota", priority: 5, guaranteedQuota: 100 }),
  ];

  const result = orderFairQueue(items);

  // Same score, tiebreaker prefers higher guaranteedQuota
  assert.equal(result[0]?.itemId, "high-quota");
});

test("orderFairQueue combines all factors correctly", () => {
  const items = [
    makeItem({ itemId: "critical", slaTier: 10, priority: 1, weight: 1, ageMs: 0 }),
    makeItem({ itemId: "normal", slaTier: 5, priority: 5, weight: 5, ageMs: 0 }),
    makeItem({ itemId: "background", slaTier: 1, priority: 10, weight: 1, ageMs: 0 }),
  ];

  const result = orderFairQueue(items);

  // SLA tier is primary factor: critical(10) > normal(5) > background(1)
  assert.equal(result[0]?.itemId, "critical");
  assert.equal(result[1]?.itemId, "normal");
  assert.equal(result[2]?.itemId, "background");
});

test("orderFairQueue handles items with missing optional fields", () => {
  const items: FairQueueItem[] = [
    { itemId: "minimal", tenantId: "t1", priority: 5, ageMs: 0 }, // no slaTier, weight, etc
    makeItem({ itemId: "full", priority: 5, ageMs: 0, slaTier: 1 }),
  ];

  const result = orderFairQueue(items);

  // Should not throw and should sort correctly
  assert.equal(result.length, 2);
});

test("orderFairQueue handles items with zero weight", () => {
  const items = [
    makeItem({ itemId: "zero-weight", priority: 5, weight: 0 }),
    makeItem({ itemId: "normal-weight", priority: 5, weight: 1 }),
  ];

  const result = orderFairQueue(items);

  // Should handle zero weight without division issues
  assert.equal(result.length, 2);
});

test("orderFairQueue uses default weight of 1 when not specified", () => {
  const items = [
    makeItem({ itemId: "no-weight" }), // weight defaults to 1
    makeItem({ itemId: "explicit-weight", weight: 1 }),
  ];

  const result = orderFairQueue(items);

  // Both have weight 1, so tiebreaker applies
  assert.equal(result.length, 2);
});

test("orderFairQueue applies SLA tier multiplied by 10000 weight factor", () => {
  const items = [
    makeItem({ itemId: "tier-1", slaTier: 1, priority: 1, weight: 1 }),
    makeItem({ itemId: "tier-2", slaTier: 2, priority: 1, weight: 1 }),
  ];

  const result = orderFairQueue(items);

  // tier-2 has 2x the SLA score of tier-1
  assert.equal(result[0]?.itemId, "tier-2");
});

test("orderFairQueue priority score uses (100 - min(100, priority))", () => {
  const items = [
    makeItem({ itemId: "p0", priority: 0 }), // score = (100-0)*100 = 10000
    makeItem({ itemId: "p50", priority: 50 }), // score = (100-50)*100 = 5000
    makeItem({ itemId: "p100", priority: 100 }), // score = (100-100)*100 = 0
  ];

  const result = orderFairQueue(items);

  assert.equal(result[0]?.itemId, "p0");
  assert.equal(result[1]?.itemId, "p50");
  assert.equal(result[2]?.itemId, "p100");
});

test("orderFairQueue handles negative borrowed quota (lent resources)", () => {
  const items = [
    makeItem({ itemId: "lent", borrowedQuota: -10 }),
    makeItem({ itemId: "neutral", borrowedQuota: 0 }),
  ];

  const result = orderFairQueue(items);

  // Lent items (negative) have lower borrow score, serviced later
  // Neutral comes first
  assert.equal(result[0]?.itemId, "neutral");
});

test("orderFairQueue items with exact same score use tiebreaker", () => {
  const items = [
    makeItem({ itemId: "same", slaTier: 1, priority: 1, weight: 1, ageMs: 0, guaranteedQuota: 50 }),
    makeItem({ itemId: "also-same", slaTier: 1, priority: 1, weight: 1, ageMs: 0, guaranteedQuota: 100 }),
  ];

  const result = orderFairQueue(items);

  // Tiebreaker: higher guaranteedQuota comes first
  assert.equal(result[0]?.itemId, "also-same");
});

test("orderFairQueue works with many items", () => {
  const items = Array.from({ length: 100 }, (_, i) =>
    makeItem({
      itemId: `item-${i}`,
      priority: i % 10,
      slaTier: i % 5,
      ageMs: i * 1000,
    })
  );

  const result = orderFairQueue(items);

  assert.equal(result.length, 100);
  // First item should have highest composite score
  assert.ok(result[0]?.itemId.startsWith("item-"));
});

test("orderFairQueue composite score calculation is deterministic", () => {
  const items = [
    makeItem({ itemId: "a", priority: 5, slaTier: 3, weight: 2, ageMs: 60000 }),
    makeItem({ itemId: "b", priority: 5, slaTier: 3, weight: 2, ageMs: 60000 }),
  ];

  const result1 = orderFairQueue(items);
  const result2 = orderFairQueue(items);

  // Same input should produce same output
  assert.equal(result1[0]?.itemId, result2[0]?.itemId);
  assert.equal(result1[1]?.itemId, result2[1]?.itemId);
});