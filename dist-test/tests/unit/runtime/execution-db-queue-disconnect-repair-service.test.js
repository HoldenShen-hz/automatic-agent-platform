import assert from "node:assert/strict";
import test from "node:test";
import { parseDbQueueDisconnectRepairTemplate } from "../../../src/platform/execution/recovery/execution-db-queue-disconnect-repair-service.js";
test("parseDbQueueDisconnectRepairTemplate recovers queue dispatch metadata from agent execution plan JSON", () => {
    const parsed = parseDbQueueDisconnectRepairTemplate(JSON.stringify({
        priority: "urgent",
        queueName: "priority",
        dispatchTarget: "require_remote",
        requiredIsolationLevel: "strict",
        requiredRepoVersion: "repo-v9",
        requiredCapabilities: ["python", "bash", "python"],
        dispatchAfter: "2026-04-07T13:00:00.000Z",
    }));
    assert.equal(parsed.recoveredFromPlan, true);
    assert.deepEqual(parsed.template, {
        priority: "urgent",
        queueName: "priority",
        dispatchTarget: "require_remote",
        requiredIsolationLevel: "strict",
        requiredRepoVersion: "repo-v9",
        requiredCapabilities: ["bash", "python"],
        dispatchAfter: "2026-04-07T13:00:00.000Z",
    });
});
test("parseDbQueueDisconnectRepairTemplate ignores malformed plan JSON", () => {
    const parsed = parseDbQueueDisconnectRepairTemplate("{not-json");
    assert.equal(parsed.recoveredFromPlan, false);
    assert.deepEqual(parsed.template, {});
});
//# sourceMappingURL=execution-db-queue-disconnect-repair-service.test.js.map