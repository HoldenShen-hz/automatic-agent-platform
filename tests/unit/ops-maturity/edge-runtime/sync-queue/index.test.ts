/**
 * Unit tests for sync-queue functions
 *
 * @see src/ops-maturity/edge-runtime/sync-queue/index.ts
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  orderEdgeSyncQueue,
  dedupeEdgeSyncQueue,
  type EdgeSyncEnvelope,
} from "../../../../../src/ops-maturity/edge-runtime/sync-queue/index.js";

function makeEnvelope(overrides: Partial<EdgeSyncEnvelope> & Pick<EdgeSyncEnvelope, "envelopeId" | "priority">): EdgeSyncEnvelope {
  return {
    envelopeId: overrides.envelopeId,
    device_id: overrides.device_id ?? "device-1",
    sequence_no: overrides.sequence_no ?? 1,
    priority: overrides.priority,
    createdAt: overrides.createdAt ?? "2026-04-20T00:00:00.000Z",
    local_time_offset: overrides.local_time_offset ?? 0,
    prev_hash: overrides.prev_hash ?? null,
    side_effect_dependency_refs: overrides.side_effect_dependency_refs ?? [],
    signature: overrides.signature ?? "sig-1",
  };
}

test.describe("sync-queue", () => {
  test.describe("orderEdgeSyncQueue", () => {
    test("sorts by priority descending", () => {
      const items: EdgeSyncEnvelope[] = [
        makeEnvelope({ envelopeId: "a", priority: 1, createdAt: "2026-04-20T00:00:00.000Z" }),
        makeEnvelope({ envelopeId: "b", priority: 5, createdAt: "2026-04-20T00:01:00.000Z" }),
        makeEnvelope({ envelopeId: "c", priority: 3, createdAt: "2026-04-20T00:02:00.000Z" }),
      ];

      const result = orderEdgeSyncQueue(items);

      assert.equal(result[0]?.envelopeId, "b"); // priority 5
      assert.equal(result[1]?.envelopeId, "c"); // priority 3
      assert.equal(result[2]?.envelopeId, "a"); // priority 1
    });

    test("sorts by createdAt ascending when priorities are equal", () => {
      const items: EdgeSyncEnvelope[] = [
        makeEnvelope({ envelopeId: "a", priority: 1, sequence_no: 3, createdAt: "2026-04-20T00:02:00.000Z" }),
        makeEnvelope({ envelopeId: "b", priority: 1, sequence_no: 1, createdAt: "2026-04-20T00:00:00.000Z" }),
        makeEnvelope({ envelopeId: "c", priority: 1, sequence_no: 2, createdAt: "2026-04-20T00:01:00.000Z" }),
      ];

      const result = orderEdgeSyncQueue(items);

      // Sorted by sequence_no ascending within same priority
      assert.equal(result[0]?.envelopeId, "b"); // sequence_no 1 (earliest)
      assert.equal(result[1]?.envelopeId, "c"); // sequence_no 2
      assert.equal(result[2]?.envelopeId, "a"); // sequence_no 3 (latest)
    });

    test("handles items with canonical required metadata", () => {
      const items: EdgeSyncEnvelope[] = [
        makeEnvelope({ envelopeId: "a", priority: 1, sequence_no: 2, createdAt: "2026-04-20T00:00:01.000Z" }),
        makeEnvelope({ envelopeId: "b", priority: 1, sequence_no: 1, createdAt: "2026-04-20T00:00:00.000Z" }),
      ];

      const result = orderEdgeSyncQueue(items);

      assert.equal(result.length, 2);
      // Sorted by sequence_no ascending
      assert.equal(result[0]?.envelopeId, "b"); // sequence_no 1 first
      assert.equal(result[1]?.envelopeId, "a"); // sequence_no 2 second
    });

    test("returns empty array for empty input", () => {
      const result = orderEdgeSyncQueue([]);
      assert.deepEqual(result, []);
    });

    test("does not mutate original array", () => {
      const items: EdgeSyncEnvelope[] = [
        makeEnvelope({ envelopeId: "a", priority: 2 }),
        makeEnvelope({ envelopeId: "b", priority: 1 }),
      ];
      const original = [...items];

      orderEdgeSyncQueue(items);

      assert.equal(items[0]?.envelopeId, original[0]?.envelopeId);
      assert.equal(items[1]?.envelopeId, original[1]?.envelopeId);
    });
  });

  test.describe("dedupeEdgeSyncQueue", () => {
    test("removes duplicate envelopes keeping the latest by createdAt", () => {
      const items: EdgeSyncEnvelope[] = [
        makeEnvelope({ envelopeId: "a", priority: 1, createdAt: "2026-04-20T00:00:00.000Z" }),
        makeEnvelope({ envelopeId: "a", priority: 2, createdAt: "2026-04-20T00:05:00.000Z" }),
        makeEnvelope({ envelopeId: "b", priority: 1, createdAt: "2026-04-20T00:02:00.000Z" }),
      ];

      const result = dedupeEdgeSyncQueue(items);

      assert.equal(result.length, 2);
      const aItem = result.find((item) => item.envelopeId === "a");
      assert.ok(aItem);
      assert.equal(aItem.priority, 2); // latest one preserved
    });

    test("removes duplicates when priorities differ", () => {
      const items: EdgeSyncEnvelope[] = [
        makeEnvelope({ envelopeId: "dup", priority: 1, createdAt: "2026-04-20T00:01:00.000Z" }),
        makeEnvelope({ envelopeId: "dup", priority: 3, createdAt: "2026-04-20T00:02:00.000Z" }),
        makeEnvelope({ envelopeId: "dup", priority: 2, createdAt: "2026-04-20T00:03:00.000Z" }),
      ];

      const result = dedupeEdgeSyncQueue(items);

      assert.equal(result.length, 1);
      assert.equal(result[0]?.envelopeId, "dup");
      assert.equal(result[0]?.priority, 2); // latest createdAt
    });

    test("returns empty array for empty input", () => {
      const result = dedupeEdgeSyncQueue([]);
      assert.deepEqual(result, []);
    });

    test("returns same items when no duplicates", () => {
      const items: EdgeSyncEnvelope[] = [
        makeEnvelope({ envelopeId: "a", priority: 1, createdAt: "2026-04-20T00:00:00.000Z" }),
        makeEnvelope({ envelopeId: "b", priority: 2, createdAt: "2026-04-20T00:01:00.000Z" }),
      ];

      const result = dedupeEdgeSyncQueue(items);

      assert.equal(result.length, 2);
    });

    test("orders results by priority after deduplication", () => {
      const items: EdgeSyncEnvelope[] = [
        makeEnvelope({ envelopeId: "low", priority: 1, createdAt: "2026-04-20T00:00:00.000Z" }),
        makeEnvelope({ envelopeId: "high", priority: 5, createdAt: "2026-04-20T00:00:00.000Z" }),
        makeEnvelope({ envelopeId: "dup", priority: 3, createdAt: "2026-04-20T00:01:00.000Z" }),
        makeEnvelope({ envelopeId: "dup", priority: 2, createdAt: "2026-04-20T00:02:00.000Z" }),
      ];

      const result = dedupeEdgeSyncQueue(items);

      assert.equal(result[0]?.envelopeId, "high"); // highest priority first
      assert.equal(result[1]?.envelopeId, "dup"); // deduped
      assert.equal(result[2]?.envelopeId, "low");
    });

    test("handles single item", () => {
      const items: EdgeSyncEnvelope[] = [
        makeEnvelope({ envelopeId: "only", priority: 1, createdAt: "2026-04-20T00:00:00.000Z" }),
      ];

      const result = dedupeEdgeSyncQueue(items);

      assert.equal(result.length, 1);
      assert.equal(result[0]?.envelopeId, "only");
    });
  });
});
