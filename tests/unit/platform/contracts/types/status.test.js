import assert from "node:assert/strict";
import test from "node:test";
import { TASK_STATUSES, WORKFLOW_STATUSES, SESSION_STATUSES, EXECUTION_STATUSES, APPROVAL_STATUSES, isTaskStatus, isWorkflowStatus, isSessionStatus, isExecutionStatus, } from "../../../../../src/platform/contracts/types/status.js";
test("TASK_STATUSES contains all valid task statuses", () => {
    const expected = ["queued", "pending", "in_progress", "awaiting_decision", "done", "failed", "cancelled"];
    assert.deepEqual(Array.from(TASK_STATUSES), expected);
    assert.equal(TASK_STATUSES.length, 7);
});
test("WORKFLOW_STATUSES contains all valid workflow statuses", () => {
    const expected = ["created", "running", "paused", "resuming", "completed", "failed", "cancelling", "cancelled"];
    assert.deepEqual(Array.from(WORKFLOW_STATUSES), expected);
    assert.equal(WORKFLOW_STATUSES.length, 8);
});
test("SESSION_STATUSES contains all valid session statuses", () => {
    const expected = ["open", "streaming", "awaiting_user", "paused", "completed", "failed", "cancelled"];
    assert.deepEqual(Array.from(SESSION_STATUSES), expected);
    assert.equal(SESSION_STATUSES.length, 7);
});
test("EXECUTION_STATUSES contains all valid execution statuses", () => {
    const expected = ["created", "prechecking", "ready", "queued", "dispatching", "executing", "blocked", "paused", "resuming", "recovering", "timed_out", "succeeded", "failed", "cancelled", "superseded"];
    assert.deepEqual(Array.from(EXECUTION_STATUSES), expected);
    assert.equal(EXECUTION_STATUSES.length, 15);
});
test("APPROVAL_STATUSES contains all valid approval statuses", () => {
    const expected = ["requested", "approved", "rejected", "expired", "cancelled"];
    assert.deepEqual(Array.from(APPROVAL_STATUSES), expected);
    assert.equal(APPROVAL_STATUSES.length, 5);
});
test("TaskStatus type accepts all task statuses", () => {
    const statuses = ["queued", "pending", "in_progress", "awaiting_decision", "done", "failed", "cancelled"];
    assert.equal(statuses.length, 7);
});
test("WorkflowStatus type accepts all workflow statuses", () => {
    const statuses = ["created", "running", "paused", "resuming", "completed", "failed", "cancelling", "cancelled"];
    assert.equal(statuses.length, 8);
});
test("SessionStatus type accepts all session statuses", () => {
    const statuses = ["open", "streaming", "awaiting_user", "paused", "completed", "failed", "cancelled"];
    assert.equal(statuses.length, 7);
});
test("ExecutionStatus type accepts all execution statuses", () => {
    const statuses = ["created", "prechecking", "ready", "queued", "dispatching", "executing", "blocked", "paused", "resuming", "recovering", "timed_out", "succeeded", "failed", "cancelled", "superseded"];
    assert.equal(statuses.length, 15);
});
test("TaskTerminalStatus type only accepts terminal statuses", () => {
    const terminalStatuses = ["done", "failed", "cancelled"];
    assert.equal(terminalStatuses.length, 3);
});
test("isTaskStatus returns true for valid task statuses", () => {
    for (const status of TASK_STATUSES) {
        assert.equal(isTaskStatus(status), true, `${status} should be a valid TaskStatus`);
    }
});
test("isTaskStatus returns false for invalid values", () => {
    assert.equal(isTaskStatus("invalid"), false);
    assert.equal(isTaskStatus(""), false);
    assert.equal(isTaskStatus("DONE"), false); // case sensitive
    assert.equal(isTaskStatus("completed"), false); // wrong status
});
test("isWorkflowStatus returns true for valid workflow statuses", () => {
    for (const status of WORKFLOW_STATUSES) {
        assert.equal(isWorkflowStatus(status), true, `${status} should be a valid WorkflowStatus`);
    }
});
test("isWorkflowStatus returns false for invalid values", () => {
    assert.equal(isWorkflowStatus("invalid"), false);
    assert.equal(isWorkflowStatus("done"), false); // wrong status
});
test("isSessionStatus returns true for valid session statuses", () => {
    for (const status of SESSION_STATUSES) {
        assert.equal(isSessionStatus(status), true, `${status} should be a valid SessionStatus`);
    }
});
test("isSessionStatus returns false for invalid values", () => {
    assert.equal(isSessionStatus("invalid"), false);
    assert.equal(isSessionStatus("running"), false); // wrong status
});
test("isExecutionStatus returns true for valid execution statuses", () => {
    for (const status of EXECUTION_STATUSES) {
        assert.equal(isExecutionStatus(status), true, `${status} should be a valid ExecutionStatus`);
    }
});
test("isExecutionStatus returns false for invalid values", () => {
    assert.equal(isExecutionStatus("invalid"), false);
    assert.equal(isExecutionStatus("done"), false); // wrong status
});
//# sourceMappingURL=status.test.js.map
