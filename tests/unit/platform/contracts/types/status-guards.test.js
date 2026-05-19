import assert from "node:assert/strict";
import test from "node:test";
import { isTaskStatus, isWorkflowStatus, isSessionStatus, isExecutionStatus, isSessionTerminalStatus, } from "../../../../../src/platform/contracts/types/status.js";
test("isTaskStatus returns true for all valid task statuses", () => {
    const validStatuses = ["queued", "pending", "in_progress", "awaiting_decision", "done", "failed", "cancelled"];
    for (const status of validStatuses) {
        assert.equal(isTaskStatus(status), true, `${status} should be a valid task status`);
    }
});
test("isTaskStatus returns false for invalid values", () => {
    assert.equal(isTaskStatus("completed"), false);
    assert.equal(isTaskStatus("running"), false);
    assert.equal(isTaskStatus("invalid"), false);
    assert.equal(isTaskStatus(""), false);
    assert.equal(isTaskStatus("DONE"), false);
    assert.equal(isTaskStatus("Done"), false);
});
test("isWorkflowStatus returns true for all valid workflow statuses", () => {
    const validStatuses = ["running", "paused", "resuming", "completed", "failed", "cancelling", "cancelled"];
    for (const status of validStatuses) {
        assert.equal(isWorkflowStatus(status), true, `${status} should be a valid workflow status`);
    }
});
test("isWorkflowStatus returns false for invalid values", () => {
    assert.equal(isWorkflowStatus("done"), false);
    assert.equal(isWorkflowStatus("pending"), false);
    assert.equal(isWorkflowStatus("invalid"), false);
    assert.equal(isWorkflowStatus(""), false);
});
test("isSessionStatus returns true for all valid session statuses", () => {
    const validStatuses = ["open", "streaming", "awaiting_user", "paused", "completed", "failed", "cancelled"];
    for (const status of validStatuses) {
        assert.equal(isSessionStatus(status), true, `${status} should be a valid session status`);
    }
});
test("isSessionStatus returns false for invalid values", () => {
    assert.equal(isSessionStatus("running"), false);
    assert.equal(isSessionStatus("done"), false);
    assert.equal(isSessionStatus("invalid"), false);
});
test("isExecutionStatus returns true for all valid execution statuses", () => {
    const validStatuses = ["created", "prechecking", "executing", "blocked", "succeeded", "failed", "cancelled", "superseded"];
    for (const status of validStatuses) {
        assert.equal(isExecutionStatus(status), true, `${status} should be a valid execution status`);
    }
});
test("isExecutionStatus returns false for invalid values", () => {
    assert.equal(isExecutionStatus("done"), false);
    assert.equal(isExecutionStatus("pending"), false);
    assert.equal(isExecutionStatus("invalid"), false);
});
test("isSessionTerminalStatus returns true for terminal session statuses", () => {
    assert.equal(isSessionTerminalStatus("completed"), true);
    assert.equal(isSessionTerminalStatus("failed"), true);
    assert.equal(isSessionTerminalStatus("cancelled"), true);
});
test("isSessionTerminalStatus returns false for non-terminal session statuses", () => {
    assert.equal(isSessionTerminalStatus("open"), false);
    assert.equal(isSessionTerminalStatus("streaming"), false);
    assert.equal(isSessionTerminalStatus("awaiting_user"), false);
    assert.equal(isSessionTerminalStatus("paused"), false);
});
test("TaskStatus type guard narrows correctly at runtime", () => {
    const values = ["queued", "pending", "in_progress", "awaiting_decision", "done", "failed", "cancelled"];
    for (const value of values) {
        if (isTaskStatus(value)) {
            assert.ok(typeof value === "string");
        }
    }
});
test("WorkflowStatus type guard narrows correctly at runtime", () => {
    const values = ["running", "paused", "resuming", "completed", "failed", "cancelling", "cancelled"];
    for (const value of values) {
        if (isWorkflowStatus(value)) {
            assert.ok(typeof value === "string");
        }
    }
});
test("SessionStatus type guard narrows correctly at runtime", () => {
    const values = ["open", "streaming", "awaiting_user", "paused", "completed", "failed", "cancelled"];
    for (const value of values) {
        if (isSessionStatus(value)) {
            assert.ok(typeof value === "string");
        }
    }
});
test("ExecutionStatus type guard narrows correctly at runtime", () => {
    const values = ["created", "prechecking", "executing", "blocked", "succeeded", "failed", "cancelled", "superseded"];
    for (const value of values) {
        if (isExecutionStatus(value)) {
            assert.ok(typeof value === "string");
        }
    }
});
test("type guard functions work with string variables", () => {
    let taskStatus = "queued";
    let workflowStatus = "running";
    let sessionStatus = "open";
    let executionStatus = "created";
    assert.equal(isTaskStatus(taskStatus), true);
    assert.equal(isWorkflowStatus(workflowStatus), true);
    assert.equal(isSessionStatus(sessionStatus), true);
    assert.equal(isExecutionStatus(executionStatus), true);
});
test("type guard functions return false for null and undefined", () => {
    assert.equal(isTaskStatus(null), false);
    assert.equal(isTaskStatus(undefined), false);
    assert.equal(isWorkflowStatus(null), false);
    assert.equal(isWorkflowStatus(undefined), false);
    assert.equal(isSessionStatus(null), false);
    assert.equal(isSessionStatus(undefined), false);
    assert.equal(isExecutionStatus(null), false);
    assert.equal(isExecutionStatus(undefined), false);
});
test("isSessionTerminalStatus returns false for null and undefined", () => {
    assert.equal(isSessionTerminalStatus(null), false);
    assert.equal(isSessionTerminalStatus(undefined), false);
});
test("status functions work with task status strings from external input", () => {
    // Simulating external input that could be any string
    const externalInput = "done";
    if (isTaskStatus(externalInput)) {
        // Type narrowed to TaskStatus
        assert.equal(externalInput, "done");
    }
});
test("status functions distinguish between similar status values", () => {
    // Task status vs Workflow status - both have "running/completed/failed" but different
    assert.equal(isTaskStatus("running"), false);
    assert.equal(isWorkflowStatus("running"), true);
    assert.equal(isTaskStatus("completed"), false);
    assert.equal(isWorkflowStatus("completed"), true);
});
//# sourceMappingURL=status-guards.test.js.map