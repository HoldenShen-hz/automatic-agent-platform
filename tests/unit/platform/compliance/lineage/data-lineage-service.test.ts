import assert from "node:assert/strict";
import test from "node:test";

import { DataLineageEdge, DataLineageService } from "../../../../../src/platform/compliance/lineage/index.js";

test("DataLineageService recordEdge generates unique edge IDs", () => {
  const service = new DataLineageService();
  const edge1 = service.recordEdge({
    sourceRef: "a:1",
    targetRef: "b:1",
    kind: "derived_from",
    actorRef: "actor:1",
  });
  const edge2 = service.recordEdge({
    sourceRef: "a:1",
    targetRef: "b:2",
    kind: "derived_from",
    actorRef: "actor:1",
  });

  assert.notStrictEqual(edge1.edgeId, edge2.edgeId);
});

test("DataLineageService recordEdge sets createdAt timestamp", () => {
  const service = new DataLineageService();
  const before = new Date().toISOString();
  const edge = service.recordEdge({
    sourceRef: "a:1",
    targetRef: "b:1",
    kind: "derived_from",
    actorRef: "actor:1",
  });
  const after = new Date().toISOString();

  assert.ok(edge.createdAt >= before);
  assert.ok(edge.createdAt <= after);
});

test("DataLineageService recordEdge defaults metadata to empty object", () => {
  const service = new DataLineageService();
  const edge = service.recordEdge({
    sourceRef: "a:1",
    targetRef: "b:1",
    kind: "derived_from",
    actorRef: "actor:1",
  });

  assert.deepEqual(edge.metadata, {});
});

test("DataLineageService recordEdge defaults policyRef to null", () => {
  const service = new DataLineageService();
  const edge = service.recordEdge({
    sourceRef: "a:1",
    targetRef: "b:1",
    kind: "derived_from",
    actorRef: "actor:1",
  });

  assert.strictEqual(edge.policyRef, null);
});

test("DataLineageService recordEdge accepts explicit null policyRef", () => {
  const service = new DataLineageService();
  const edge = service.recordEdge({
    sourceRef: "a:1",
    targetRef: "b:1",
    kind: "derived_from",
    actorRef: "actor:1",
    policyRef: null,
  });

  assert.strictEqual(edge.policyRef, null);
});

test("DataLineageService traceFrom returns empty array for untraced source", () => {
  const service = new DataLineageService();
  service.recordEdge({
    sourceRef: "a:1",
    targetRef: "b:1",
    kind: "derived_from",
    actorRef: "actor:1",
  });

  const result = service.traceFrom("nonexistent");
  assert.deepEqual(result, []);
});

test("DataLineageService traceTo returns empty array for untraced target", () => {
  const service = new DataLineageService();
  service.recordEdge({
    sourceRef: "a:1",
    targetRef: "b:1",
    kind: "derived_from",
    actorRef: "actor:1",
  });

  const result = service.traceTo("nonexistent");
  assert.deepEqual(result, []);
});

test("DataLineageService traceFrom returns all edges from source", () => {
  const service = new DataLineageService();
  service.recordEdge({
    sourceRef: "a:1",
    targetRef: "b:1",
    kind: "derived_from",
    actorRef: "actor:1",
  });
  service.recordEdge({
    sourceRef: "a:1",
    targetRef: "b:2",
    kind: "redacted_from",
    actorRef: "actor:1",
  });

  const result = service.traceFrom("a:1");
  assert.equal(result.length, 2);
});

test("DataLineageService traceTo returns all edges to target", () => {
  const service = new DataLineageService();
  service.recordEdge({
    sourceRef: "a:1",
    targetRef: "b:1",
    kind: "derived_from",
    actorRef: "actor:1",
  });
  service.recordEdge({
    sourceRef: "a:2",
    targetRef: "b:1",
    kind: "released_as",
    actorRef: "actor:2",
  });

  const result = service.traceTo("b:1");
  assert.equal(result.length, 2);
});

test("DataLineageService listEdges returns all recorded edges", () => {
  const service = new DataLineageService();
  for (let i = 0; i < 5; i++) {
    service.recordEdge({
      sourceRef: `a:${i}`,
      targetRef: `b:${i}`,
      kind: "derived_from",
      actorRef: "actor:1",
    });
  }

  const result = service.listEdges();
  assert.equal(result.length, 5);
});

