import assert from "node:assert/strict";
import test from "node:test";

/**
 * Tests for DataLineageService covering audit fix:
 * - Issue #2092: Lineage DAG is mutable with no append-only/tamper detection
 *
 * The lineage service should provide tamper-evident storage with:
 * - Append-only edge recording
 * - Immutable edge records once created
 * - Hash chain or similar tamper detection mechanism
 */

import { DataLineageService, type DataLineageEdge, type LineageEdgeKind } from "../../../../../src/platform/compliance/lineage/index.js";

// ─────────────────────────────────────────────────────────────────────────────
// Issue #2092: Lineage must be append-only with tamper detection
// ─────────────────────────────────────────────────────────────────────────────

test("Issue #2092: Recorded edges must be immutable (append-only, no in-place modification)", async () => {
  const service = new DataLineageService();

  const edge = service.recordEdge({
    sourceRef: "task:v1",
    targetRef: "artifact:v1",
    kind: "derived_from",
    actorRef: "agent:ops",
  });

  // Attempt to modify the returned edge should not affect stored data
  const originalCreatedAt = edge.createdAt;
  (edge as DataLineageEdge & { createdAt: string }).createdAt = " tampering timestamp";
  (edge as DataLineageEdge & { edgeId: string }).edgeId = "tampered_id";

  // Verify stored data is unchanged
  const storedEdges = service.listEdges();
  assert.equal(storedEdges[0]?.createdAt, originalCreatedAt, "stored edge must be immutable");
  assert.equal(storedEdges[0]?.edgeId, edge.edgeId, "stored edgeId must be unchanged");
});

test("Issue #2092: listEdges returns fresh copies preventing external mutation", async () => {
  const service = new DataLineageService();

  service.recordEdge({
    sourceRef: "a:1",
    targetRef: "b:1",
    kind: "derived_from",
    actorRef: "actor:1",
  });

  // Get edges and try to mutate externally
  const edges1 = service.listEdges();
  edges1.push({} as DataLineageEdge); // External mutation attempt

  // Next call should return pristine data
  const edges2 = service.listEdges();
  assert.equal(edges2.length, 1, "external mutation must not affect stored lineage");

  // Verify the stored edge is untouched
  const stored = service.listEdges();
  assert.equal(stored.length, 1, "lineage must be append-only, not mutable");
  assert.ok(stored[0]?.edgeId.startsWith("lineage_"), "edge ID must be valid");
});

test("Issue #2092: Each edge must have unique immutable ID", async () => {
  const service = new DataLineageService();

  const edge1 = service.recordEdge({
    sourceRef: "s:1",
    targetRef: "t:1",
    kind: "derived_from",
    actorRef: "actor:1",
  });

  const edge2 = service.recordEdge({
    sourceRef: "s:2",
    targetRef: "t:2",
    kind: "derived_from",
    actorRef: "actor:2",
  });

  // Each edge must have unique ID
  assert.notEqual(edge1.edgeId, edge2.edgeId, "each edge must have unique ID");

  // IDs must be immutable
  const originalId = edge1.edgeId;
  (edge1 as DataLineageEdge & { edgeId: string }).edgeId = "tampered";

  const stored = service.listEdges();
  assert.equal(stored[0]?.edgeId, originalId, "stored edge ID must be immutable");
});

test("Issue #2092: traceFrom and traceTo return copies, not references", async () => {
  const service = new DataLineageService();

  service.recordEdge({
    sourceRef: "source:X",
    targetRef: "target:Y",
    kind: "derived_from",
    actorRef: "actor:Z",
  });

  const fromResult1 = service.traceFrom("source:X");
  const fromResult2 = service.traceFrom("source:X");

  // Should return different array instances
  assert.notEqual(fromResult1, fromResult2, "traceFrom should return new array each call");

  // Mutating result should not affect stored data
  fromResult1.push({} as DataLineageEdge);
  const fromResult3 = service.traceFrom("source:X");
  assert.equal(fromResult3.length, 1, "mutation must not affect stored lineage");
});

test("Issue #2092: Edge metadata must be deeply cloned on record", async () => {
  const service = new DataLineageService();

  const originalMetadata = { key: "value", nested: { inner: "data" } };

  const edge = service.recordEdge({
    sourceRef: "s:meta",
    targetRef: "t:meta",
    kind: "derived_from",
    actorRef: "actor:meta",
    metadata: originalMetadata,
  });

  // Mutate original metadata
  originalMetadata.key = "tampered";
  (originalMetadata.nested as Record<string, unknown>).inner = "compromised";

  // Stored edge should have original metadata
  const stored = service.listEdges();
  assert.deepEqual(stored[0]?.metadata, { key: "value", nested: { inner: "data" } },
    "metadata must be deeply cloned, not affected by external mutation");
});

