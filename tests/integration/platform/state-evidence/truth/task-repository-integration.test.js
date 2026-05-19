// @ts-nocheck
/**
 * Integration Tests: Task Repository Operations
 *
 * Tests for task CRUD operations using AuthoritativeTaskStore
 * with SQLite in-memory database.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { createIntegrationContext } from "../../../../helpers/integration-context.js";
test("task repository persists and retrieves task", () => {
    const ctx = createIntegrationContext("aa-task-repo-");
    try {
        const taskId = "task-integrated-001";
        const now = new Date().toISOString();
        ctx.store.insertTask({
            id: taskId,
            parentId: null,
            rootId: taskId,
            divisionId: "general_ops",
            tenantId: "tenant-test",
            title: "Integration Test Task",
            status: "queued",
            source: "user",
            priority: "normal",
            inputJson: '{"test":"value"}',
            normalizedInputJson: '{"test":"value"}',
            outputJson: null,
            estimatedCostUsd: 0,
            actualCostUsd: 0,
            errorCode: null,
            createdAt: now,
            updatedAt: now,
            completedAt: null,
        });
        const retrieved = ctx.store.getTask(taskId);
        assert.ok(retrieved, "Task should be retrieved");
        assert.equal(retrieved.id, taskId);
        assert.equal(retrieved.title, "Integration Test Task");
        assert.equal(retrieved.status, "queued");
        assert.equal(retrieved.tenantId, "tenant-test");
    }
    finally {
        ctx.cleanup();
    }
});
test("task repository returns null for non-existent task", () => {
    const ctx = createIntegrationContext("aa-task-notfound-");
    try {
        const result = ctx.store.getTask("non-existent-task");
        assert.equal(result, null);
    }
    finally {
        ctx.cleanup();
    }
});
test("task repository updates task status", () => {
    const ctx = createIntegrationContext("aa-task-update-");
    try {
        const taskId = "task-update-001";
        const now = new Date().toISOString();
        ctx.db.transaction(() => {
            ctx.store.insertTask({
                id: taskId,
                parentId: null,
                rootId: taskId,
                divisionId: "general_ops",
                tenantId: "tenant-update",
                title: "Update Test Task",
                status: "queued",
                source: "user",
                priority: "normal",
                inputJson: "{}",
                normalizedInputJson: "{}",
                outputJson: null,
                estimatedCostUsd: 0,
                actualCostUsd: 0,
                errorCode: null,
                createdAt: now,
                updatedAt: now,
                completedAt: null,
            });
        });
        const updateTime = new Date().toISOString();
        ctx.db.transaction(() => {
            ctx.store.updateTaskStatus(taskId, "in_progress", updateTime, null, null);
        });
        const updated = ctx.store.getTask(taskId);
        assert.equal(updated.status, "in_progress");
        assert.equal(updated.updatedAt, updateTime);
    }
    finally {
        ctx.cleanup();
    }
});
test("task repository updates task output", () => {
    const ctx = createIntegrationContext("aa-task-output-");
    try {
        const taskId = "task-output-001";
        const now = new Date().toISOString();
        ctx.db.transaction(() => {
            ctx.store.insertTask({
                id: taskId,
                parentId: null,
                rootId: taskId,
                divisionId: "general_ops",
                tenantId: "tenant-output",
                title: "Output Test Task",
                status: "queued",
                source: "user",
                priority: "normal",
                inputJson: "{}",
                normalizedInputJson: "{}",
                outputJson: null,
                estimatedCostUsd: 0,
                actualCostUsd: 0,
                errorCode: null,
                createdAt: now,
                updatedAt: now,
                completedAt: null,
            });
        });
        const outputJson = '{"result":"success","data":{"key":"value"}}';
        const updateTime = new Date().toISOString();
        ctx.db.transaction(() => {
            ctx.store.updateTaskOutput(taskId, outputJson, updateTime);
        });
        const updated = ctx.store.getTask(taskId);
        assert.equal(updated.outputJson, outputJson);
        assert.equal(updated.status, "queued");
    }
    finally {
        ctx.cleanup();
    }
});
test("task repository lists tasks with pagination", () => {
    const ctx = createIntegrationContext("aa-task-list-");
    try {
        const tenantId = "tenant-list";
        const now = new Date().toISOString();
        ctx.db.transaction(() => {
            for (let i = 0; i < 10; i++) {
                ctx.store.insertTask({
                    id: `task-list-${i}`,
                    parentId: null,
                    rootId: `task-list-${i}`,
                    divisionId: "general_ops",
                    tenantId,
                    title: `Task ${i}`,
                    status: "queued",
                    source: "user",
                    priority: i % 2 === 0 ? "high" : "normal",
                    inputJson: "{}",
                    normalizedInputJson: "{}",
                    outputJson: null,
                    estimatedCostUsd: 0,
                    actualCostUsd: 0,
                    errorCode: null,
                    createdAt: now,
                    updatedAt: now,
                    completedAt: null,
                });
            }
        });
        const tasks = ctx.store.listTasks(5, tenantId);
        assert.equal(tasks.length, 5);
    }
    finally {
        ctx.cleanup();
    }
});
test("task repository maintains parent-child relationships", () => {
    const ctx = createIntegrationContext("aa-task-parent-");
    try {
        const parentId = "task-parent-001";
        const childId = "task-child-001";
        const now = new Date().toISOString();
        ctx.db.transaction(() => {
            ctx.store.insertTask({
                id: parentId,
                parentId: null,
                rootId: parentId,
                divisionId: "general_ops",
                tenantId: "tenant-parent",
                title: "Parent Task",
                status: "in_progress",
                source: "user",
                priority: "high",
                inputJson: "{}",
                normalizedInputJson: "{}",
                outputJson: null,
                estimatedCostUsd: 0,
                actualCostUsd: 0,
                errorCode: null,
                createdAt: now,
                updatedAt: now,
                completedAt: null,
            });
            ctx.store.insertTask({
                id: childId,
                parentId,
                rootId: parentId,
                divisionId: "general_ops",
                tenantId: "tenant-parent",
                title: "Child Task",
                status: "queued",
                source: "user",
                priority: "normal",
                inputJson: "{}",
                normalizedInputJson: "{}",
                outputJson: null,
                estimatedCostUsd: 0,
                actualCostUsd: 0,
                errorCode: null,
                createdAt: now,
                updatedAt: now,
                completedAt: null,
            });
        });
        const parent = ctx.store.getTask(parentId);
        assert.equal(parent.id, parentId);
        assert.equal(parent.rootId, parentId);
        const child = ctx.store.getTask(childId);
        assert.equal(child.parentId, parentId);
        assert.equal(child.rootId, parentId);
    }
    finally {
        ctx.cleanup();
    }
});
//# sourceMappingURL=task-repository-integration.test.js.map