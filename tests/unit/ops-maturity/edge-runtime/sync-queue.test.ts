import assert from "node:assert/strict";
import test from "node:test";

import {
  orderEdgeSyncQueue,
  dedupeEdgeSyncQueue,
  type EdgeSyncEnvelope,
} from "../../../../src/ops-maturity/edge-runtime/sync-queue/index.js";

function makeEnvelope(overrides: Partial<EdgeSyncEnvelope> & Pick<EdgeSyncEnvelope, "envelopeId" | "priority">): EdgeSyncEnvelope {
  return {
    envelopeId: overrides.envelopeId,
    device_id: overrides.device_id ?? "device-sync",
    sequence_no: overrides.sequence_no ?? 1,
    priority: overrides.priority,
    createdAt: overrides.createdAt ?? "2026-04-25T10:00:00Z",
    local_time_offset: overrides.local_time_offset ?? 0,
    prev_hash: overrides.prev_hash ?? null,
    side_effect_dependency_refs: overrides.side_effect_dependency_refs ?? [],
    signature: overrides.signature ?? "sig-sync",
  };
}

test("orderEdgeSyncQueue sorts by priority descending", () => {
  const items: EdgeSyncEnvelope[] = [
    makeEnvelope({ envelopeId: "a", priority: 1 }),
    makeEnvelope({ envelopeId: "b", priority: 3 }),
    makeEnvelope({ envelopeId: "c", priority: 2 }),
  ];

  const ordered = orderEdgeSyncQueue(items);

  assert.equal(ordered[0]!.envelopeId, "b");
  assert.equal(ordered[1]!.envelopeId, "c");
  assert.equal(ordered[2]!.envelopeId, "a");
});

test("orderEdgeSyncQueue sorts by sequence_no ascending when priority is equal", () => {
  const items: EdgeSyncEnvelope[] = [
    makeEnvelope({ envelopeId: "a", priority: 1, sequence_no: 3, createdAt: "2026-04-25T12:00:00Z" }),
    makeEnvelope({ envelopeId: "b", priority: 1, sequence_no: 1, createdAt: "2026-04-25T10:00:00Z" }),
    makeEnvelope({ envelopeId: "c", priority: 1, sequence_no: 2, createdAt: "2026-04-25T11:00:00Z" }),
  ];

  const ordered = orderEdgeSyncQueue(items);

  assert.equal(ordered[0]!.envelopeId, "b");
  assert.equal(ordered[1]!.envelopeId, "c");
  assert.equal(ordered[2]!.envelopeId, "a");
});

test("orderEdgeSyncQueue does not mutate original array", () => {
  const items: EdgeSyncEnvelope[] = [
    makeEnvelope({ envelopeId: "a", priority: 1 }),
    makeEnvelope({ envelopeId: "b", priority: 2 }),
  ];

  orderEdgeSyncQueue(items);

  assert.equal(items[0]!.envelopeId, "a");
  assert.equal(items[1]!.envelopeId, "b");
});

test("orderEdgeSyncQueue handles empty array", () => {
  const ordered = orderEdgeSyncQueue([]);
  assert.deepEqual(ordered, []);
});

test("orderEdgeSyncQueue handles single item", () => {
  const items: EdgeSyncEnvelope[] = [makeEnvelope({ envelopeId: "only", priority: 5 })];
  const ordered = orderEdgeSyncQueue(items);

  assert.equal(ordered.length, 1);
  assert.equal(ordered[0]!.envelopeId, "only");
});

test("orderEdgeSyncQueue ignores createdAt when sequence_no establishes canonical order", () => {
  const items: EdgeSyncEnvelope[] = [
    makeEnvelope({ envelopeId: "a", priority: 1, sequence_no: 2, createdAt: "2026-04-25T09:00:00Z" }),
    makeEnvelope({ envelopeId: "b", priority: 1, sequence_no: 1, createdAt: "2026-04-25T10:00:00Z" }),
  ];

  const ordered = orderEdgeSyncQueue(items);

  assert.equal(ordered[0]!.envelopeId, "b");
  assert.equal(ordered[1]!.envelopeId, "a");
});