test("Issue #2092: Edge timestamps must be immutable and auto-generated", async () => {
  const service = new DataLineageService();

  const edge = service.recordEdge({
    sourceRef: "s:time",
    targetRef: "t:time",
    kind: "derived_from",
    actorRef: "actor:time",
  });

  // createdAt must be set and immutable
  assert.ok(edge.createdAt, "createdAt must be set");
  assert.ok(edge.createdAt.length > 0, "createdAt must be non-empty");

  const originalTimestamp = edge.createdAt;
  (edge as DataLineageEdge & { createdAt: string }).createdAt = "1970-01-01T00:00:00.000Z";

  const stored = service.listEdges();
  assert.equal(stored[0]?.createdAt, originalTimestamp, "stored timestamp must be immutable");
});

// ─────────────────────────────────────────────────────────────────────────────
// Basic lineage functionality
// ─────────────────────────────────────────────────────────────────────────────

test("recordEdge creates edge with all required fields", () => {
  const service = new DataLineageService();

  const edge = service.recordEdge({
    sourceRef: "prompt:v1",
    targetRef: "artifact:summary-1",
    kind: "derived_from",
    actorRef: "agent:ops",
    policyRef: "policy-123",
    metadata: { classification: "internal" },
  });

  assert.ok(edge.edgeId.startsWith("lineage_"), "edgeId must have lineage_ prefix");
  assert.equal(edge.sourceRef, "prompt:v1");
  assert.equal(edge.targetRef, "artifact:summary-1");
  assert.equal(edge.kind, "derived_from");
  assert.equal(edge.actorRef, "agent:ops");
  assert.equal(edge.policyRef, "policy-123");
  assert.ok(edge.createdAt, "createdAt must be set");
  assert.deepEqual(edge.metadata, { classification: "internal" });
});

test("recordEdge with minimal required fields", () => {
  const service = new DataLineageService();

  const edge = service.recordEdge({
    sourceRef: "a:1",
    targetRef: "b:1",
    kind: "encrypted_from",
    actorRef: "system:encrypt",
  });

  assert.ok(edge.edgeId);
  assert.equal(edge.sourceRef, "a:1");
  assert.equal(edge.targetRef, "b:1");
  assert.equal(edge.kind, "encrypted_from");
  assert.equal(edge.actorRef, "system:encrypt");
  assert.equal(edge.policyRef, null);
  assert.deepEqual(edge.metadata, {});
});

test("recordEdge handles all edge kinds", () => {
  const service = new DataLineageService();

  const kinds: LineageEdgeKind[] = [
    "derived_from",
    "redacted_from",
    "encrypted_from",
    "released_as",
    "erased_by",
  ];

  for (const kind of kinds) {
    const edge = service.recordEdge({
      sourceRef: `source:${kind}`,
      targetRef: `target:${kind}`,
      kind,
      actorRef: "test:actor",
    });

    assert.equal(edge.kind, kind, `must handle kind: ${kind}`);
  }

  assert.equal(service.listEdges().length, 5);
});

test("traceFrom returns edges from specified source", () => {
  const service = new DataLineageService();

  service.recordEdge({
    sourceRef: "task:A",
    targetRef: "artifact:1",
    kind: "derived_from",
    actorRef: "agent:1",
  });

  service.recordEdge({
    sourceRef: "task:A",
    targetRef: "artifact:2",
    kind: "derived_from",
    actorRef: "agent:2",
  });

  service.recordEdge({
    sourceRef: "task:B",
    targetRef: "artifact:3",
    kind: "derived_from",
    actorRef: "agent:3",
  });

  const fromA = service.traceFrom("task:A");
  assert.equal(fromA.length, 2, "should return 2 edges from task:A");
  assert.ok(fromA.every((e) => e.sourceRef === "task:A"));

  const fromB = service.traceFrom("task:B");
  assert.equal(fromB.length, 1, "should return 1 edge from task:B");

  const fromNonexistent = service.traceFrom("task:unknown");
  assert.equal(fromNonexistent.length, 0, "should return empty for unknown source");
});

test("traceTo returns edges to specified target", () => {
  const service = new DataLineageService();

  service.recordEdge({
    sourceRef: "task:X",
    targetRef: "output:result",
    kind: "released_as",
    actorRef: "agent:X",
  });

  service.recordEdge({
    sourceRef: "task:Y",
    targetRef: "output:result",
    kind: "released_as",
    actorRef: "agent:Y",
  });

  service.recordEdge({
    sourceRef: "task:Z",
    targetRef: "output:other",
    kind: "released_as",
    actorRef: "agent:Z",
  });

  const toResult = service.traceTo("output:result");
  assert.equal(toResult.length, 2, "should return 2 edges to output:result");
  assert.ok(toResult.every((e) => e.targetRef === "output:result"));

  const toOther = service.traceTo("output:other");
  assert.equal(toOther.length, 1);

  const toNonexistent = service.traceTo("output:unknown");
  assert.equal(toNonexistent.length, 0);
});

