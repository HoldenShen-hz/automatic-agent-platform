import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";
import { WorkflowRepository } from "../../../../../../src/platform/state-evidence/truth/sqlite/repositories/workflow-repository.js";
import { TaskRepository } from "../../../../../../src/platform/state-evidence/truth/sqlite/repositories/task-repository.js";
import { SqliteDatabase } from "../../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../../../helpers/fs.js";
function createTestTask(db, taskId, tenantId, now) {
    const taskRepo = new TaskRepository(db.connection);
    taskRepo.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        tenantId,
        title: "Test task",
        status: "in_progress",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: null,
        outputJson: null,
        estimatedCostUsd: null,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
    });
}
test("WorkflowRepository getWorkflowState returns workflow state for task", () => {
    const workspace = createTempWorkspace("aa-workflow-repo-");
    const dbPath = join(workspace, "workflow-repo.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const repo = new WorkflowRepository(db.connection);
        const now = "2026-04-14T10:00:00.000Z";
        createTestTask(db, "task-wf-1", null, now);
        db.connection.exec(`
      INSERT INTO workflow_state (task_id, division_id, workflow_id, current_step_index, status, outputs_json, last_error_code, retry_count, resumable_from_step, started_at, updated_at)
      VALUES ('task-wf-1', 'general_ops', 'multi_step_v1', 0, 'running', '{}', NULL, 0, NULL, '${now}', '${now}')
    `);
        const result = repo.getWorkflowState("task-wf-1");
        assert.ok(result);
        assert.equal(result.taskId, "task-wf-1");
        assert.equal(result.workflowId, "multi_step_v1");
        assert.equal(result.status, "running");
    }
    finally {
        cleanupPath(workspace);
    }
});
test("WorkflowRepository getWorkflowState returns null for non-existent task", () => {
    const workspace = createTempWorkspace("aa-workflow-repo-");
    const dbPath = join(workspace, "workflow-repo.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const repo = new WorkflowRepository(db.connection);
        const result = repo.getWorkflowState("nonexistent-task");
        assert.strictEqual(result, null);
    }
    finally {
        cleanupPath(workspace);
    }
});
test("WorkflowRepository listWorkflowStates returns all workflow states", () => {
    const workspace = createTempWorkspace("aa-workflow-repo-");
    const dbPath = join(workspace, "workflow-repo.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const repo = new WorkflowRepository(db.connection);
        const now = "2026-04-14T10:00:00.000Z";
        createTestTask(db, "task-wf-list-1", null, now);
        createTestTask(db, "task-wf-list-2", null, now);
        db.connection.exec(`
      INSERT INTO workflow_state (task_id, division_id, workflow_id, current_step_index, status, outputs_json, last_error_code, retry_count, resumable_from_step, started_at, updated_at)
      VALUES ('task-wf-list-1', 'general_ops', 'multi_step_v1', 1, 'running', '{}', NULL, 0, NULL, '${now}', '${now}')
    `);
        db.connection.exec(`
      INSERT INTO workflow_state (task_id, division_id, workflow_id, current_step_index, status, outputs_json, last_error_code, retry_count, resumable_from_step, started_at, updated_at)
      VALUES ('task-wf-list-2', 'general_ops', 'multi_step_v1', 2, 'completed', '{}', NULL, 0, NULL, '${now}', '${now}')
    `);
        const results = repo.listWorkflowStates();
        assert.equal(results.length, 2);
    }
    finally {
        cleanupPath(workspace);
    }
});
test("WorkflowRepository listWorkflowStates returns empty when no workflows", () => {
    const workspace = createTempWorkspace("aa-workflow-repo-");
    const dbPath = join(workspace, "workflow-repo.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const repo = new WorkflowRepository(db.connection);
        const results = repo.listWorkflowStates();
        assert.equal(results.length, 0);
    }
    finally {
        cleanupPath(workspace);
    }
});
test("WorkflowRepository column mapping snake_case to camelCase is correct", () => {
    const workspace = createTempWorkspace("aa-workflow-repo-");
    const dbPath = join(workspace, "workflow-repo.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const repo = new WorkflowRepository(db.connection);
        const now = "2026-04-14T10:00:00.000Z";
        createTestTask(db, "task-wf-cols", null, now);
        db.connection.exec(`
      INSERT INTO workflow_state (task_id, division_id, workflow_id, current_step_index, status, outputs_json, last_error_code, retry_count, resumable_from_step, started_at, updated_at)
      VALUES ('task-wf-cols', 'division_x', 'workflow_y', 3, 'failed', '{"error":"done"}', 'ERR_STEP_3', 2, 'step-2', '${now}', '${now}')
    `);
        const result = repo.getWorkflowState("task-wf-cols");
        assert.ok(result);
        assert.equal(result.taskId, "task-wf-cols");
        assert.equal(result.divisionId, "division_x");
        assert.equal(result.workflowId, "workflow_y");
        assert.equal(result.currentStepIndex, 3);
        assert.equal(result.status, "failed");
        assert.equal(result.outputsJson, '{"error":"done"}');
        assert.equal(result.lastErrorCode, "ERR_STEP_3");
        assert.equal(result.retryCount, 2);
        assert.equal(result.resumableFromStep, "step-2");
    }
    finally {
        cleanupPath(workspace);
    }
});
test("WorkflowRepository getWorkflowState with tenantId returns workflow for matching tenant", () => {
    const workspace = createTempWorkspace("aa-workflow-repo-");
    const dbPath = join(workspace, "workflow-repo.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const repo = new WorkflowRepository(db.connection);
        const now = "2026-04-14T10:00:00.000Z";
        createTestTask(db, "task-tenant-a", "tenant-a", now);
        createTestTask(db, "task-tenant-b", "tenant-b", now);
        db.connection.exec(`
      INSERT INTO workflow_state (task_id, division_id, workflow_id, current_step_index, status, outputs_json, last_error_code, retry_count, resumable_from_step, started_at, updated_at)
      VALUES ('task-tenant-a', 'general_ops', 'wf-a', 0, 'running', '{}', NULL, 0, NULL, '${now}', '${now}')
    `);
        db.connection.exec(`
      INSERT INTO workflow_state (task_id, division_id, workflow_id, current_step_index, status, outputs_json, last_error_code, retry_count, resumable_from_step, started_at, updated_at)
      VALUES ('task-tenant-b', 'general_ops', 'wf-b', 1, 'completed', '{}', NULL, 0, NULL, '${now}', '${now}')
    `);
        const resultA = repo.getWorkflowState("task-tenant-a", "tenant-a");
        assert.ok(resultA, "should find workflow with matching tenant");
        assert.equal(resultA.taskId, "task-tenant-a");
        assert.equal(resultA.workflowId, "wf-a");
        const resultB = repo.getWorkflowState("task-tenant-b", "tenant-b");
        assert.ok(resultB, "should find workflow with matching tenant");
        assert.equal(resultB.taskId, "task-tenant-b");
        const wrongTenant = repo.getWorkflowState("task-tenant-a", "tenant-b");
        assert.strictEqual(wrongTenant, null, "should not find workflow with wrong tenant");
    }
    finally {
        cleanupPath(workspace);
    }
});
test("WorkflowRepository listWorkflowStates with tenantId returns only tenant workflows", () => {
    const workspace = createTempWorkspace("aa-workflow-repo-");
    const dbPath = join(workspace, "workflow-repo.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const repo = new WorkflowRepository(db.connection);
        const now = "2026-04-14T10:00:00.000Z";
        createTestTask(db, "task-list-tenant-a", "tenant-a", now);
        createTestTask(db, "task-list-tenant-b", "tenant-b", now);
        db.connection.exec(`
      INSERT INTO workflow_state (task_id, division_id, workflow_id, current_step_index, status, outputs_json, last_error_code, retry_count, resumable_from_step, started_at, updated_at)
      VALUES ('task-list-tenant-a', 'general_ops', 'wf-a', 0, 'running', '{}', NULL, 0, NULL, '${now}', '${now}')
    `);
        db.connection.exec(`
      INSERT INTO workflow_state (task_id, division_id, workflow_id, current_step_index, status, outputs_json, last_error_code, retry_count, resumable_from_step, started_at, updated_at)
      VALUES ('task-list-tenant-b', 'general_ops', 'wf-b', 1, 'completed', '{}', NULL, 0, NULL, '${now}', '${now}')
    `);
        const resultsTenantA = repo.listWorkflowStates("tenant-a");
        assert.equal(resultsTenantA.length, 1, "should return only tenant-a workflows");
        assert.equal(resultsTenantA[0]?.taskId, "task-list-tenant-a");
        const resultsTenantB = repo.listWorkflowStates("tenant-b");
        assert.equal(resultsTenantB.length, 1, "should return only tenant-b workflows");
        assert.equal(resultsTenantB[0]?.taskId, "task-list-tenant-b");
        const resultsNoFilter = repo.listWorkflowStates();
        assert.equal(resultsNoFilter.length, 2, "should return all workflows when no tenant filter");
    }
    finally {
        cleanupPath(workspace);
    }
});
test("WorkflowRepository insertWorkflowState and updateWorkflowRecoveryState persist workflow metadata", () => {
    const workspace = createTempWorkspace("aa-workflow-repo-");
    const dbPath = join(workspace, "workflow-repo.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const repo = new WorkflowRepository(db.connection);
        const now = "2026-04-14T10:00:00.000Z";
        const later = "2026-04-14T11:00:00.000Z";
        createTestTask(db, "task-workflow-update", null, now);
        repo.insertWorkflowState({
            taskId: "task-workflow-update",
            divisionId: "general_ops",
            workflowId: "wf-update",
            currentStepIndex: 0,
            status: "running",
            outputsJson: "{\"step\":0}",
            lastErrorCode: null,
            retryCount: 0,
            resumableFromStep: null,
            startedAt: now,
            updatedAt: now,
        });
        repo.updateWorkflowRecoveryState({
            taskId: "task-workflow-update",
            status: "failed",
            currentStepIndex: 2,
            outputsJson: "{\"step\":2}",
            updatedAt: later,
            resumableFromStep: "step-2",
            retryCount: 3,
            lastErrorCode: "ERR_WORKFLOW",
        });
        const result = repo.getWorkflowState("task-workflow-update");
        assert.ok(result);
        assert.equal(result.status, "failed");
        assert.equal(result.currentStepIndex, 2);
        assert.equal(result.outputsJson, "{\"step\":2}");
        assert.equal(result.resumableFromStep, "step-2");
        assert.equal(result.retryCount, 3);
        assert.equal(result.lastErrorCode, "ERR_WORKFLOW");
    }
    finally {
        cleanupPath(workspace);
    }
});
test("WorkflowRepository insertStepOutput writes workflow step outputs", () => {
    const workspace = createTempWorkspace("aa-workflow-repo-");
    const dbPath = join(workspace, "workflow-repo.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const repo = new WorkflowRepository(db.connection);
        const now = "2026-04-14T10:00:00.000Z";
        createTestTask(db, "task-step-output", null, now);
        repo.insertStepOutput({
            id: "step-output-1",
            taskId: "task-step-output",
            stepId: "step-1",
            roleId: "general_executor",
            status: "succeeded",
            dataJson: "{\"ok\":true}",
            summary: "completed step",
            artifactsJson: null,
            tokenCost: 42,
            durationMs: 1200,
            validationJson: null,
            producedAt: now,
        });
        const row = db.connection
            .prepare(`SELECT
          task_id AS taskId,
          step_id AS stepId,
          role_id AS roleId,
          status,
          data_json AS dataJson,
          token_cost AS tokenCost
         FROM workflow_step_outputs
         WHERE id = ?`)
            .get("step-output-1");
        assert.ok(row);
        assert.equal(row.taskId, "task-step-output");
        assert.equal(row.stepId, "step-1");
        assert.equal(row.roleId, "general_executor");
        assert.equal(row.status, "succeeded");
        assert.equal(row.dataJson, "{\"ok\":true}");
        assert.equal(row.tokenCost, 42);
    }
    finally {
        cleanupPath(workspace);
    }
});
//# sourceMappingURL=workflow-repository.test.js.map