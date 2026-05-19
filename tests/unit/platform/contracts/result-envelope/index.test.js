import assert from "node:assert/strict";
import test from "node:test";
test("ResultEnvelopeStatus type accepts valid values", () => {
    const statuses = ["success", "partial", "error"];
    assert.equal(statuses.length, 3);
});
test("ResultEnvelopeError structure is correct", () => {
    const error = {
        code: "task.execution_failed",
        message: "Task failed",
    };
    assert.equal(error.code, "task.execution_failed");
    assert.equal(error.message, "Task failed");
});
test("ResultEnvelopeError with null message", () => {
    const error = {
        code: "task.unknown",
        message: null,
    };
    assert.equal(error.code, "task.unknown");
    assert.equal(error.message, null);
});
test("ResultEnvelope structure is correct", () => {
    const envelope = {
        resultId: "result_123",
        status: "success",
        structuredData: { taskId: "task_123", result: "completed" },
        humanSummary: null,
        warnings: [],
        artifacts: [],
        metrics: null,
        error: null,
        provenance: null,
    };
    assert.equal(envelope.resultId, "result_123");
    assert.equal(envelope.status, "success");
});
test("ResultEnvelope with error", () => {
    const envelope = {
        resultId: "result_456",
        status: "error",
        structuredData: null,
        humanSummary: "Task failed",
        warnings: [],
        artifacts: [],
        metrics: null,
        error: {
            code: "task.execution_failed",
            message: "Task failed",
        },
        provenance: null,
    };
    assert.equal(envelope.status, "error");
    assert.ok(envelope.error !== null);
    assert.equal(envelope.error.code, "task.execution_failed");
});
test("ResultEnvelope with partial status", () => {
    const envelope = {
        resultId: "result_789",
        status: "partial",
        structuredData: { taskId: "task_123", result: "partial" },
        humanSummary: "Some steps failed",
        warnings: ["step_2 timed out"],
        artifacts: [],
        metrics: { durationMs: 5000 },
        error: {
            code: "task.partial_failure",
            message: "Some steps failed",
        },
        provenance: null,
    };
    assert.equal(envelope.status, "partial");
    assert.deepEqual(envelope.warnings, ["step_2 timed out"]);
    assert.deepEqual(envelope.metrics, { durationMs: 5000 });
});
//# sourceMappingURL=index.test.js.map