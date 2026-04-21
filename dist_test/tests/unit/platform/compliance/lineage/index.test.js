import assert from "node:assert/strict";
import test from "node:test";
import { DataLineageService } from "../../../../../src/platform/compliance/lineage/index.js";
test("DataLineageService records and traces lineage edges", () => {
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
    assert.equal(service.traceFrom("prompt:v1").length, 1);
    assert.equal(service.traceTo("feedback:1").length, 1);
});
//# sourceMappingURL=index.test.js.map