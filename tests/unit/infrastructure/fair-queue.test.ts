/**
 * Infrastructure: Fair Queue Tests
 *
 * Tests for fair queue ordering in multi-tenant resource management.
 */

import { describe, it } from "node:test";
import assert from "node:assert";

import {
  orderFairQueue,
  type FairQueueItem,
} from "../../../src/scale-ecosystem/resource-manager/fair-queue/index.js";

// ── Fair Queue Tests ───────────────────────────────────────────────────────────

describe("Fair Queue", () => {
  describe("orderFairQueue", () => {
    it("orderFairQueue returns empty array for empty input", () => {
      const result = orderFairQueue([]);
      assert.equal(result.length, 0);
    });

    it("returns single item unchanged", () => {
      const items: FairQueueItem[] = [
        {
          itemId: "item-1",
          tenantId: "tenant-1",
          priority: 5,
          ageMs: 1000,
        },
      ];
      const result = orderFairQueue(items);
      assert.equal(result.length, 1);
      assert.equal(result[0]!.itemId, "item-1");
    });

    it("sorts by fair share score descending", () => {
      const items: FairQueueItem[] = [
        { itemId: "high", tenantId: "t1", priority: 90, ageMs: 100 }, // lower score = later
        { itemId: "low", tenantId: "t2", priority: 10, ageMs: 100 },  // higher score = first
      ];
      const result = orderFairQueue(items);
      // Higher score (lower priority number) comes first
      assert.equal(result[0]!.itemId, "low");
      assert.equal(result[1]!.itemId, "high");
    });

    it("sorts by guaranteedQuotaShare when scores equal", () => {
      const items: FairQueueItem[] = [
        { itemId: "a", tenantId: "t1", priority: 50, ageMs: 100, guaranteedQuotaShare: 10 },
        { itemId: "b", tenantId: "t2", priority: 50, ageMs: 100, guaranteedQuotaShare: 20 },
      ];
      const result = orderFairQueue(items);
      // Higher guaranteedQuotaShare (20) should come first
      assert.equal(result[0]!.itemId, "b");
      assert.equal(result[1]!.itemId, "a");
    });

    it("sorts by itemId as final tiebreaker", () => {
      const items: FairQueueItem[] = [
        { itemId: "z-item", tenantId: "t1", priority: 50, ageMs: 100, guaranteedQuotaShare: 10 },
        { itemId: "a-item", tenantId: "t2", priority: 50, ageMs: 100, guaranteedQuotaShare: 10 },
      ];
      const result = orderFairQueue(items);
      assert.equal(result[0]!.itemId, "a-item");
      assert.equal(result[1]!.itemId, "z-item");
    });

    it("does not mutate original array", () => {
      const items: FairQueueItem[] = [
        { itemId: "item-1", tenantId: "t1", priority: 50, ageMs: 100 },
        { itemId: "item-2", tenantId: "t2", priority: 90, ageMs: 100 },
      ];
      const original = [...items];
      orderFairQueue(items);
      assert.deepEqual(items, original);
    });

    it("handles items with borrowed credits", () => {
      const items: FairQueueItem[] = [
        { itemId: "no-borrow", tenantId: "t1", priority: 50, ageMs: 100, borrowedCredits: 0 },
        { itemId: "borrowed", tenantId: "t2", priority: 50, ageMs: 100, borrowedCredits: 5 },
      ];
      const result = orderFairQueue(items);
      // Borrowed credits increase score, so borrowed item should come first
      assert.equal(result[0]!.itemId, "borrowed");
    });

    it("handles items with reclaimed credits", () => {
      const items: FairQueueItem[] = [
        { itemId: "no-reclaim", tenantId: "t1", priority: 50, ageMs: 100, reclaimedCredits: 0 },
        { itemId: "reclaimed", tenantId: "t2", priority: 50, ageMs: 100, reclaimedCredits: 3 },
      ];
      const result = orderFairQueue(items);
      // Reclaimed credits provide bonus, so reclaimed item should come first
      assert.equal(result[0]!.itemId, "reclaimed");
    });

    it("applies age penalty to score", () => {
      const items: FairQueueItem[] = [
        { itemId: "new", tenantId: "t1", priority: 50, ageMs: 100 }, // 1 minute = 1 penalty
        { itemId: "old", tenantId: "t2", priority: 50, ageMs: 60000 }, // 60 minutes = 60 penalty (capped at 99)
      ];
      const result = orderFairQueue(items);
      // Newer item (less age penalty) should come first
      assert.equal(result[0]!.itemId, "new");
    });

    it("handles items with different SLA tiers", () => {
      const items: FairQueueItem[] = [
        { itemId: "low-tier", tenantId: "t1", priority: 50, ageMs: 100, slaTier: 1 },
        { itemId: "high-tier", tenantId: "t2", priority: 50, ageMs: 100, slaTier: 5 },
      ];
      const result = orderFairQueue(items);
      // Higher SLA tier should come first (slaTier * 10000 in score)
      assert.equal(result[0]!.itemId, "high-tier");
    });

    it("handles optional orgId and domainId", () => {
      const items: FairQueueItem[] = [
        { itemId: "item-1", tenantId: "t1", orgId: "org-1", domainId: "domain-1", priority: 50, ageMs: 100 },
        { itemId: "item-2", tenantId: "t2", orgId: "org-2", domainId: "domain-2", priority: 50, ageMs: 100 },
      ];
      const result = orderFairQueue(items);
      assert.equal(result.length, 2);
      assert.equal(result[0]!.orgId, "org-1");
      assert.equal(result[1]!.orgId, "org-2");
    });
  });
});
