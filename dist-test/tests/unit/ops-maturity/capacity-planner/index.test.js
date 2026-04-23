import assert from "node:assert/strict";
import test from "node:test";
import * as capacityPlanner from "../../../../src/ops-maturity/capacity-planner/index.js";
test("capacity-planner index exports CapacityPlanningService", () => {
    assert.ok(capacityPlanner);
    assert.equal(typeof capacityPlanner.CapacityPlanningService, "function");
});
//# sourceMappingURL=index.test.js.map