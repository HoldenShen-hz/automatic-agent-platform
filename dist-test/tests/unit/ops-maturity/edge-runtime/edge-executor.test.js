import assert from "node:assert/strict";
import test from "node:test";
import { buildOfflineExecutionRecord, completeOfflineExecution, } from "../../../../src/ops-maturity/edge-runtime/edge-executor/index.js";
test("buildOfflineExecutionRecord creates a valid queued record", () => {
    const record = buildOfflineExecutionRecord("edge_1", "task_1", "2026-04-20T00:00:00.000Z");
    assert.equal(record.edgeNodeId, "edge_1");
    assert.equal(record.taskId, "task_1");
    assert.equal(record.createdAt, "2026-04-20T00:00:00.000Z");
    assert.equal(record.syncRequired, true);
    assert.equal(record.status, "queued");
    assert.equal(record.completedAt, undefined);
});
test("buildOfflineExecutionRecord defaults syncRequired to true", () => {
    const record = buildOfflineExecutionRecord("edge_factory", "task_xyz", "2026-04-20T12:00:00.000Z");
    assert.equal(record.syncRequired, true);
});
test("completeOfflineExecution transitions record to completed status", () => {
    const original = buildOfflineExecutionRecord("edge_1", "task_1", "2026-04-20T00:00:00.000Z");
    const completed = completeOfflineExecution(original, "2026-04-20T01:00:00.000Z");
    assert.equal(completed.status, "completed");
    assert.equal(completed.completedAt, "2026-04-20T01:00:00.000Z");
    assert.equal(completed.edgeNodeId, original.edgeNodeId);
    assert.equal(completed.taskId, original.taskId);
    assert.equal(completed.createdAt, original.createdAt);
    assert.equal(completed.syncRequired, original.syncRequired);
});
test("completeOfflineExecution does not mutate original record", () => {
    const original = buildOfflineExecutionRecord("edge_1", "task_1", "2026-04-20T00:00:00.000Z");
    assert.equal(original.status, "queued");
    assert.equal(original.completedAt, undefined);
    completeOfflineExecution(original, "2026-04-20T01:00:00.000Z");
    assert.equal(original.status, "queued");
    assert.equal(original.completedAt, undefined);
});
test("OfflineExecutionRecord has correct type shape", () => {
    const record = {
        edgeNodeId: "edge_test",
        taskId: "task_test",
        createdAt: "2026-04-20T00:00:00.000Z",
        syncRequired: true,
        status: "running",
    };
    assert.equal(record.edgeNodeId, "edge_test");
    assert.equal(record.status, "running");
});
//# sourceMappingURL=edge-executor.test.js.map