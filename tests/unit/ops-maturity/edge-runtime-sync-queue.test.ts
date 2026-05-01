import assert from "node:assert/strict";
import test from "node:test";
import {
  orderEdgeSyncQueue,
  validateSyncQueueChain,
  dedupeEdgeSyncQueue,
  type EdgeSyncEnvelope,
} from "../../../src/ops-maturity/edge-runtime/sync-queue/index.js";

test("orderEdgeSyncQueue sorts by priority desc, then sequence_no asc", () => {
  const items: EdgeSyncEnvelope[] = [
    {
      envelopeId: "env_1",
      device_id: "device_a",
      sequence_no: 1,
      priority: 1,
      createdAt: "2026-04-20T00:00:00.000Z",
      local_time_offset: 0,
      prev_hash: null,
      side_effect_dependency_refs: [],
      signature: "sig_1",
    },
    {
      envelopeId: "env_2",
      device_id: "device_a",
      sequence_no: 2,
      priority: 10,
      createdAt: "2026-04-20T00:00:01.000Z",
      local_time_offset: 0,
      prev_hash: "hash_prev",
      side_effect_dependency_refs: [],
      signature: "sig_2",
    },
    {
      envelopeId: "env_3",
      device_id: "device_a",
      sequence_no: 1,
      priority: 5,
      createdAt: "2026-04-20T00:00:00.500Z",
      local_time_offset: 0,
      prev_hash: null,
      side_effect_dependency_refs: [],
      signature: "sig_3",
    },
  ];

  const ordered = orderEdgeSyncQueue(items);

  // Highest priority (10) first, then priority 5, then priority 1
  assert.strictEqual(ordered[0]?.envelopeId, "env_2");
  assert.strictEqual(ordered[1]?.envelopeId, "env_3");
  assert.strictEqual(ordered[2]?.envelopeId, "env_1");
});

test("orderEdgeSyncQueue handles empty array", () => {
  const ordered = orderEdgeSyncQueue([]);
  assert.deepStrictEqual(ordered, []);
});

test("orderEdgeSyncQueue handles single item", () => {
  const items: EdgeSyncEnvelope[] = [
    {
      envelopeId: "env_1",
      device_id: "device_a",
      sequence_no: 1,
      priority: 1,
      createdAt: "2026-04-20T00:00:00.000Z",
      local_time_offset: 0,
      prev_hash: null,
      side_effect_dependency_refs: [],
      signature: "sig_1",
    },
  ];

  const ordered = orderEdgeSyncQueue(items);
  assert.strictEqual(ordered.length, 1);
  assert.strictEqual(ordered[0]?.envelopeId, "env_1");
});

test("validateSyncQueueChain returns valid for empty chain", () => {
  const result = validateSyncQueueChain([]);
  assert.strictEqual(result.valid, true);
  assert.deepStrictEqual(result.errors, []);
  assert.deepStrictEqual(result.topologicalOrder, []);
});

test("validateSyncQueueChain detects first item without null prev_hash", () => {
  const items: EdgeSyncEnvelope[] = [
    {
      envelopeId: "env_1",
      device_id: "device_a",
      sequence_no: 1,
      priority: 1,
      createdAt: "2026-04-20T00:00:00.000Z",
      local_time_offset: 0,
      prev_hash: "some_hash", // Should be null for first item
      side_effect_dependency_refs: [],
      signature: "sig_1",
    },
  ];

  const result = validateSyncQueueChain(items);
  assert.strictEqual(result.valid, false);
  assert.ok(result.errors[0]?.includes("first_item_must_have_null_prev_hash"));
});

test("validateSyncQueueChain detects missing dependency", () => {
  const items: EdgeSyncEnvelope[] = [
    {
      envelopeId: "env_1",
      device_id: "device_a",
      sequence_no: 1,
      priority: 1,
      createdAt: "2026-04-20T00:00:00.000Z",
      local_time_offset: 0,
      prev_hash: null,
      side_effect_dependency_refs: [],
      signature: "sig_1",
    },
    {
      envelopeId: "env_2",
      device_id: "device_a",
      sequence_no: 2,
      priority: 1,
      createdAt: "2026-04-20T00:00:01.000Z",
      local_time_offset: 0,
      prev_hash: "env_1:1:2026-04-20T00:00:00.000Z",
      side_effect_dependency_refs: ["non_existent_env"], // Missing dependency
      signature: "sig_2",
    },
  ];

  const result = validateSyncQueueChain(items);
  assert.strictEqual(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("missing_dependency")));
});

test("validateSyncQueueChain validates correct chain", () => {
  const items: EdgeSyncEnvelope[] = [
    {
      envelopeId: "env_1",
      device_id: "device_a",
      sequence_no: 1,
      priority: 1,
      createdAt: "2026-04-20T00:00:00.000Z",
      local_time_offset: 0,
      prev_hash: null,
      side_effect_dependency_refs: [],
      signature: "sig_1",
    },
    {
      envelopeId: "env_2",
      device_id: "device_a",
      sequence_no: 2,
      priority: 1,
      createdAt: "2026-04-20T00:00:01.000Z",
      local_time_offset: 0,
      prev_hash: "env_1:1:2026-04-20T00:00:00.000Z",
      side_effect_dependency_refs: [],
      signature: "sig_2",
    },
  ];

  const result = validateSyncQueueChain(items);
  assert.strictEqual(result.valid, true);
  assert.deepStrictEqual(result.errors, []);
  assert.strictEqual(result.topologicalOrder.length, 2);
});

test("dedupeEdgeSyncQueue keeps latest envelope by id", () => {
  const items: EdgeSyncEnvelope[] = [
    {
      envelopeId: "env_1",
      device_id: "device_a",
      sequence_no: 1,
      priority: 1,
      createdAt: "2026-04-20T00:00:00.000Z",
      local_time_offset: 0,
      prev_hash: null,
      side_effect_dependency_refs: [],
      signature: "sig_1_old",
    },
    {
      envelopeId: "env_1",
      device_id: "device_a",
      sequence_no: 2,
      priority: 1,
      createdAt: "2026-04-20T00:00:02.000Z",
      local_time_offset: 0,
      prev_hash: null,
      side_effect_dependency_refs: [],
      signature: "sig_1_new",
    },
  ];

  const deduped = dedupeEdgeSyncQueue(items);
  assert.strictEqual(deduped.length, 1);
  assert.strictEqual(deduped[0]?.signature, "sig_1_new");
});