test("dedupeEdgeSyncQueue removes duplicate envelopeIds", () => {
  const items: EdgeSyncEnvelope[] = [
    makeEnvelope({ envelopeId: "a", priority: 1 }),
    makeEnvelope({ envelopeId: "a", priority: 2 }),
    makeEnvelope({ envelopeId: "b", priority: 1 }),
  ];

  const deduped = dedupeEdgeSyncQueue(items);

  assert.equal(deduped.length, 2);
  const ids = deduped.map((item) => item.envelopeId);
  assert.ok(ids.includes("a"));
  assert.ok(ids.includes("b"));
});

test("dedupeEdgeSyncQueue keeps last occurrence of duplicate envelopeId", () => {
  const items: EdgeSyncEnvelope[] = [
    makeEnvelope({ envelopeId: "a", priority: 1 }),
    makeEnvelope({ envelopeId: "a", priority: 3 }),
    makeEnvelope({ envelopeId: "a", priority: 2 }),
  ];

  const deduped = dedupeEdgeSyncQueue(items);

  // Map.set replaces, keeping the last occurrence
  assert.equal(deduped.length, 1);
  assert.equal(deduped[0]!.priority, 2);
});

test("dedupeEdgeSyncQueue returns sorted results", () => {
  const items: EdgeSyncEnvelope[] = [
    makeEnvelope({ envelopeId: "b", priority: 2 }),
    makeEnvelope({ envelopeId: "a", priority: 3 }),
    makeEnvelope({ envelopeId: "c", priority: 1 }),
  ];

  const deduped = dedupeEdgeSyncQueue(items);

  assert.equal(deduped[0]!.envelopeId, "a");
  assert.equal(deduped[1]!.envelopeId, "b");
  assert.equal(deduped[2]!.envelopeId, "c");
});

test("dedupeEdgeSyncQueue does not mutate original array", () => {
  const items: EdgeSyncEnvelope[] = [
    makeEnvelope({ envelopeId: "a", priority: 1 }),
    makeEnvelope({ envelopeId: "a", priority: 2 }),
  ];

  dedupeEdgeSyncQueue(items);

  assert.equal(items.length, 2);
});

test("dedupeEdgeSyncQueue handles empty array", () => {
  const deduped = dedupeEdgeSyncQueue([]);
  assert.deepEqual(deduped, []);
});

test("dedupeEdgeSyncQueue handles all unique items", () => {
  const items: EdgeSyncEnvelope[] = [
    makeEnvelope({ envelopeId: "a", priority: 1 }),
    makeEnvelope({ envelopeId: "b", priority: 2 }),
    makeEnvelope({ envelopeId: "c", priority: 3 }),
  ];

  const deduped = dedupeEdgeSyncQueue(items);

  assert.equal(deduped.length, 3);
});

test("EdgeSyncEnvelope type shape is correct", () => {
  const envelope: EdgeSyncEnvelope = makeEnvelope({
    envelopeId: "env_123",
    priority: 5,
    createdAt: "2026-04-25T10:00:00Z",
    sequence_no: 42,
    local_time_offset: -480,
    prev_hash: "prev-hash",
    side_effect_dependency_refs: ["tool:1"],
  });

  assert.equal(envelope.envelopeId, "env_123");
  assert.equal(envelope.priority, 5);
  assert.equal(envelope.createdAt, "2026-04-25T10:00:00Z");
  assert.equal(envelope.sequence_no, 42);
  assert.equal(envelope.local_time_offset, -480);
  assert.equal(envelope.prev_hash, "prev-hash");
  assert.deepEqual(envelope.side_effect_dependency_refs, ["tool:1"]);
});

test("EdgeSyncEnvelope keeps canonical provenance metadata", () => {
  const envelope: EdgeSyncEnvelope = makeEnvelope({
    envelopeId: "env_456",
    priority: 3,
    device_id: "device-456",
    signature: "sig-456",
  });

  assert.equal(envelope.envelopeId, "env_456");
  assert.equal(envelope.device_id, "device-456");
  assert.equal(envelope.signature, "sig-456");
});
