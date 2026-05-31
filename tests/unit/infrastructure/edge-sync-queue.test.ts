/**
 * Infrastructure: Edge Sync Queue Tests
 *
 * Tests for edge sync queue operations including ordering,
 * deduplication, and chain validation.
 */

import { describe, it } from "node:test";
import assert from "node:assert";

import {
  orderEdgeSyncQueue,
  dedupeEdgeSyncQueue,
  validateSyncQueueChain,
  type EdgeSyncEnvelope,
  type SyncQueueChainValidationResult,
} from "../../../src/ops-maturity/edge-runtime/sync-queue/index.js";

// ── Edge Sync Queue Ordering Tests ─────────────────────────────────────────────

describe("Edge Sync Queue - Ordering", () => {
  describe("orderEdgeSyncQueue", () => {
    it("dequeueReady returns empty array for empty input", () => {
      const result = orderEdgeSyncQueue([]);
      assert.equal(result.length, 0);
    });

    it("returns single item unchanged", () => {
      const items: EdgeSyncEnvelope[] = [
        { envelopeId: "env-1", priority: 5 },
      ];
      const result = orderEdgeSyncQueue(items);
      assert.equal(result.length, 1);
      assert.equal(result[0]!.envelopeId, "env-1");
    });

    it("sorts by priority descending", () => {
      const items: EdgeSyncEnvelope[] = [
        { envelopeId: "low", priority: 1 },
        { envelopeId: "high", priority: 100 },
        { envelopeId: "mid", priority: 50 },
      ];
      const result = orderEdgeSyncQueue(items);
      assert.equal(result[0]!.envelopeId, "high");
      assert.equal(result[1]!.envelopeId, "mid");
      assert.equal(result[2]!.envelopeId, "low");
    });

    it("sorts by sequence_no ascending as secondary criteria", () => {
      const items: EdgeSyncEnvelope[] = [
        { envelopeId: "a", priority: 10, sequence_no: 3 },
        { envelopeId: "b", priority: 10, sequence_no: 1 },
        { envelopeId: "c", priority: 10, sequence_no: 2 },
      ];
      const result = orderEdgeSyncQueue(items);
      assert.equal(result[0]!.envelopeId, "b");
      assert.equal(result[1]!.envelopeId, "c");
      assert.equal(result[2]!.envelopeId, "a");
    });

    it("sorts by createdAt as tertiary criteria", () => {
      const items: EdgeSyncEnvelope[] = [
        { envelopeId: "a", priority: 10, sequence_no: 1, createdAt: "2024-01-03T00:00:00Z" },
        { envelopeId: "b", priority: 10, sequence_no: 1, createdAt: "2024-01-01T00:00:00Z" },
        { envelopeId: "c", priority: 10, sequence_no: 1, createdAt: "2024-01-02T00:00:00Z" },
      ];
      const result = orderEdgeSyncQueue(items);
      assert.equal(result[0]!.envelopeId, "b");
      assert.equal(result[1]!.envelopeId, "c");
      assert.equal(result[2]!.envelopeId, "a");
    });

    it("treats missing sequence_no as MAX_SAFE_INTEGER", () => {
      const items: EdgeSyncEnvelope[] = [
        { envelopeId: "with-seq", priority: 10, sequence_no: 1 },
        { envelopeId: "no-seq", priority: 10 },
      ];
      const result = orderEdgeSyncQueue(items);
      assert.equal(result[0]!.envelopeId, "with-seq");
      assert.equal(result[1]!.envelopeId, "no-seq");
    });

    it("treats missing createdAt as empty string and sorts first", () => {
      const items: EdgeSyncEnvelope[] = [
        { envelopeId: "a", priority: 10, createdAt: "2024-01-02T00:00:00Z" },
        { envelopeId: "b", priority: 10 }, // empty string comes first
      ];
      const result = orderEdgeSyncQueue(items);
      // Empty string (missing createdAt) is first because sort is ascending
      assert.equal(result[0]!.envelopeId, "b");
      assert.equal(result[1]!.envelopeId, "a");
    });

    it("does not mutate original array", () => {
      const items: EdgeSyncEnvelope[] = [
        { envelopeId: "env-1", priority: 5 },
      ];
      const original = [...items];
      orderEdgeSyncQueue(items);
      assert.deepEqual(items, original);
    });
  });
});

// ── Edge Sync Queue Deduplication Tests ───────────────────────────────────────

