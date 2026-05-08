import assert from "node:assert/strict";
import test from "node:test";

import {
  orderEdgeSyncQueue,
  dedupeEdgeSyncQueue,
  type EdgeSyncEnvelope,
} from "../../../../src/ops-maturity/edge-runtime/sync-queue/index.js";

test("orderEdgeSyncQueue sorts by priority descending", () => {
  const items: EdgeSyncEnvelope[] = [
    { envelopeId: "a", priority: 1 },
    { envelopeId: "b", priority: 3 },
    { envelopeId: "c", priority: 2 },
  ];

  const ordered = orderEdgeSyncQueue(items);

  assert.equal(ordered[0]!.envelopeId, "b");
  assert.equal(ordered[1]!.envelopeId, "c");
  assert.equal(ordered[2]!.envelopeId, "a");
});

test("orderEdgeSyncQueue sorts by createdAt ascending when priority is equal", () => {
  const items: EdgeSyncEnvelope[] = [
    { envelopeId: "a", priority: 1, createdAt: "2026-04-25T12:00:00Z" },
    { envelopeId: "b", priority: 1, createdAt: "2026-04-25T10:00:00Z" },
    { envelopeId: "c", priority: 1, createdAt: "2026-04-25T11:00:00Z" },
  ];

  const ordered = orderEdgeSyncQueue(items);

  assert.equal(ordered[0]!.envelopeId, "b");
  assert.equal(ordered[1]!.envelopeId, "c");
  assert.equal(ordered[2]!.envelopeId, "a");
});

test("orderEdgeSyncQueue does not mutate original array", () => {
  const items: EdgeSyncEnvelope[] = [
    { envelopeId: "a", priority: 1 },
    { envelopeId: "b", priority: 2 },
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
  const items: EdgeSyncEnvelope[] = [{ envelopeId: "only", priority: 5 }];
  const ordered = orderEdgeSyncQueue(items);

  assert.equal(ordered.length, 1);
  assert.equal(ordered[0]!.envelopeId, "only");
});

test("orderEdgeSyncQueue treats undefined createdAt as empty string which sorts first", () => {
  const items: EdgeSyncEnvelope[] = [
    { envelopeId: "a", priority: 1 },
    { envelopeId: "b", priority: 1, createdAt: "2026-04-25T10:00:00Z" },
  ];

  const ordered = orderEdgeSyncQueue(items);

  // empty string sorts before actual date strings
  assert.equal(ordered[0]!.envelopeId, "a");
  assert.equal(ordered[1]!.envelopeId, "b");
});

test("dedupeEdgeSyncQueue removes duplicate envelopeIds", () => {
  const items: EdgeSyncEnvelope[] = [
    { envelopeId: "a", priority: 1 },
    { envelopeId: "a", priority: 2 },
    { envelopeId: "b", priority: 1 },
  ];

  const deduped = dedupeEdgeSyncQueue(items);

  assert.equal(deduped.length, 2);
  const ids = deduped.map((item) => item.envelopeId);
  assert.ok(ids.includes("a"));
  assert.ok(ids.includes("b"));
});

test("dedupeEdgeSyncQueue keeps last occurrence of duplicate envelopeId", () => {
  const items: EdgeSyncEnvelope[] = [
    { envelopeId: "a", priority: 1 },
    { envelopeId: "a", priority: 3 },
    { envelopeId: "a", priority: 2 },
  ];

  const deduped = dedupeEdgeSyncQueue(items);

  // Map.set replaces, keeping the last occurrence
  assert.equal(deduped.length, 1);
  assert.equal(deduped[0]!.priority, 2);
});

test("dedupeEdgeSyncQueue returns sorted results", () => {
  const items: EdgeSyncEnvelope[] = [
    { envelopeId: "b", priority: 2 },
    { envelopeId: "a", priority: 3 },
    { envelopeId: "c", priority: 1 },
  ];

  const deduped = dedupeEdgeSyncQueue(items);

  assert.equal(deduped[0]!.envelopeId, "a");
  assert.equal(deduped[1]!.envelopeId, "b");
  assert.equal(deduped[2]!.envelopeId, "c");
});

test("dedupeEdgeSyncQueue does not mutate original array", () => {
  const items: EdgeSyncEnvelope[] = [
    { envelopeId: "a", priority: 1 },
    { envelopeId: "a", priority: 2 },
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
    { envelopeId: "a", priority: 1 },
    { envelopeId: "b", priority: 2 },
    { envelopeId: "c", priority: 3 },
  ];

  const deduped = dedupeEdgeSyncQueue(items);

  assert.equal(deduped.length, 3);
});

test("EdgeSyncEnvelope type shape is correct", () => {
  const envelope: EdgeSyncEnvelope = {
    envelopeId: "env_123",
    priority: 5,
    createdAt: "2026-04-25T10:00:00Z",
  };

  assert.equal(envelope.envelopeId, "env_123");
  assert.equal(envelope.priority, 5);
  assert.equal(envelope.createdAt, "2026-04-25T10:00:00Z");
});

test("EdgeSyncEnvelope createdAt is optional", () => {
  const envelope: EdgeSyncEnvelope = {
    envelopeId: "env_456",
    priority: 3,
  };

  assert.equal(envelope.envelopeId, "env_456");
  assert.equal(envelope.createdAt, undefined);
});
