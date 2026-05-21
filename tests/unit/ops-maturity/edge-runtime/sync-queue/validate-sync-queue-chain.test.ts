/**
 * Unit tests for validateSyncQueueChain function
 *
 * @see src/ops-maturity/edge-runtime/sync-queue/index.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  validateSyncQueueChain,
  type EdgeSyncEnvelope,
} from "../../../../../src/ops-maturity/edge-runtime/sync-queue/index.js";

describe("validateSyncQueueChain", () => {
  test("returns valid result for empty array", () => {
    const result = validateSyncQueueChain([]);

    assert.equal(result.valid, true);
    assert.deepEqual(result.errors, []);
    assert.deepEqual(result.topologicalOrder, []);
  });

  test("returns valid result for single envelope with no prev_hash", () => {
    const items: EdgeSyncEnvelope[] = [
      { envelopeId: "env-1", priority: 1, prev_hash: undefined },
    ];

    const result = validateSyncQueueChain(items);

    assert.equal(result.valid, true);
    assert.deepEqual(result.errors, []);
    assert.deepEqual(result.topologicalOrder, ["env-1"]);
  });

  test("returns valid result for properly chained envelopes", () => {
    const items: EdgeSyncEnvelope[] = [
      {
        envelopeId: "env-1",
        priority: 1,
        sequence_no: 1,
        createdAt: "2026-04-20T00:00:00.000Z",
        prev_hash: undefined,
      },
      {
        envelopeId: "env-2",
        priority: 2,
        sequence_no: 2,
        createdAt: "2026-04-20T00:01:00.000Z",
        prev_hash: "env-1:1:2026-04-20T00:00:00.000Z",
      },
      {
        envelopeId: "env-3",
        priority: 3,
        sequence_no: 3,
        createdAt: "2026-04-20T00:02:00.000Z",
        prev_hash: "env-2:2:2026-04-20T00:01:00.000Z",
      },
    ];

    const result = validateSyncQueueChain(items);

    assert.equal(result.valid, true);
    assert.deepEqual(result.errors, []);
  });

  test("detects first item with non-null prev_hash", () => {
    const items: EdgeSyncEnvelope[] = [
      {
        envelopeId: "env-1",
        priority: 1,
        prev_hash: "some_prev_hash",
      },
    ];

    const result = validateSyncQueueChain(items);

    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes("first_item_must_have_null_prev_hash")));
  });

  test("detects prev_hash mismatch in chain", () => {
    const items: EdgeSyncEnvelope[] = [
      {
        envelopeId: "env-1",
        priority: 1,
        sequence_no: 1,
        createdAt: "2026-04-20T00:00:00.000Z",
        prev_hash: undefined,
      },
      {
        envelopeId: "env-2",
        priority: 2,
        sequence_no: 2,
        createdAt: "2026-04-20T00:01:00.000Z",
        prev_hash: "wrong_hash",
      },
    ];

    const result = validateSyncQueueChain(items);

    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes("prev_hash_mismatch")));
  });

  test("detects missing dependency", () => {
    const items: EdgeSyncEnvelope[] = [
      {
        envelopeId: "env-1",
        priority: 1,
        prev_hash: undefined,
        side_effect_dependency_refs: [],
      },
      {
        envelopeId: "env-2",
        priority: 2,
        prev_hash: "env-1::",
        side_effect_dependency_refs: ["env-99"],
      },
    ];

    const result = validateSyncQueueChain(items);

    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes("missing_dependency")));
  });

  test("detects dependency cycle", () => {
    const items: EdgeSyncEnvelope[] = [
      {
        envelopeId: "env-1",
        priority: 1,
        prev_hash: undefined,
        side_effect_dependency_refs: ["env-2"],
      },
      {
        envelopeId: "env-2",
        priority: 2,
        prev_hash: "env-1::",
        side_effect_dependency_refs: ["env-1"],
      },
    ];

    const result = validateSyncQueueChain(items);

    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes("dependency_cycle_detected")));
  });

  test("validates topological order for correct dependency ordering", () => {
    const items: EdgeSyncEnvelope[] = [
      {
        envelopeId: "env-root",
        priority: 1,
        prev_hash: undefined,
        side_effect_dependency_refs: [],
      },
      {
        envelopeId: "env-child",
        priority: 2,
        prev_hash: "env-root::",
        side_effect_dependency_refs: ["env-root"],
      },
    ];

    const result = validateSyncQueueChain(items);

    assert.equal(result.valid, true);
    assert.deepEqual(result.topologicalOrder, ["env-root", "env-child"]);
  });

  test("handles items without sequence_no", () => {
    const items: EdgeSyncEnvelope[] = [
      {
        envelopeId: "env-1",
        priority: 1,
        createdAt: "2026-04-20T00:00:00.000Z",
        prev_hash: undefined,
      },
      {
        envelopeId: "env-2",
        priority: 2,
        createdAt: "2026-04-20T00:01:00.000Z",
        prev_hash: "env-1::2026-04-20T00:00:00.000Z",
      },
    ];

    const result = validateSyncQueueChain(items);

    assert.equal(result.valid, true);
  });

  test("returns correct topological order for complex DAG", () => {
    const items: EdgeSyncEnvelope[] = [
      {
        envelopeId: "env-a",
        priority: 1,
        prev_hash: undefined,
        side_effect_dependency_refs: [],
      },
      {
        envelopeId: "env-b",
        priority: 2,
        prev_hash: "env-a::",
        side_effect_dependency_refs: ["env-a"],
      },
      {
        envelopeId: "env-c",
        priority: 3,
        prev_hash: "env-a::",
        side_effect_dependency_refs: ["env-a"],
      },
      {
        envelopeId: "env-d",
        priority: 4,
        prev_hash: "env-b::",
        side_effect_dependency_refs: ["env-b", "env-c"],
      },
    ];

    const result = validateSyncQueueChain(items);

    assert.equal(result.valid, true);
    // env-a should come first, then env-b and env-c (order may vary), then env-d last
    assert.ok(result.topologicalOrder.indexOf("env-a") < result.topologicalOrder.indexOf("env-d"));
    assert.ok(result.topologicalOrder.indexOf("env-b") < result.topologicalOrder.indexOf("env-d"));
    assert.ok(result.topologicalOrder.indexOf("env-c") < result.topologicalOrder.indexOf("env-d"));
  });

  test("handles items without side_effect_dependency_refs", () => {
    const items: EdgeSyncEnvelope[] = [
      { envelopeId: "env-1", priority: 1 },
      { envelopeId: "env-2", priority: 2, prev_hash: "env-1::" },
    ];

    const result = validateSyncQueueChain(items);

    assert.equal(result.valid, true);
  });

  test("sorts by priority before chain validation", () => {
    const items: EdgeSyncEnvelope[] = [
      {
        envelopeId: "env-low",
        priority: 1,
        prev_hash: undefined,
      },
      {
        envelopeId: "env-high",
        priority: 5,
        prev_hash: undefined,
      },
    ];

    const result = validateSyncQueueChain(items);

    // Higher priority (5) is processed first according to orderEdgeSyncQueue
    assert.equal(result.topologicalOrder[0], "env-high");
    assert.equal(result.topologicalOrder[1], "env-low");
  });
});