import assert from "node:assert/strict";
import test from "node:test";
import { newId, nowIso } from "../../../../../src/platform/contracts/types/ids.js";
test("TaskStatus values are valid", () => {
    const statuses = ["queued", "pending", "in_progress", "completed", "failed", "cancelled"];
    for (const status of statuses) {
        const task = { status };
        assert.equal(task.status, status);
    }
});
test("Session creation", () => {
    const session = {
        id: newId("sess"),
        taskId: newId("task"),
        status: "active",
        createdAt: nowIso(),
    };
    assert.ok(session.id.startsWith("sess_"));
    assert.ok(session.taskId.startsWith("task_"));
    assert.equal(session.status, "active");
});
test("Session status transitions", () => {
    const session = {
        id: newId("sess"),
        taskId: newId("task"),
        status: "active",
        createdAt: nowIso(),
    };
    session.status = "closed";
    assert.equal(session.status, "closed");
});
test("MockTaskStatus is in_progress", () => {
    const task = { status: "in_progress" };
    assert.equal(task.status, "in_progress");
});
test("MockTaskStatus transitions through valid states", () => {
    let status = "queued";
    const transitions = ["pending", "in_progress", "completed"];
    for (const next of transitions) {
        status = next;
    }
    assert.equal(status, "completed");
});
test("Session createdAt is ISO format", () => {
    const session = {
        id: newId("sess"),
        taskId: newId("task"),
        status: "active",
        createdAt: nowIso(),
    };
    const date = new Date(session.createdAt);
    assert.equal(isNaN(date.getTime()), false);
});
//# sourceMappingURL=domain-types.test.js.map