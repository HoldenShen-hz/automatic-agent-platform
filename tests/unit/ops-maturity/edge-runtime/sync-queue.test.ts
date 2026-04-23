import assert from "node:assert/strict";
import test from "node:test";

import {
  orderEdgeSyncQueue,
  dedupeEdgeSyncQueue,
  type EdgeSyncEnvelope,
} from "../../../../src/ops-maturity/edge-runtime/sync-queue/index.js";

test("orderEdgeSyncQueue sorts by priority descending", () => {
  const items: EdgeSyncEnvelope[] = [
    { envelopeId: "low", priority: 1 },
    { envelopeId: "high", priority: 10 },
    { envelopeId: "medium", priority: 5 },
  ];

  const ordered = orderEdgeSyncQueue(items);

  assert.equal(ordered[0].envelopeId, "high");
  assert.equal(ordered[1].envelopeId, "medium");
  assert.equal(ordered[2].envelopeId, "low");
});

test("orderEdgeSyncQueue uses createdAt as tiebreaker", () => {
  const items: EdgeSyncEnvelope[] = [
    { envelopeId: "older", priority: 5, createdAt: "2026-04-20T00:00:00.000Z" },
    { envelopeId: "newer", priority: 5, createdAt: "2026-04-20T01:00:00.000Z" },
  ];

  const ordered = orderEdgeSyncQueue(items);

  assert.equal(ordered[0].envelopeId, "newer");
  assert.equal(ordered[1].envelopeId, "older");
});

test("orderEdgeSyncQueue does not mutate original array", () => {
  const original: EdgeSyncEnvelope[] = [
    { envelopeId: "a", priority: 1 },
    { envelopeId: "b", priority: 5 },
  ];

  const originalCopy = [...original];
  orderEdgeSyncQueue(original);

  assert.equal(original[0].envelopeId, originalCopy[0].envelopeId);
  assert.equal(original[1].envelopeId, originalCopy[1].envelopeId);
});

test("orderEdgeSyncQueue handles empty array", () => {
  const ordered = orderEdgeSyncQueue([]);
  assert.deepEqual(ordered, []);
});

test("orderEdgeSyncQueue handles single item", () => {
  const ordered = orderEdgeSyncQueue([{ envelopeId: "only", priority: 1 }]);
  assert.equal(ordered.length, 1);
  assert.equal(ordered[0].envelopeId, "only");
});

test("dedupeEdgeSyncQueue removes duplicates by envelopeId", () => {
  const items: EdgeSyncEnvelope[] = [
    { envelopeId: "dup", priority: 1 },
    { envelopeId: "unique", priority: 2 },
    { envelopeId: "dup", priority: 3 },
  ];

  const deduped = dedupeEdgeSyncQueue(items);

  assert.equal(deduped.length, 2);
  assert.ok(deduped.some((item) => item.envelopeId === "unique"));
  assert.ok(deduped.some((item) => item.envelopeId === "dup"));
});

test("dedupeEdgeSyncQueue keeps highest priority duplicate", () => {
  const items: EdgeSyncEnvelope[] = [
    { envelopeId: "dup", priority: 1 },
    { envelopeId: "dup", priority: 5 },
  ];

  const deduped = dedupeEdgeSyncQueue(items);

  assert.equal(deduped.length, 1);
  assert.equal(deduped[0].envelopeId, "dup");
  assert.equal(deduped[0].priority, 5);
});

test("dedupeEdgeSyncQueue sorts results by priority", () => {
  const items: EdgeSyncEnvelope[] = [
    { envelopeId: "low", priority: 1 },
    { envelopeId: "high", priority: 10 },
  ];

  const deduped = dedupeEdgeSyncQueue(items);

  assert.equal(deduped[0].envelopeId, "high");
  assert.equal(deduped[1].envelopeId, "low");
});

test("dedupeEdgeSyncQueue handles empty array", () => {
  const deduped = dedupeEdgeSyncQueue([]);
  assert.deepEqual(deduped, []);
});

test("EdgeSyncEnvelope type shape is correct", () => {
  const envelope: EdgeSyncEnvelope = {
    envelopeId: "test-env",
    priority: 3,
    createdAt: "2026-04-20T00:00:00.000Z",
  };

  assert.equal(envelope.envelopeId, "test-env");
  assert.equal(envelope.priority, 3);
  assert.equal(envelope.createdAt, "2026-04-20T00:00:00.000Z");
});

test("EdgeSyncEnvelope createdAt is optional", () => {
  const envelope: EdgeSyncEnvelope = {
    envelopeId: "no-date",
    priority: 1,
  };

  assert.equal(envelope.envelopeId, "no-date");
  assert.equal(envelope.createdAt, undefined);
});
