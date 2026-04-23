import test from "node:test";
import assert from "node:assert/strict";
import { DurableHarnessService } from "../../../../../src/platform/orchestration/harness/durable/durable-harness-service.js";
test("DurableHarnessService is exported from durable index", () => {
    const service = new DurableHarnessService();
    assert.ok(service !== undefined);
    assert.equal(typeof service.persist, "function");
    assert.equal(typeof service.checkpoint, "function");
    assert.equal(typeof service.restore, "function");
    assert.equal(typeof service.restoreFromCheckpoint, "function");
    assert.equal(typeof service.getCheckpointRef, "function");
});
test("durable index exports DurableHarnessService", async () => {
    const mod = await import("../../../../../src/platform/orchestration/harness/durable/index.js");
    assert.ok("DurableHarnessService" in mod);
});
//# sourceMappingURL=durable.test.js.map