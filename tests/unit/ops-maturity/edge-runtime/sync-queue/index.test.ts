import assert from "node:assert/strict";
import test from "node:test";

import {
  orderEdgeSyncQueue,
  dedupeEdgeSyncQueue,
} from "../../../../src/ops-maturity/edge-runtime/sync-queue/index.js";

test("orderEdgeSyncQueue sorts by priority descending", () => {
  const items = [
    { envelopeId: "e1", priority: 1, createdAt: "2026-04-20T00:00:00Z" },
    { envelopeId: "e2", priority: 10, createdAt: "2026-04-20T00:00:00Z" },
  ];

  const result = orderEdgeSyncQueue(items);

  assert.equal(result[0].envelopeId, "e2");
  assert.equal(result[1].envelopeId, "e1");
});

test("orderEdgeSyncQueue sorts by createdAt when priorities equal", () => {
  const items = [
    { envelopeId: "e1", priority: 5, createdAt: "2026-04-20T02:00:00Z" },
    { envelopeId: "e2", priority: 5, createdAt: "2026-04-20T01:00:00Z" },
  ];

  const result = orderEdgeSyncQueue(items);

  assert.equal(result[0].envelopeId, "e1");
  assert.equal(result[1].envelopeId, "e2");
});

test("dedupeEdgeSyncQueue removes duplicate envelopeIds", () => {
  const items = [
    { envelopeId: "e1", priority: 1, createdAt: "2026-04-20T00:00:00Z" },
    { envelopeId: "e1", priority: 2, createdAt: "2026-04-20T01:00:00Z" },
  ];

  const result = dedupeEdgeSyncQueue(items);

  assert.equal(result.length, 1);
  assert.equal(result[0].envelopeId, "e1");
  assert.equal(result[0].priority, 2);
});

test("orderEdgeSyncQueue handles empty array", () => {
  const result = orderEdgeSyncQueue([]);
  assert.deepStrictEqual(result, []);
});

test("dedupeEdgeSyncQueue handles empty array", () => {
  const result = dedupeEdgeSyncQueue([]);
  assert.deepStrictEqual(result, []);
});
