import assert from "node:assert/strict";
import test from "node:test";
import { PhaseDeliveryService, RoadmapService, SuccessCriteriaService, } from "../../../../src/domains/roadmap/index.js";
function assertTypeExport(_value) {
    return true;
}
test("roadmap index module exports RoadmapService", () => {
    assert.equal(typeof RoadmapService, "function");
});
test("roadmap index module re-exports types for compile-time consumers", () => {
    assert.equal(assertTypeExport(null), true);
});
test("roadmap index module exports PhaseDeliveryService", () => {
    assert.equal(typeof PhaseDeliveryService, "function");
});
test("roadmap index module exports SuccessCriteriaService", () => {
    assert.equal(typeof SuccessCriteriaService, "function");
});
//# sourceMappingURL=index.test.js.map