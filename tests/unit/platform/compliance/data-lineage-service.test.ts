import assert from "node:assert/strict";
import test from "node:test";

import { DataLineageService } from "../../../../src/platform/compliance/lineage/index.js";

test("DataLineageService records an edge", () => {
  const service = new DataLineageService();
  const edge = service.recordEdge({
    sourceRef: "artifact_123",
    targetRef: "artifact_456",
    kind: "derived_from",
    actorRef: "agent_789",
    policyRef: "policy_abc",
  });

  assert.ok(edge.edgeId.startsWith("lineage_"));
  assert.equal(edge.sourceRef, "artifact_123");
  assert.equal(edge.targetRef, "artifact_456");
  assert.equal(edge.kind, "derived_from");
  assert.equal(edge.actorRef, "agent_789");
  assert.equal(edge.policyRef, "policy_abc");
  assert.ok(edge.createdAt);
});

test("DataLineageService records edge with null policyRef", () => {
  const service = new DataLineageService();
  const edge = service.recordEdge({
    sourceRef: "artifact_123",
    targetRef: "artifact_456",
    kind: "erased_by",
    actorRef: "agent_789",
  });

  assert.equal(edge.policyRef, null);
});

test("DataLineageService records edge with metadata", () => {
  const service = new DataLineageService();
  const metadata = { reason: "GDPR request", requestId: "req_123" };
  const edge = service.recordEdge({
    sourceRef: "artifact_123",
    targetRef: "artifact_456",
    kind: "erased_by",
    actorRef: "agent_789",
    metadata,
  });

  assert.deepEqual(edge.metadata, metadata);
});

test("DataLineageService records edge with empty metadata", () => {
  const service = new DataLineageService();
  const edge = service.recordEdge({
    sourceRef: "artifact_123",
    targetRef: "artifact_456",
    kind: "erased_by",
    actorRef: "agent_789",
    metadata: {},
  });

  assert.deepEqual(edge.metadata, {});
});

test("DataLineageService traceFrom returns edges from source", () => {
  const service = new DataLineageService();
  service.recordEdge({
    sourceRef: "artifact_123",
    targetRef: "artifact_456",
    kind: "derived_from",
    actorRef: "agent_1",
  });
  service.recordEdge({
    sourceRef: "artifact_123",
    targetRef: "artifact_789",
    kind: "derived_from",
    actorRef: "agent_1",
  });
  service.recordEdge({
    sourceRef: "artifact_other",
    targetRef: "artifact_456",
    kind: "derived_from",
    actorRef: "agent_1",
  });

  const edges = service.traceFrom("artifact_123");

  assert.equal(edges.length, 2);
  assert.ok(edges.every((e) => e.sourceRef === "artifact_123"));
});

test("DataLineageService traceTo returns edges to target", () => {
  const service = new DataLineageService();
  service.recordEdge({
    sourceRef: "artifact_123",
    targetRef: "artifact_456",
    kind: "derived_from",
    actorRef: "agent_1",
  });
  service.recordEdge({
    sourceRef: "artifact_789",
    targetRef: "artifact_456",
    kind: "derived_from",
    actorRef: "agent_1",
  });
  service.recordEdge({
    sourceRef: "artifact_123",
    targetRef: "artifact_other",
    kind: "derived_from",
    actorRef: "agent_1",
  });

  const edges = service.traceTo("artifact_456");

  assert.equal(edges.length, 2);
  assert.ok(edges.every((e) => e.targetRef === "artifact_456"));
});

test("DataLineageService traceFrom returns empty array for unknown source", () => {
  const service = new DataLineageService();
  const edges = service.traceFrom("unknown");

  assert.equal(edges.length, 0);
});

test("DataLineageService traceTo returns empty array for unknown target", () => {
  const service = new DataLineageService();
  const edges = service.traceTo("unknown");

  assert.equal(edges.length, 0);
});

test("DataLineageService listEdges returns all recorded edges", () => {
  const service = new DataLineageService();
  service.recordEdge({
    sourceRef: "artifact_1",
    targetRef: "artifact_2",
    kind: "derived_from",
    actorRef: "agent_1",
  });
  service.recordEdge({
    sourceRef: "artifact_2",
    targetRef: "artifact_3",
    kind: "derived_from",
    actorRef: "agent_1",
  });

  const edges = service.listEdges();

  assert.equal(edges.length, 2);
});

test("DataLineageService listEdges returns a copy", () => {
  const service = new DataLineageService();
  service.recordEdge({
    sourceRef: "artifact_1",
    targetRef: "artifact_2",
    kind: "derived_from",
    actorRef: "agent_1",
  });

  const edges1 = service.listEdges();
  const edges2 = service.listEdges();

  if (edges1[0] != null) {
    edges1[0].sourceRef = "modified";
  }
  assert.notEqual(edges1[0]?.sourceRef, edges2[0]?.sourceRef);
});

test("DataLineageService supports all lineage edge kinds", () => {
  const service = new DataLineageService();
  const kinds = ["derived_from", "redacted_from", "encrypted_from", "released_as", "erased_by"] as const;

  for (const kind of kinds) {
    const edge = service.recordEdge({
      sourceRef: `source_${kind}`,
      targetRef: `target_${kind}`,
      kind,
      actorRef: "agent_1",
    });
    assert.equal(edge.kind, kind);
  }
});
