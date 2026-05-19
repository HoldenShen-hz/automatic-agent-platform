import assert from "node:assert/strict";
import test from "node:test";
import { DataLineageService } from "../../../../src/platform/compliance/lineage/index.js";
// Helper to create a lineage edge with defaults
function createEdgeInput(overrides = {}) {
    return {
        sourceRef: "task_123",
        targetRef: "artifact_456",
        kind: "derived_from",
        actorRef: "agent_789",
        policyRef: null,
        metadata: {},
        ...overrides,
    };
}
test("recordEdge creates and stores an edge", () => {
    const service = new DataLineageService();
    const input = createEdgeInput();
    const edge = service.recordEdge(input);
    assert.ok(edge.edgeId.startsWith("lineage_"), "edgeId should have lineage_ prefix");
    assert.equal(edge.sourceRef, input.sourceRef);
    assert.equal(edge.targetRef, input.targetRef);
    assert.equal(edge.kind, input.kind);
    assert.equal(edge.actorRef, input.actorRef);
    assert.equal(edge.policyRef, null);
    assert.ok(edge.createdAt.length > 0, "createdAt should be set");
});
test("recordEdge with optional fields", () => {
    const service = new DataLineageService();
    const input = createEdgeInput({
        policyRef: "policy_abc",
        metadata: { reason: "test" },
    });
    const edge = service.recordEdge(input);
    assert.equal(edge.policyRef, "policy_abc");
    assert.deepEqual(edge.metadata, { reason: "test" });
});
test("traceFrom returns edges from a source", () => {
    const service = new DataLineageService();
    service.recordEdge(createEdgeInput({ sourceRef: "task_1", targetRef: "artifact_a" }));
    service.recordEdge(createEdgeInput({ sourceRef: "task_2", targetRef: "artifact_b" }));
    service.recordEdge(createEdgeInput({ sourceRef: "task_1", targetRef: "artifact_c" }));
    const edges = service.traceFrom("task_1");
    assert.equal(edges.length, 2);
    assert.ok(edges.every((e) => e.sourceRef === "task_1"));
});
test("traceFrom returns empty array when no matches", () => {
    const service = new DataLineageService();
    service.recordEdge(createEdgeInput({ sourceRef: "task_1" }));
    const edges = service.traceFrom("task_nonexistent");
    assert.equal(edges.length, 0);
});
test("traceTo returns edges to a target", () => {
    const service = new DataLineageService();
    service.recordEdge(createEdgeInput({ sourceRef: "task_1", targetRef: "artifact_x" }));
    service.recordEdge(createEdgeInput({ sourceRef: "task_2", targetRef: "artifact_x" }));
    service.recordEdge(createEdgeInput({ sourceRef: "task_3", targetRef: "artifact_y" }));
    const edges = service.traceTo("artifact_x");
    assert.equal(edges.length, 2);
    assert.ok(edges.every((e) => e.targetRef === "artifact_x"));
});
test("traceTo returns empty array when no matches", () => {
    const service = new DataLineageService();
    service.recordEdge(createEdgeInput({ targetRef: "artifact_1" }));
    const edges = service.traceTo("artifact_nonexistent");
    assert.equal(edges.length, 0);
});
test("listEdges returns all recorded edges", () => {
    const service = new DataLineageService();
    service.recordEdge(createEdgeInput({ sourceRef: "task_1", targetRef: "artifact_1" }));
    service.recordEdge(createEdgeInput({ sourceRef: "task_2", targetRef: "artifact_2" }));
    const edges = service.listEdges();
    assert.equal(edges.length, 2);
});
test("listEdges returns a copy of the array", () => {
    const service = new DataLineageService();
    service.recordEdge(createEdgeInput());
    const edges1 = service.listEdges();
    const edges2 = service.listEdges();
    assert.notEqual(edges1, edges2, "listEdges should return a new array each time");
    assert.deepEqual(edges1, edges2);
});
test("listEdges is not affected by external mutations", () => {
    const service = new DataLineageService();
    service.recordEdge(createEdgeInput());
    const edges = service.listEdges();
    edges.push({});
    const currentEdges = service.listEdges();
    assert.equal(currentEdges.length, 1, "listEdges should not be affected by external mutations");
});
test("recordEdge handles all edge kinds", () => {
    const service = new DataLineageService();
    const kinds = [
        "derived_from",
        "redacted_from",
        "encrypted_from",
        "released_as",
        "erased_by",
    ];
    for (const kind of kinds) {
        const edge = service.recordEdge(createEdgeInput({ kind }));
        assert.equal(edge.kind, kind, `Should handle kind: ${kind}`);
    }
});
//# sourceMappingURL=lineage.test.js.map