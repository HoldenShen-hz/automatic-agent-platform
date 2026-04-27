import assert from "node:assert/strict";
import test from "node:test";

import { DataLineageService } from "../../../../../src/platform/compliance/lineage/index.js";

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