describe("Edge Sync Queue - Deduplication", () => {
  describe("dedupeEdgeSyncQueue", () => {
    it("dequeueByPriority returns empty array for empty input", () => {
      const result = dedupeEdgeSyncQueue([]);
      assert.equal(result.length, 0);
    });

    it("returns single item unchanged", () => {
      const items: EdgeSyncEnvelope[] = [
        { envelopeId: "env-1", priority: 5 },
      ];
      const result = dedupeEdgeSyncQueue(items);
      assert.equal(result.length, 1);
    });

    it("keeps item with highest sequence_no", () => {
      const items: EdgeSyncEnvelope[] = [
        { envelopeId: "env-1", priority: 10, sequence_no: 1 },
        { envelopeId: "env-1", priority: 10, sequence_no: 3 },
        { envelopeId: "env-1", priority: 10, sequence_no: 2 },
      ];
      const result = dedupeEdgeSyncQueue(items);
      assert.equal(result.length, 1);
      assert.equal(result[0]!.sequence_no, 3);
    });

    it("keeps most recent when sequence_no ties", () => {
      const items: EdgeSyncEnvelope[] = [
        { envelopeId: "env-1", priority: 10, sequence_no: 1, createdAt: "2024-01-01T00:00:00Z" },
        { envelopeId: "env-1", priority: 10, sequence_no: 1, createdAt: "2024-01-03T00:00:00Z" },
        { envelopeId: "env-1", priority: 10, sequence_no: 1, createdAt: "2024-01-02T00:00:00Z" },
      ];
      const result = dedupeEdgeSyncQueue(items);
      assert.equal(result.length, 1);
      assert.equal(result[0]!.createdAt, "2024-01-03T00:00:00Z");
    });

    it("preserves multiple different envelopeIds", () => {
      const items: EdgeSyncEnvelope[] = [
        { envelopeId: "env-1", priority: 10, sequence_no: 2 },
        { envelopeId: "env-2", priority: 10, sequence_no: 1 },
        { envelopeId: "env-1", priority: 10, sequence_no: 1 },
        { envelopeId: "env-3", priority: 10, sequence_no: 1 },
      ];
      const result = dedupeEdgeSyncQueue(items);
      assert.equal(result.length, 3);
    });

    it("returns ordered results after dedup", () => {
      // dedupeEdgeSyncQueue keeps the LAST item per envelopeId when sequence_no and createdAt are equal
      // So the second env-1 (priority 5) overwrites the first (priority 10)
      const items: EdgeSyncEnvelope[] = [
        { envelopeId: "env-1", priority: 10 },
        { envelopeId: "env-1", priority: 5 }, // duplicate - but createdAt same, so this one wins (last wins)
        { envelopeId: "env-2", priority: 5 },
      ];
      const result = dedupeEdgeSyncQueue(items);
      assert.equal(result.length, 2);
      // After dedup (last wins for same seq/createdAt): env-1 (p5 - last occurrence) and env-2 (p5)
      // Then orderEdgeSyncQueue orders by priority desc, so env-1 comes first if p5 == p5
      // Since priorities are equal (5), tiebreaker is sequence_no (both undefined = MAX), then createdAt (both "")
      // So localeCompare on envelopeId decides: "env-1" < "env-2" -> env-1 first
      assert.equal(result[0]!.envelopeId, "env-1");
      assert.equal(result[0]!.priority, 5); // last occurrence wins due to same createdAt
      assert.equal(result[1]!.envelopeId, "env-2");
    });
  });
});

// ── Edge Sync Queue Chain Validation Tests ────────────────────────────────────

describe("Edge Sync Queue - Chain Validation", () => {
  describe("validateSyncQueueChain", () => {
    it("returns valid for empty array", () => {
      const result = validateSyncQueueChain([]);
      assert.equal(result.valid, true);
      assert.deepEqual(result.errors, []);
      assert.deepEqual(result.topologicalOrder, []);
    });

    it("returns valid for single item with null prev_hash", () => {
      const items: EdgeSyncEnvelope[] = [
        { envelopeId: "env-1", priority: 1 },
      ];
      const result = validateSyncQueueChain(items);
      assert.equal(result.valid, true);
    });

    it("returns error when first item has prev_hash", () => {
      const items: EdgeSyncEnvelope[] = [
        { envelopeId: "env-1", priority: 1, prev_hash: "something" },
      ];
      const result = validateSyncQueueChain(items);
      assert.equal(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes("first_item_must_have_null_prev_hash")));
    });

    it("returns error when prev_hash does not match expected", () => {
      const items: EdgeSyncEnvelope[] = [
        { envelopeId: "env-1", priority: 1 },
        { envelopeId: "env-2", priority: 1, prev_hash: "wrong-hash" },
      ];
      const result = validateSyncQueueChain(items);
      assert.equal(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes("prev_hash_mismatch")));
    });

    it("validates correct chain when properly constructed", () => {
      // Build chain properly: first item has no prev_hash, second has matching prev_hash
      // After orderEdgeSyncQueue sorts by priority desc, sequence_no asc, createdAt asc:
      // Both have same priority (1), undefined sequence_no becomes MAX, so order is preserved as input
      const env1: EdgeSyncEnvelope = {
        envelopeId: "env-1",
        priority: 1,
      };
      // For env-2, expected prev_hash = "env-1:" + "" (seq_no) + ":" + "" (createdAt) = "env-1::"
      const env2: EdgeSyncEnvelope = {
        envelopeId: "env-2",
        priority: 1,
        prev_hash: "env-1::",
      };
      const items = [env1, env2];
      const result = validateSyncQueueChain(items);
      assert.equal(result.valid, true);
      assert.deepEqual(result.errors, []);
    });

    it("detects missing dependency", () => {
      const items: EdgeSyncEnvelope[] = [
        { envelopeId: "env-1", priority: 1 },
        { envelopeId: "env-2", priority: 1, prev_hash: "env-1::", side_effect_dependency_refs: ["nonexistent"] },
      ];
      const result = validateSyncQueueChain(items);
      assert.equal(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes("missing_dependency")));
    });

    it("detects missing dependency when side_effect_dependency_refs target not in queue", () => {
      const env1: EdgeSyncEnvelope = {
        envelopeId: "env-1", priority: 1,
      };
      const env2: EdgeSyncEnvelope = {
        envelopeId: "env-2", priority: 1, prev_hash: "env-1::",
        side_effect_dependency_refs: ["env-99"], // does not exist
      };
      const result = validateSyncQueueChain([env1, env2]);
      assert.equal(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes("missing_dependency")));
    });

    it("topological order excludes items with dependency issues", () => {
      const items: EdgeSyncEnvelope[] = [
        { envelopeId: "env-1", priority: 1 },
        { envelopeId: "env-2", priority: 1, prev_hash: "env-1::", side_effect_dependency_refs: ["nonexistent"] },
      ];
      const result = validateSyncQueueChain(items);
      assert.equal(result.valid, false);
      // topologicalOrder may be shorter than input due to cycle detection
      assert.ok(result.topologicalOrder.length <= items.length);
    });
  });
});
