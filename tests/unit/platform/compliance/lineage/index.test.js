import assert from "node:assert/strict";
import test from "node:test";
import { DataLineageService } from "../../../../../src/platform/compliance/lineage/index.js";
test("DataLineageService records edge and returns it with generated ID", () => {
    const service = new DataLineageService();
    const edge = service.recordEdge({
        sourceRef: "prompt:v1",
        targetRef: "artifact:summary-1",
        kind: "derived_from",
        actorRef: "agent:ops",
    });
    assert.ok(edge.edgeId);
    assert.equal(edge.sourceRef, "prompt:v1");
    assert.equal(edge.targetRef, "artifact:summary-1");
    assert.equal(edge.kind, "derived_from");
    assert.equal(edge.actorRef, "agent:ops");
    assert.equal(edge.policyRef, null);
    assert.ok(edge.createdAt);
    assert.deepEqual(edge.metadata, {});
});
test("DataLineageService records edge with optional fields", () => {
    const service = new DataLineageService();
    const edge = service.recordEdge({
        sourceRef: "artifact:source-1",
        targetRef: "artifact:export-1",
        kind: "redacted_from",
        actorRef: "admin: Alice",
        policyRef: "policy-123",
        metadata: { classification: "restricted", redactionApplied: true },
    });
    assert.ok(edge.edgeId);
    assert.equal(edge.policyRef, "policy-123");
    assert.deepEqual(edge.metadata, { classification: "restricted", redactionApplied: true });
});
test("DataLineageService traces edges from source", () => {
    const service = new DataLineageService();
    service.recordEdge({
        sourceRef: "prompt:v1",
        targetRef: "artifact:summary-1",
        kind: "derived_from",
        actorRef: "agent:ops",
    });
    service.recordEdge({
        sourceRef: "artifact:summary-1",
        targetRef: "feedback:1",
        kind: "released_as",
        actorRef: "system:release",
    });
    const fromPrompt = service.traceFrom("prompt:v1");
    assert.equal(fromPrompt.length, 1);
    assert.equal(fromPrompt[0]?.targetRef, "artifact:summary-1");
});
test("DataLineageService traces edges to target", () => {
    const service = new DataLineageService();
    service.recordEdge({
        sourceRef: "prompt:v1",
        targetRef: "artifact:summary-1",
        kind: "derived_from",
        actorRef: "agent:ops",
    });
    service.recordEdge({
        sourceRef: "artifact:summary-1",
        targetRef: "feedback:1",
        kind: "released_as",
        actorRef: "system:release",
    });
    const toFeedback = service.traceTo("feedback:1");
    assert.equal(toFeedback.length, 1);
    assert.equal(toFeedback[0]?.sourceRef, "artifact:summary-1");
});
test("DataLineageService lists all recorded edges", () => {
    const service = new DataLineageService();
    service.recordEdge({
        sourceRef: "a:1",
        targetRef: "b:1",
        kind: "derived_from",
        actorRef: "actor:1",
    });
    service.recordEdge({
        sourceRef: "b:1",
        targetRef: "c:1",
        kind: "released_as",
        actorRef: "actor:2",
    });
    const all = service.listEdges();
    assert.equal(all.length, 2);
});
test("DataLineageService returns empty arrays for non-existent refs", () => {
    const service = new DataLineageService();
    service.recordEdge({
        sourceRef: "a:1",
        targetRef: "b:1",
        kind: "derived_from",
        actorRef: "actor:1",
    });
    assert.equal(service.traceFrom("nonexistent").length, 0);
    assert.equal(service.traceTo("nonexistent").length, 0);
});
test("DataLineageService records all lineage edge kinds", () => {
    const service = new DataLineageService();
    const kinds = [
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
        assert.equal(edge.kind, kind);
    }
    assert.equal(service.listEdges().length, 5);
});
test("DataLineageService listEdges returns copy not reference", () => {
    const service = new DataLineageService();
    service.recordEdge({
        sourceRef: "a:1",
        targetRef: "b:1",
        kind: "derived_from",
        actorRef: "actor:1",
    });
    const edges1 = service.listEdges();
    const edges2 = service.listEdges();
    assert.notStrictEqual(edges1, edges2);
    assert.deepEqual(edges1, edges2);
});
//# sourceMappingURL=index.test.js.map