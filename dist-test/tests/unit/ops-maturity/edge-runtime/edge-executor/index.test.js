import assert from "node:assert/strict";
import test from "node:test";
import { buildOfflineExecutionRecord, completeOfflineExecution, } from "../../../../../src/ops-maturity/edge-runtime/edge-executor/index.js";
test("buildOfflineExecutionRecord creates record with queued status", () => {
    const result = buildOfflineExecutionRecord("edge-1", "task-1", "2026-04-20T00:00:00Z");
    assert.equal(result.edgeNodeId, "edge-1");
    assert.equal(result.taskId, "task-1");
    assert.equal(result.createdAt, "2026-04-20T00:00:00Z");
    assert.equal(result.syncRequired, true);
    assert.equal(result.status, "queued");
});
test("completeOfflineExecution updates status and adds completedAt", () => {
    const record = buildOfflineExecutionRecord("edge-1", "task-1", "2026-04-20T00:00:00Z");
    const result = completeOfflineExecution(record, "2026-04-20T01:00:00Z");
    assert.equal(result.status, "completed");
    assert.equal(result.completedAt, "2026-04-20T01:00:00Z");
    assert.equal(result.edgeNodeId, "edge-1");
    assert.equal(result.taskId, "task-1");
});
//# sourceMappingURL=index.test.js.map