test("DataLineageService handles all lineage edge kinds", () => {
  const service = new DataLineageService();
  const kinds = ["derived_from", "redacted_from", "encrypted_from", "released_as", "erased_by"] as const;

  for (const kind of kinds) {
    const edge = service.recordEdge({
      sourceRef: `source:${kind}`,
      targetRef: `target:${kind}`,
      kind,
      actorRef: "test:actor",
      metadata: { testKind: kind },
    });

    assert.equal(edge.kind, kind);
    assert.deepEqual(edge.metadata, { testKind: kind });
  }
});

test("DataLineageService recordEdge with complex metadata", () => {
  const service = new DataLineageService();
  const edge = service.recordEdge({
    sourceRef: "prompt:v1",
    targetRef: "artifact:summary-1",
    kind: "derived_from",
    actorRef: "agent:ops",
    policyRef: "policy:123",
    metadata: {
      classification: "confidential",
      regions: ["us-east-1", "us-west-2"],
      nested: { key: "value" },
    },
  });

  assert.equal(edge.metadata.classification, "confidential");
  assert.deepEqual(edge.metadata.regions, ["us-east-1", "us-west-2"]);
  assert.deepEqual(edge.metadata.nested, { key: "value" });
});

test("DataLineageService traceFrom does not return edges from different sources", () => {
  const service = new DataLineageService();
  service.recordEdge({
    sourceRef: "a:1",
    targetRef: "b:1",
    kind: "derived_from",
    actorRef: "actor:1",
  });
  service.recordEdge({
    sourceRef: "a:2",
    targetRef: "b:1",
    kind: "derived_from",
    actorRef: "actor:1",
  });

  const result = service.traceFrom("a:1");
  assert.equal(result.length, 1);
  assert.equal(result[0]?.sourceRef, "a:1");
});

test("DataLineageService traceTo does not return edges to different targets", () => {
  const service = new DataLineageService();
  service.recordEdge({
    sourceRef: "a:1",
    targetRef: "b:1",
    kind: "derived_from",
    actorRef: "actor:1",
  });
  service.recordEdge({
    sourceRef: "a:1",
    targetRef: "b:2",
    kind: "derived_from",
    actorRef: "actor:1",
  });

  const result = service.traceTo("b:1");
  assert.equal(result.length, 1);
  assert.equal(result[0]?.targetRef, "b:1");
});

test("DataLineageService chain is append-only: returned edges are not live references", () => {
  const service = new DataLineageService();
  const edge = service.recordEdge({
    sourceRef: "a:1",
    targetRef: "b:1",
    kind: "derived_from",
    actorRef: "actor:1",
  });

  // Modify the returned edge
  (edge as unknown as Record<string, unknown>).metadata = { tampered: true };

  // The stored edge should be unaffected
  const stored = service.listEdges();
  assert.deepEqual(stored[0]?.metadata, {});
});

test("DataLineageService verifyChain returns valid for clean chain", () => {
  const service = new DataLineageService();
  service.recordEdge({ sourceRef: "a:1", targetRef: "b:1", kind: "derived_from", actorRef: "actor:1" });
  service.recordEdge({ sourceRef: "b:1", targetRef: "c:1", kind: "derived_from", actorRef: "actor:1" });
  service.recordEdge({ sourceRef: "c:1", targetRef: "d:1", kind: "released_as", actorRef: "actor:2" });

  const result = service.verifyChain();
  assert.equal(result.valid, true);
  assert.equal(result.brokenAtIndex, null);
  assert.equal(result.reason, null);
});

test("DataLineageService verifyChain detects broken prevHash linkage", () => {
  const service = new DataLineageService();
  const edge1 = service.recordEdge({ sourceRef: "a:1", targetRef: "b:1", kind: "derived_from", actorRef: "actor:1" });
  service.recordEdge({ sourceRef: "b:1", targetRef: "c:1", kind: "derived_from", actorRef: "actor:1" });

  // Tamper with the second entry's prevHash
  const chain = (service as unknown as Record<string, unknown>)._chain as DataLineageEdge[];
  const tamperedEntry = { ...chain[1] };
  tamperedEntry.prevHash = "invalid-hash-value";
  const tamperedChain = [...chain.slice(0, 1), Object.freeze(tamperedEntry)];
  (service as unknown as Record<string, unknown>)._chain = tamperedChain;

  const result = service.verifyChain();
  assert.equal(result.valid, false);
  assert.equal(result.brokenAtIndex, 1);
  assert.ok(result.reason?.includes("prevHash"));
});

