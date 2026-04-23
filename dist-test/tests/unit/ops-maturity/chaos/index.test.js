import assert from "node:assert/strict";
import test from "node:test";
import * as chaos from "../../../../src/ops-maturity/chaos/index.js";
test("chaos index exports ChaosExperimentScheduler", () => {
    assert.ok(chaos);
    assert.equal(typeof chaos.ChaosExperimentScheduler, "function");
});
//# sourceMappingURL=index.test.js.map