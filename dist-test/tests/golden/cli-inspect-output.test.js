/**
 * Golden Test: CLI Inspect Command Output
 *
 * Verifies inspect CLI tool produces consistent JSON output structure
 * for various inspection kinds (task, execution, approval, tasks, workflows, etc.)
 */
import test from "node:test";
import assert from "node:assert/strict";
import { nowIso } from "../../src/platform/contracts/types/ids.js";
import { SqliteDatabase } from "../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { seedTaskAndExecution } from "../helpers/seed.js";
import { cleanupPath, createTempWorkspace } from "../helpers/fs.js";
import { assertGolden } from "../helpers/golden.js";
import { InspectService } from "../../src/platform/shared/observability/inspect-service.js";
test("golden: inspect task output has expected structure", () => {
    const workspace = createTempWorkspace("aa-golden-inspect-task-");
    const dbPath = `${workspace}/inspect-task.db`;
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const inspect = new InspectService(store);
    // Use deterministic IDs for golden tests
    const taskId = "test_task_001";
    const executionId = "test_exec_001";
    const traceId = "inspect-trace-task";
    seedTaskAndExecution(db, store, { taskId, executionId, traceId });
    const result = inspect.getTaskInspectView(taskId);
    // Verify structure has all required fields
    assert.ok(result.task, "Task should be present");
    assert.equal(result.task.id, taskId);
    assert.ok(result.recoverySummary, "Recovery summary should be present");
    assert.ok(typeof result.recoverySummary.hasTerminalTask === "boolean");
    assert.ok(typeof result.recoverySummary.activeExecutionId === "string" || result.recoverySummary.activeExecutionId === null);
    assertGolden("cli-inspect-task-output", {
        taskId: result.task.id,
        taskStatus: result.task.status,
        hasWorkflow: result.workflowState !== null,
        hasExecution: result.execution !== null,
        hasSession: result.session !== null,
        recoverySummary: result.recoverySummary,
    });
    db.close();
    cleanupPath(workspace);
});
test("golden: inspect execution output has expected structure", () => {
    const workspace = createTempWorkspace("aa-golden-inspect-exec-");
    const dbPath = `${workspace}/inspect-exec.db`;
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const inspect = new InspectService(store);
    const taskId = "test_task_exec_001";
    const executionId = "test_exec_exec_001";
    const traceId = "inspect-trace-exec";
    seedTaskAndExecution(db, store, { taskId, executionId, traceId });
    const result = inspect.getExecutionInspectView(executionId);
    // Verify structure
    assert.ok(result.execution, "Execution should be present");
    assert.equal(result.execution.id, executionId);
    assert.ok(result.task, "Task should be present");
    assertGolden("cli-inspect-execution-output", {
        executionId: result.execution.id,
        executionStatus: result.execution.status,
        taskId: result.task.id,
    });
    db.close();
    cleanupPath(workspace);
});
test("golden: inspect query tasks returns array structure", () => {
    const workspace = createTempWorkspace("aa-golden-inspect-tasks-");
    const dbPath = `${workspace}/inspect-tasks.db`;
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const inspect = new InspectService(store);
    // Create multiple tasks with deterministic IDs
    for (let i = 1; i <= 3; i++) {
        const taskId = `test_task_query_${String(i).padStart(3, "0")}`;
        const executionId = `test_exec_query_${String(i).padStart(3, "0")}`;
        seedTaskAndExecution(db, store, { taskId, executionId, traceId: `tasks-trace-${i}` });
    }
    const result = inspect.queryTaskInspectSummaries({ limit: 10 });
    // Verify result is an array
    assert.ok(Array.isArray(result), "Should return array");
    assert.ok(result.length > 0, "Should have at least one item");
    const firstItem = result[0];
    assert.ok(firstItem, "First item should exist");
    assert.ok(firstItem.taskId, "Item should have taskId");
    assert.ok(firstItem.taskStatus, "Item should have taskStatus");
    assertGolden("cli-inspect-tasks-list", {
        count: result.length,
        firstItemTaskId: firstItem.taskId,
        firstItemStatus: firstItem.taskStatus,
    });
    db.close();
    cleanupPath(workspace);
});
test("golden: inspect query workflows returns array structure", () => {
    const workspace = createTempWorkspace("aa-golden-inspect-wf-");
    const dbPath = `${workspace}/inspect-wf.db`;
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const inspect = new InspectService(store);
    // Create task with workflow
    const taskId = "test_task_wf_001";
    const executionId = "test_exec_wf_001";
    const now = nowIso();
    seedTaskAndExecution(db, store, { taskId, executionId, traceId: "wf-trace" });
    db.transaction(() => {
        store.insertWorkflowState({
            taskId,
            divisionId: "general_ops",
            workflowId: "test_workflow",
            currentStepIndex: 1,
            status: "running",
            outputsJson: "{}",
            lastErrorCode: null,
            retryCount: 0,
            resumableFromStep: null,
            startedAt: now,
            updatedAt: now,
        });
    });
    const result = inspect.queryWorkflowInspectSummaries({ limit: 10 });
    // Verify result is array
    assert.ok(Array.isArray(result), "Should return array");
    assertGolden("cli-inspect-workflows-list", {
        count: result.length,
    });
    db.close();
    cleanupPath(workspace);
});
test("golden: inspect query workers returns array structure", () => {
    const workspace = createTempWorkspace("aa-golden-inspect-workers-");
    const dbPath = `${workspace}/inspect-workers.db`;
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const inspect = new InspectService(store);
    const result = inspect.queryWorkerInspectSummaries({ limit: 10 });
    // Verify structure (empty is ok for new DB)
    assert.ok(Array.isArray(result), "Should return array");
    assertGolden("cli-inspect-workers-list", {
        count: result.length,
    });
    db.close();
    cleanupPath(workspace);
});
//# sourceMappingURL=cli-inspect-output.test.js.map