test("DataLineageService verifyChain detects self-integrity hash mismatch", () => {
  const service = new DataLineageService();
  service.recordEdge({ sourceRef: "a:1", targetRef: "b:1", kind: "derived_from", actorRef: "actor:1" });
  service.recordEdge({ sourceRef: "b:1", targetRef: "c:1", kind: "derived_from", actorRef: "actor:1" });

  // Tamper with the first entry's integrityHash
  const chain = (service as unknown as Record<string, unknown>)._chain as DataLineageEdge[];
  const tamperedEntry = { ...chain[0] };
  tamperedEntry.integrityHash = "tampered-integrity-hash-value";
  const tamperedChain = [Object.freeze(tamperedEntry), ...chain.slice(1)];
  (service as unknown as Record<string, unknown>)._chain = tamperedChain;

  const result = service.verifyChain();
  assert.equal(result.valid, false);
  assert.equal(result.brokenAtIndex, 0);
  assert.ok(result.reason?.includes("integrity hash mismatch"));
});

test("DataLineageService verifyChain detects metadata tampering", () => {
  const service = new DataLineageService();
  service.recordEdge({
    sourceRef: "a:1",
    targetRef: "b:1",
    kind: "derived_from",
    actorRef: "actor:1",
    metadata: { classification: "secret" },
  });

  // Tamper with metadata after the entry was recorded
  const chain = (service as unknown as Record<string, unknown>)._chain as DataLineageEdge[];
  const tamperedEntry = { ...chain[0] };
  tamperedEntry.metadata = { classification: "public" };
  const tamperedChain = [Object.freeze(tamperedEntry)];
  (service as unknown as Record<string, unknown>)._chain = tamperedChain;

  const result = service.verifyChain();
  assert.equal(result.valid, false);
  assert.equal(result.brokenAtIndex, 0);
  assert.ok(result.reason?.includes("integrity hash mismatch"));
});

test("DataLineageService entries are frozen/immutable in the chain", () => {
  const service = new DataLineageService();
  service.recordEdge({ sourceRef: "a:1", targetRef: "b:1", kind: "derived_from", actorRef: "actor:1" });

  const chain = (service as unknown as Record<string, unknown>)._chain as readonly DataLineageEdge[];
  const entry = chain[0];

  // Attempting to modify a frozen object should throw in strict mode or silently fail
  let threw = false;
  try {
    (entry as unknown as Record<string, unknown>).metadata = { tampered: true };
  } catch {
    threw = true;
  }

  // Even if it didn't throw, the original metadata should be unchanged for the next verify
  const result = service.verifyChain();
  assert.equal(result.valid, true);
  void threw; // suppress unused warning
});

test("DataLineageService chain correctly chains hashes from genesis", () => {
  const service = new DataLineageService();
  const e1 = service.recordEdge({ sourceRef: "a:1", targetRef: "b:1", kind: "derived_from", actorRef: "actor:1" });
  const e2 = service.recordEdge({ sourceRef: "b:1", targetRef: "c:1", kind: "derived_from", actorRef: "actor:2" });

  assert.equal(e1.prevHash, null);
  assert.equal(e1.integrityHash.length, 64); // SHA-256 hex is 64 chars
  assert.equal(e2.prevHash, e1.integrityHash);
  assert.equal(e2.integrityHash.length, 64);
});

test("DataLineageService each edge has a unique integrity hash", () => {
  const service = new DataLineageService();
  const e1 = service.recordEdge({ sourceRef: "a:1", targetRef: "b:1", kind: "derived_from", actorRef: "actor:1" });
  const e2 = service.recordEdge({ sourceRef: "a:1", targetRef: "b:2", kind: "derived_from", actorRef: "actor:1" });

  assert.notStrictEqual(e1.integrityHash, e2.integrityHash);
});