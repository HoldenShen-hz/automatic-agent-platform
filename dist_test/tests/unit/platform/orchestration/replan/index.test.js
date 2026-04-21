import assert from "node:assert/strict";
import test from "node:test";
import { ReplanningService } from "../../../../../src/platform/orchestration/replan/index.js";
test("replan barrel exports ReplanningService", () => {
    const service = new ReplanningService();
    assert.equal(typeof service.createTrigger, "function");
    assert.equal(typeof service.decide, "function");
});
//# sourceMappingURL=index.test.js.map