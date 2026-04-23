// @ts-nocheck
import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";
import { SqliteDatabase } from "../../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { SqliteAsyncAdapter } from "../../../../../../src/platform/state-evidence/truth/sqlite/sqlite-async-adapter.js";
import { AsyncWorkflowRepository } from "../../../../../../src/platform/state-evidence/truth/async-repositories/workflow-repository.js";
import { AsyncTaskRepository } from "../../../../../../src/platform/state-evidence/truth/async-repositories/task-repository.js";
import { createTempWorkspace, cleanupPath } from "../../../../../helpers/fs.js";
test.skip("AsyncWorkflowRepository", (group) => {
    let harness;
    group.beforeEach(async () => {
        const workspace = createTempWorkspace("aa-async-workflow-repo-");
        const dbPath = join(workspace, "workflow-repo.db");
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const adapter = new SqliteAsyncAdapter(db);
        const workflowRepo = new AsyncWorkflowRepository(adapter.asyncConnection);
        const taskRepo = new AsyncTaskRepository(adapter.asyncConnection);
        harness = {
            workspace,
            dbPath,
            db,
            adapter,
            workflowRepo,
            taskRepo,
            cleanup() {
                db.close();
                cleanupPath(workspace);
            },
        };
    });
    group.afterEach(() => {
        harness.cleanup();
    });
    async function insertTestTask(taskId, tenantId) {
        const task = {
            id: taskId,
            parentId: null,
            rootId: null,
            divisionId: "div-001",
            tenantId,
            title: "Test Task",
            status: "queued",
            source: "test",
            priority: "medium",
            inputJson: "{}",
            normalizedInputJson: "{}",
            outputJson: null,
            estimatedCostUsd: null,
            actualCostUsd: null,
            errorCode: null,
            createdAt: "2026-04-23T10:00:00.000Z",
            updatedAt: "2026-04-23T10:00:00.000Z",
            completedAt: null,
        };
        await harness.taskRepo.insertTask(task);
    }
    test("insertWorkflowState and getWorkflowState roundtrip", async () => {
        await insertTestTask("task-wf-001", "tenant-wf");
        const workflow = {
            taskId: "task-wf-001",
            divisionId: "div-001",
            workflowId: "wf-001",
            currentStepIndex: 0,
            status: "running",
            outputsJson: "{}",
            lastErrorCode: null,
            retryCount: 0,
            resumableFromStep: null,
            startedAt: "2026-04-23T10:00:00.000Z",
            updatedAt: "2026-04-23T10:00:00.000Z",
        };
        await harness.workflowRepo.insertWorkflowState(workflow);
        const retrieved = await harness.workflowRepo.getWorkflowState("task-wf-001", "tenant-wf");
        assert.equal(retrieved?.taskId, "task-wf-001");
        assert.equal(retrieved?.workflowId, "wf-001");
        assert.equal(retrieved?.status, "running");
        assert.equal(retrieved?.currentStepIndex, 0);
    });
    test("getWorkflowState returns null for non-existent workflow", async () => {
        const result = await harness.workflowRepo.getWorkflowState("non-existent-task");
        assert.equal(result, null);
    });
    test("getWorkflowState with tenant scoping returns null when tenant mismatch", async () => {
        await insertTestTask("task-wf-tenant", "tenant-a");
        const workflow = {
            taskId: "task-wf-tenant",
            divisionId: "div-001",
            workflowId: "wf-tenant",
            currentStepIndex: 0,
            status: "running",
            outputsJson: "{}",
            lastErrorCode: null,
            retryCount: 0,
            resumableFromStep: null,
            startedAt: "2026-04-23T10:00:00.000Z",
            updatedAt: "2026-04-23T10:00:00.000Z",
        };
        await harness.workflowRepo.insertWorkflowState(workflow);
        const result = await harness.workflowRepo.getWorkflowState("task-wf-tenant", "tenant-b");
        assert.equal(result, null);
    });
    test("updateWorkflowState updates status, step index, and outputs", async () => {
        await insertTestTask("task-wf-update", "tenant-wf-update");
        const workflow = {
            taskId: "task-wf-update",
            divisionId: "div-001",
            workflowId: "wf-update",
            currentStepIndex: 0,
            status: "running",
            outputsJson: "{}",
            lastErrorCode: null,
            retryCount: 0,
            resumableFromStep: null,
            startedAt: "2026-04-23T10:00:00.000Z",
            updatedAt: "2026-04-23T10:00:00.000Z",
        };
        await harness.workflowRepo.insertWorkflowState(workflow);
        await harness.workflowRepo.updateWorkflowState("task-wf-update", "running", 2, '{"step0":{"done":true},"step1":{"done":true},"step2":{"done":false}}', "2026-04-23T11:00:00.000Z", null);
        const retrieved = await harness.workflowRepo.getWorkflowState("task-wf-update");
        assert.equal(retrieved?.currentStepIndex, 2);
        assert.ok(retrieved?.outputsJson.includes("step2"));
    });
    test("updateWorkflowStateCas uses optimistic locking", async () => {
        await insertTestTask("task-wf-cas", "tenant-wf-cas");
        const workflow = {
            taskId: "task-wf-cas",
            divisionId: "div-001",
            workflowId: "wf-cas",
            currentStepIndex: 0,
            status: "running",
            outputsJson: "{}",
            lastErrorCode: null,
            retryCount: 0,
            resumableFromStep: null,
            startedAt: "2026-04-23T10:00:00.000Z",
            updatedAt: "2026-04-23T10:00:00.000Z",
        };
        await harness.workflowRepo.insertWorkflowState(workflow);
        // First update should succeed (expected step = 0, status = running)
        const affected1 = await harness.workflowRepo.updateWorkflowStateCas("task-wf-cas", 0, "running", 1, '{"step0":{"done":true}}', "2026-04-23T11:00:00.000Z", null);
        assert.equal(affected1, 1);
        // Second update should fail (expected step = 0, but current is now 1)
        const affected2 = await harness.workflowRepo.updateWorkflowStateCas("task-wf-cas", 0, // expected step is still 0 but workflow is now at step 1
        "running", 2, '{"step1":{"done":true}}', "2026-04-23T12:00:00.000Z", null);
        assert.equal(affected2, 0);
    });
    test("updateWorkflowRecoveryState updates recovery fields", async () => {
        await insertTestTask("task-wf-recovery", "tenant-wf-recovery");
        const workflow = {
            taskId: "task-wf-recovery",
            divisionId: "div-001",
            workflowId: "wf-recovery",
            currentStepIndex: 1,
            status: "failed",
            outputsJson: '{"step0":{"done":true}}',
            lastErrorCode: "ERR_STEP_FAILED",
            retryCount: 2,
            resumableFromStep: "0",
            startedAt: "2026-04-23T10:00:00.000Z",
            updatedAt: "2026-04-23T10:30:00.000Z",
        };
        await harness.workflowRepo.insertWorkflowState(workflow);
        await harness.workflowRepo.updateWorkflowRecoveryState({
            taskId: "task-wf-recovery",
            status: "running",
            currentStepIndex: 1,
            outputsJson: '{"step0":{"done":true},"step1":{"done":false}}',
            updatedAt: "2026-04-23T11:00:00.000Z",
            resumableFromStep: "1",
            retryCount: 3,
            lastErrorCode: null,
        });
        const retrieved = await harness.workflowRepo.getWorkflowState("task-wf-recovery");
        assert.equal(retrieved?.status, "running");
        assert.equal(retrieved?.retryCount, 3);
        assert.equal(retrieved?.lastErrorCode, null);
    });
    test("insertStepOutput and list via getWorkflowState", async () => {
        await insertTestTask("task-wf-step", "tenant-wf-step");
        const workflow = {
            taskId: "task-wf-step",
            divisionId: "div-001",
            workflowId: "wf-step",
            currentStepIndex: 0,
            status: "running",
            outputsJson: "{}",
            lastErrorCode: null,
            retryCount: 0,
            resumableFromStep: null,
            startedAt: "2026-04-23T10:00:00.000Z",
            updatedAt: "2026-04-23T10:00:00.000Z",
        };
        await harness.workflowRepo.insertWorkflowState(workflow);
        const stepOutput = {
            id: "step-output-001",
            taskId: "task-wf-step",
            stepId: "step-1",
            roleId: null,
            status: "completed",
            dataJson: '{"result":"success"}',
            summary: "Step 1 completed",
            artifactsJson: null,
            tokenCost: 1000,
            durationMs: 5000,
            validationJson: null,
            producedAt: "2026-04-23T10:05:00.000Z",
        };
        await harness.workflowRepo.insertStepOutput(stepOutput);
        // Verify workflow state still accessible
        const retrieved = await harness.workflowRepo.getWorkflowState("task-wf-step");
        assert.equal(retrieved?.taskId, "task-wf-step");
    });
    test("listWorkflowStates returns all workflows for tenant", async () => {
        const taskIds = ["task-wf-list-1", "task-wf-list-2"];
        for (const taskId of taskIds) {
            await insertTestTask(taskId, "tenant-wf-list");
        }
        const workflows = [
            { taskId: "task-wf-list-1", divisionId: "div-001", workflowId: "wf-list-1", currentStepIndex: 0, status: "running", outputsJson: "{}", lastErrorCode: null, retryCount: 0, resumableFromStep: null, startedAt: "2026-04-23T10:00:00.000Z", updatedAt: "2026-04-23T10:00:00.000Z" },
            { taskId: "task-wf-list-2", divisionId: "div-001", workflowId: "wf-list-2", currentStepIndex: 1, status: "running", outputsJson: "{}", lastErrorCode: null, retryCount: 0, resumableFromStep: null, startedAt: "2026-04-23T10:01:00.000Z", updatedAt: "2026-04-23T10:01:00.000Z" },
        ];
        for (const wf of workflows) {
            await harness.workflowRepo.insertWorkflowState(wf);
        }
        const listed = await harness.workflowRepo.listWorkflowStates("tenant-wf-list");
        assert.equal(listed.length, 2);
    });
});
//# sourceMappingURL=workflow-repository.test.js.map