test("listEdges returns all recorded edges", () => {
  const service = new DataLineageService();

  service.recordEdge({
    sourceRef: "s:1",
    targetRef: "t:1",
    kind: "derived_from",
    actorRef: "a:1",
  });

  service.recordEdge({
    sourceRef: "s:2",
    targetRef: "t:2",
    kind: "redacted_from",
    actorRef: "a:2",
  });

  const all = service.listEdges();
  assert.equal(all.length, 2);
});

test("listEdges returns empty array initially", () => {
  const service = new DataLineageService();

  const edges = service.listEdges();
  assert.equal(edges.length, 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// Edge immutability verification
// ─────────────────────────────────────────────────────────────────────────────

test("Edge returned from recordEdge is cloned (mutation doesn't affect storage)", () => {
  const service = new DataLineageService();

  const edge = service.recordEdge({
    sourceRef: "s:clone",
    targetRef: "t:clone",
    kind: "derived_from",
    actorRef: "actor:clone",
  });

  // Attempt to mutate the returned edge
  const mutable = edge as DataLineageEdge & Record<string, unknown>;
  mutable.sourceRef = "tampered:source";
  mutable.targetRef = "tampered:target";
  mutable.kind = "erased_by" as LineageEdgeKind;
  mutable.metadata = { hacked: true };

  // Stored data must be unchanged
  const stored = service.listEdges();
  assert.equal(stored[0]?.sourceRef, "s:clone");
  assert.equal(stored[0]?.targetRef, "t:clone");
  assert.equal(stored[0]?.kind, "derived_from");
  assert.deepEqual(stored[0]?.metadata, {});
});

test("Multiple edges maintain independent metadata", () => {
  const service = new DataLineageService();

  const edge1 = service.recordEdge({
    sourceRef: "s:1",
    targetRef: "t:1",
    kind: "derived_from",
    actorRef: "actor:1",
    metadata: { index: 1 },
  });

  const edge2 = service.recordEdge({
    sourceRef: "s:2",
    targetRef: "t:2",
    kind: "derived_from",
    actorRef: "actor:2",
    metadata: { index: 2 },
  });

  // Mutate edge1's metadata
  (edge1.metadata as Record<string, unknown>).index = 999;

  // edge2 metadata must be independent
  const stored = service.listEdges();
  assert.equal(stored[0]?.metadata, { index: 1 }, "edge1 metadata must be unchanged");
  assert.equal(stored[1]?.metadata, { index: 2 }, "edge2 metadata must be unchanged");
});

test("Empty metadata is handled correctly", () => {
  const service = new DataLineageService();

  const edge = service.recordEdge({
    sourceRef: "s:empty",
    targetRef: "t:empty",
    kind: "derived_from",
    actorRef: "actor:empty",
    metadata: {},
  });

  assert.deepEqual(edge.metadata, {});

  // Mutating returned edge metadata should not affect storage
  (edge.metadata as Record<string, unknown>).hacked = true;

  const stored = service.listEdges();
  assert.deepEqual(stored[0]?.metadata, {});
});

test("Null metadata is converted to empty object", () => {
  const service = new DataLineageService();

  const edge = service.recordEdge({
    sourceRef: "s:null",
    targetRef: "t:null",
    kind: "derived_from",
    actorRef: "actor:null",
    metadata: undefined,
  });

  assert.deepEqual(edge.metadata, {}, "null/undefined metadata must become empty object");
});

// ─────────────────────────────────────────────────────────────────────────────
// Edge identity and uniqueness
// ─────────────────────────────────────────────────────────────────────────────

test("Each recordEdge call generates unique edgeId", () => {
  const service = new DataLineageService();

  const edges: DataLineageEdge[] = [];
  for (let i = 0; i < 10; i++) {
    edges.push(
      service.recordEdge({
        sourceRef: `s:${i}`,
        targetRef: `t:${i}`,
        kind: "derived_from",
        actorRef: "actor",
      }),
    );
  }

  // All IDs must be unique
  const ids = edges.map((e) => e.edgeId);
  const uniqueIds = new Set(ids);
  assert.equal(uniqueIds.size, 10, "all edge IDs must be unique");
});

test("Edge with same properties gets unique ID", () => {
  const service = new DataLineageService();

  const edge1 = service.recordEdge({
    sourceRef: "same",
    targetRef: "same",
    kind: "derived_from",
    actorRef: "same",
  });

  const edge2 = service.recordEdge({
    sourceRef: "same",
    targetRef: "same",
    kind: "derived_from",
    actorRef: "same",
  });

  assert.notEqual(edge1.edgeId, edge2.edgeId, "duplicate edges must still get unique IDs");
});