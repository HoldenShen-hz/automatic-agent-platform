import test from "node:test";
import assert from "node:assert/strict";
import { TaskBoardService } from "../../../../../src/platform/shared/observability/task-board-service.js";
function makeTaskBoardItem(overrides) {
    return {
        title: `Task ${overrides.taskId}`,
        priority: "normal",
        workflowStatus: null,
        divisionId: null,
        currentStepIndex: null,
        sessionStatus: null,
        latestEventAt: null,
        updatedAt: "2024-01-01T00:00:00.000Z",
        ...overrides,
    };
}
function makeMockStore(items = []) {
    return {
        operations: {
            listTaskBoardItems: (limit) => items.slice(0, limit),
        },
    };
}
test("list returns items from store with default limit", () => {
    const items = [
        makeTaskBoardItem({ taskId: "task_1", taskStatus: "pending" }),
        makeTaskBoardItem({ taskId: "task_2", taskStatus: "in_progress" }),
    ];
    const store = makeMockStore(items);
    const service = new TaskBoardService(store);
    const result = service.list();
    assert.equal(result.length, 2);
    assert.equal(result[0].taskId, "task_1");
});
test("list respects custom limit", () => {
    const items = [
        makeTaskBoardItem({ taskId: "task_1", taskStatus: "pending" }),
        makeTaskBoardItem({ taskId: "task_2", taskStatus: "in_progress" }),
        makeTaskBoardItem({ taskId: "task_3", taskStatus: "done" }),
    ];
    const store = makeMockStore(items);
    const service = new TaskBoardService(store);
    const result = service.list(2);
    assert.equal(result.length, 2);
});
test("list returns empty array when store has no items", () => {
    const store = makeMockStore([]);
    const service = new TaskBoardService(store);
    const result = service.list();
    assert.deepEqual(result, []);
});
test("list preserves all fields from store items", () => {
    const items = [
        makeTaskBoardItem({
            taskId: "task_x",
            taskStatus: "in_progress",
            title: "Custom Title",
            priority: "high",
            workflowStatus: "running",
            divisionId: "div_abc",
        }),
    ];
    const store = makeMockStore(items);
    const service = new TaskBoardService(store);
    const result = service.list();
    assert.equal(result[0].taskId, "task_x");
    assert.equal(result[0].title, "Custom Title");
    assert.equal(result[0].priority, "high");
    assert.equal(result[0].workflowStatus, "running");
});
//# sourceMappingURL=task-board-service.test.js.map