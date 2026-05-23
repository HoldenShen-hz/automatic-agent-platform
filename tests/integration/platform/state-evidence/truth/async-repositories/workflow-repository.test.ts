import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { SqliteDatabase } from "../../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { SqliteAsyncAdapter } from "../../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-async-adapter.js";
import { AsyncWorkflowRepository } from "../../../../../../src/platform/five-plane-state-evidence/truth/async-repositories/workflow-repository.js";
import { AsyncTaskRepository } from "../../../../../../src/platform/five-plane-state-evidence/truth/async-repositories/task-repository.js";
import { createTempWorkspace, cleanupPath } from "../../../../../helpers/fs.js";
import type { WorkflowStateRecord, StepOutputRecord, TaskRecord } from "../../../../../../src/platform/contracts/types/domain.js";

test.describe("AsyncWorkflowRepository", () => {
  let harness: {
    workspace: string;
    dbPath: string;
    db: SqliteDatabase;
    adapter: SqliteAsyncAdapter;
    workflowRepo: AsyncWorkflowRepository;
    taskRepo: AsyncTaskRepository;
    cleanup: () => void;
  };

  test.beforeEach(async () => {
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

  test.afterEach(() => {
    harness.cleanup();
  });

  async function insertTestTask(taskId: string, tenantId: string): Promise<void> {
    const task: TaskRecord = {
      id: taskId,
      parentId: null,
      rootId: taskId,
      divisionId: "general_ops",
      tenantId,
      title: "Test Task",
      status: "queued",
      source: "user",
      priority: "normal",
      inputJson: "{}",
      normalizedInputJson: "{}",
      outputJson: null,
      estimatedCostUsd: 0,
      actualCostUsd: 0,
      errorCode: null,
      createdAt: "2026-04-23T10:00:00.000Z",
      updatedAt: "2026-04-23T10:00:00.000Z",
      completedAt: null,
    };
    await harness.taskRepo.insertTask(task);
  }

  test("insertWorkflowState and getWorkflowState roundtrip", async () => {
    await insertTestTask("task-wf-001", "tenant-wf");

    const workflow: WorkflowStateRecord = {
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

    const workflow: WorkflowStateRecord = {
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

    const workflow: WorkflowStateRecord = {
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

    await harness.workflowRepo.updateWorkflowState(
      "task-wf-update",
      "running",
      2,
      '{"step0":{"done":true},"step1":{"done":true},"step2":{"done":false}}',
      "2026-04-23T11:00:00.000Z",
      null,
    );

    const retrieved = await harness.workflowRepo.getWorkflowState("task-wf-update");
    assert.equal(retrieved?.currentStepIndex, 2);
    assert.ok(retrieved?.outputsJson.includes("step2"));
  });

  test("updateWorkflowStateCas uses optimistic locking", async () => {
    await insertTestTask("task-wf-cas", "tenant-wf-cas");

    const workflow: WorkflowStateRecord = {
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
    const affected1 = await harness.workflowRepo.updateWorkflowStateCas(
      "task-wf-cas",
      0,
      "running",
      "running",
      1,
      '{"step0":{"done":true}}',
      "2026-04-23T11:00:00.000Z",
      null,
    );
    assert.equal(affected1, 1);

    // Second update should fail (expected step = 0, but current is now 1)
    const affected2 = await harness.workflowRepo.updateWorkflowStateCas(
      "task-wf-cas",
      0, // expected step is still 0 but workflow is now at step 1
      "running",
      "running",
      2,
      '{"step1":{"done":true}}',
      "2026-04-23T12:00:00.000Z",
      null,
    );
    assert.equal(affected2, 0);
  });

  test("updateWorkflowRecoveryState updates recovery fields", async () => {
    await insertTestTask("task-wf-recovery", "tenant-wf-recovery");

    const workflow: WorkflowStateRecord = {
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

    const workflow: WorkflowStateRecord = {
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

    const stepOutput: StepOutputRecord = {
      id: "step-output-001",
      taskId: "task-wf-step",
      nodeRunId: "node-run-001",
      stepId: "step-1",
      roleId: "general_executor",
      status: "succeeded",
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

    const workflows: WorkflowStateRecord[] = [
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
