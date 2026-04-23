import assert from "node:assert/strict";
import test from "node:test";
import * as monitoring from "../../../../src/ops-maturity/monitoring/index.js";
test("monitoring index exports AnomalyDetectionService", () => {
    assert.ok(monitoring);
    assert.equal(typeof monitoring.AnomalyDetectionService, "function");
});
//# sourceMappingURL=index.test.js.map