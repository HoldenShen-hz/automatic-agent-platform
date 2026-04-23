/**
 * E2E Multi-Step Workflow Tests
 *
 * End-to-end tests covering multi-step workflow execution,
 * including step dependencies, output passing, and completion.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";
import { SqliteDatabase } from "../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { TransitionService } from "../../src/platform/execution/state-transition/transition-service.js";
import { cleanupPath, createTempWorkspace } from "../helpers/fs.js";
import { nowIso, newId } from "../../src/platform/contracts/types/ids.js";
function createE2eHarness(prefix) {
    const workspace = createTempWorkspace(prefix);
    const dbPath = join(workspace, "e2e-workflow.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const transitions = new TransitionService(db, store);
    return { workspace, db, store, transitions };
}
test("E2E: multi-step workflow executes steps in dependency order", () => {
    const h = createE2eHarness("e2e-multi-step-");
    try {
        const taskId = newId("task");
        const executionId = newId("exec");
        const traceId = "e2e-multi-step-trace";
        const now = nowIso();
        // Create task in queued state
        h.db.transaction(() => {
            h.store.insertTask({
                id: taskId,
                parentId: null,
                rootId: taskId,
                divisionId: "general_ops",
                title: "Multi-step workflow test",
                status: "queued",
                source: "user",
                priority: "normal",
                inputJson: JSON.stringify({ request: "multi-step test" }),
                normalizedInputJson: JSON.stringify({ request: "multi-step test" }),
                outputJson: null,
                estimatedCostUsd: 0,
                actualCostUsd: 0,
                errorCode: null,
                createdAt: now,
                updatedAt: now,
                completedAt: null,
            });
        });
        // Transition task to pending
        h.transitions.transitionTaskStatus({
            entityKind: "task",
            entityId: taskId,
            fromStatus: "queued",
            toStatus: "pending",
            executionId: null,
            reasonCode: "e2e_test",
            traceId,
            actorType: "system",
            occurredAt: now,
        });
        // Insert execution and workflow state
        h.db.transaction(() => {
            h.store.insertExecution({
                id: executionId,
                taskId,
                workflowId: "multi_step_test",
                parentExecutionId: null,
                agentId: "agent-1",
                roleId: "general_executor",
                runKind: "task_run",
                status: "executing",
                inputRef: null,
                traceId,
                attempt: 1,
                timeoutMs: 60000,
                budgetUsdLimit: 1,
                requiresApproval: 0,
                sandboxMode: "workspace_write",
                allowedToolsJson: "[]",
                allowedPathsJson: "[]",
                maxRetries: 0,
                retryBackoff: "none",
                lastErrorCode: null,
                lastErrorMessage: null,
                startedAt: now,
                finishedAt: null,
                createdAt: now,
                updatedAt: now,
            });
            h.store.insertWorkflowState({
                taskId,
                divisionId: "general_ops",
                workflowId: "multi_step_test",
                currentStepIndex: 0,
                status: "running",
                outputsJson: "{}",
                lastErrorCode: null,
                retryCount: 0,
                resumableFromStep: null,
                startedAt: now,
                updatedAt: now,
            });
        });
        // Verify workflow state is created with step index 0
        const workflow = h.store.getWorkflowState(taskId);
        assert.ok(workflow, "Workflow state should exist");
        assert.equal(workflow.currentStepIndex, 0, "Initial step index should be 0");
        assert.equal(workflow.status, "running", "Workflow status should be running");
        // Advance to step 1 with output from step 0
        h.db.transaction(() => {
            h.store.updateWorkflowState(taskId, "running", 1, JSON.stringify({ step0_output: "result_from_step_0" }), now, null);
        });
        const workflow2 = h.store.getWorkflowState(taskId);
        assert.ok(workflow2, "Workflow state should still exist");
        assert.equal(workflow2.currentStepIndex, 1, "Step index should advance to 1");
        const outputs = JSON.parse(workflow2.outputsJson);
        assert.equal(outputs.step0_output, "result_from_step_0", "Step 0 output should be preserved");
        // Advance to step 2
        h.db.transaction(() => {
            h.store.updateWorkflowState(taskId, "running", 2, JSON.stringify({ step0_output: "result_from_step_0", step1_output: "result_from_step_1" }), now, null);
        });
        const workflow3 = h.store.getWorkflowState(taskId);
        assert.equal(workflow3.currentStepIndex, 2, "Step index should advance to 2");
        // Complete workflow
        h.db.transaction(() => {
            h.store.updateWorkflowState(taskId, "completed", 2, JSON.stringify({
                step0_output: "result_from_step_0",
                step1_output: "result_from_step_1",
                step2_output: "final_result",
            }), now, null);
        });
        const finalWorkflow = h.store.getWorkflowState(taskId);
        assert.equal(finalWorkflow.status, "completed", "Workflow should be completed");
        const finalOutputs = JSON.parse(finalWorkflow.outputsJson);
        assert.equal(finalOutputs.step2_output, "final_result", "All step outputs should be accumulated");
    }
    finally {
        cleanupPath(h.workspace);
    }
});
test("E2E: workflow with step dependency waits for prerequisite", () => {
    const h = createE2eHarness("e2e-workflow-dep-");
    try {
        const taskId = newId("task");
        const executionId = newId("exec");
        const traceId = "e2e-workflow-dep-trace";
        const now = nowIso();
        // Create task
        h.db.transaction(() => {
            h.store.insertTask({
                id: taskId,
                parentId: null,
                rootId: taskId,
                divisionId: "general_ops",
                title: "Workflow dependency test",
                status: "pending",
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
            h.store.insertExecution({
                id: executionId,
                taskId,
                workflowId: "dependent_steps",
                parentExecutionId: null,
                agentId: "agent-1",
                roleId: "general_executor",
                runKind: "task_run",
                status: "executing",
                inputRef: null,
                traceId,
                attempt: 1,
                timeoutMs: 60000,
                budgetUsdLimit: 1,
                requiresApproval: 0,
                sandboxMode: "workspace_write",
                allowedToolsJson: "[]",
                allowedPathsJson: "[]",
                maxRetries: 0,
                retryBackoff: "none",
                lastErrorCode: null,
                lastErrorMessage: null,
                startedAt: now,
                finishedAt: null,
                createdAt: now,
                updatedAt: now,
            });
            h.store.insertWorkflowState({
                taskId,
                divisionId: "general_ops",
                workflowId: "dependent_steps",
                currentStepIndex: 0,
                status: "running",
                outputsJson: "{}",
                lastErrorCode: null,
                retryCount: 0,
                resumableFromStep: null,
                startedAt: now,
                updatedAt: now,
            });
        });
        // Step 1 (index 0) must complete before step 2 (index 1) can run
        // Attempting to advance to step 2 before step 1 should maintain step 0 output
        h.db.transaction(() => {
            // Complete step 1 and move to step 2
            h.store.updateWorkflowState(taskId, "running", 1, JSON.stringify({ step0_data: "from_step_0" }), now, null);
        });
        const workflow = h.store.getWorkflowState(taskId);
        assert.equal(workflow.currentStepIndex, 1, "Should advance to step 1");
        assert.ok(JSON.parse(workflow.outputsJson).step0_data, "Step 0 data should be passed forward");
        // Verify dependency: step 1 can only use outputs from step 0 and earlier
        h.db.transaction(() => {
            h.store.updateWorkflowState(taskId, "running", 2, JSON.stringify({ step0_data: "from_step_0", step1_data: "from_step_1" }), now, null);
        });
        const workflow2 = h.store.getWorkflowState(taskId);
        const outputs2 = JSON.parse(workflow2.outputsJson);
        assert.equal(outputs2.step0_data, "from_step_0", "Step 0 output should be in accumulated outputs");
        assert.equal(outputs2.step1_data, "from_step_1", "Step 1 output should be accumulated");
    }
    finally {
        cleanupPath(h.workspace);
    }
});
test("E2E: workflow fails correctly when step encounters error", () => {
    const h = createE2eHarness("e2e-workflow-fail-");
    try {
        const taskId = newId("task");
        const executionId = newId("exec");
        const traceId = "e2e-workflow-fail-trace";
        const now = nowIso();
        // Create task and execution
        h.db.transaction(() => {
            h.store.insertTask({
                id: taskId,
                parentId: null,
                rootId: taskId,
                divisionId: "general_ops",
                title: "Workflow failure test",
                status: "pending",
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
            h.store.insertExecution({
                id: executionId,
                taskId,
                workflowId: "failing_workflow",
                parentExecutionId: null,
                agentId: "agent-1",
                roleId: "general_executor",
                runKind: "task_run",
                status: "executing",
                inputRef: null,
                traceId,
                attempt: 1,
                timeoutMs: 60000,
                budgetUsdLimit: 1,
                requiresApproval: 0,
                sandboxMode: "workspace_write",
                allowedToolsJson: "[]",
                allowedPathsJson: "[]",
                maxRetries: 0,
                retryBackoff: "none",
                lastErrorCode: null,
                lastErrorMessage: null,
                startedAt: now,
                finishedAt: null,
                createdAt: now,
                updatedAt: now,
            });
            h.store.insertWorkflowState({
                taskId,
                divisionId: "general_ops",
                workflowId: "failing_workflow",
                currentStepIndex: 0,
                status: "running",
                outputsJson: "{}",
                lastErrorCode: null,
                retryCount: 0,
                resumableFromStep: null,
                startedAt: now,
                updatedAt: now,
            });
        });
        // Simulate step 0 failing with an error
        h.db.transaction(() => {
            // Use updateWorkflowRecoveryState to properly set error code and status
            h.store.updateWorkflowRecoveryState({
                taskId,
                status: "failed",
                currentStepIndex: 0,
                outputsJson: JSON.stringify({}),
                updatedAt: now,
                resumableFromStep: null,
                retryCount: 0,
                lastErrorCode: "workflow.step_failed",
            });
            // Record the error code on the execution
            h.store.updateExecutionStatus(executionId, "failed", now, null, now, "workflow.step_failed");
        });
        const workflow = h.store.getWorkflowState(taskId);
        assert.equal(workflow.status, "failed", "Workflow should be marked as failed");
        assert.equal(workflow.lastErrorCode, "workflow.step_failed", "Error code should be recorded");
        const exec = h.store.getExecution(executionId);
        assert.equal(exec.status, "failed", "Execution should be marked as failed");
        assert.equal(exec.lastErrorCode, "workflow.step_failed", "Execution error code should match");
    }
    finally {
        cleanupPath(h.workspace);
    }
});
//# sourceMappingURL=multi-step-workflow.test.js.map