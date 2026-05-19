/**
 * E2E Workflow Resume Flow Tests
 *
 * End-to-end tests covering workflow pause, resume, and recovery scenarios
 * using the centralized createE2EHarness() helper.
 *
 * Coverage:
 * 1. Workflow paused mid-step and resumes
 * 2. Workflow paused, step advances after resume
 * 3. Workflow paused then cancelled
 * 4. Workflow resume with partial outputs preserved
 */
import assert from "node:assert/strict";
import test from "node:test";
import { createE2EHarness } from "../helpers/e2e-harness.js";
import { TransitionService } from "../../src/platform/execution/state-transition/transition-service.js";
import { nowIso, newId } from "../../src/platform/contracts/types/ids.js";
// ---------------------------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------------------------
function makeTaskCommand(taskId, fromStatus, toStatus, traceId, executionId = null) {
    return {
        entityKind: "task",
        entityId: taskId,
        fromStatus,
        toStatus,
        executionId,
        reasonCode: "e2e_resume",
        traceId,
        actorType: "system",
        occurredAt: nowIso(),
    };
}
function makeExecCommand(executionId, fromStatus, toStatus, traceId) {
    return {
        entityKind: "execution",
        entityId: executionId,
        fromStatus,
        toStatus,
        reasonCode: "e2e_resume",
        traceId,
        actorType: "agent",
        occurredAt: nowIso(),
    };
}
// ---------------------------------------------------------------------------
// Test 1: Workflow Paused Mid-Step and Resumes
// ---------------------------------------------------------------------------
test("E2E Workflow Resume: workflow paused mid-step can be resumed", async () => {
    const harness = createE2EHarness("aa-e2e-wf-resume-pause-");
    try {
        const taskId = newId("task");
        const executionId = newId("exec");
        const sessionId = newId("sess");
        const traceId = newId("trace");
        const ts = new TransitionService(harness.db, harness.store);
        const now = nowIso();
        // Setup: Create task in running state with workflow at step 1
        harness.db.transaction(() => {
            harness.store.insertTask({
                id: taskId,
                parentId: null,
                rootId: taskId,
                divisionId: "general_ops",
                title: "Pause-resume test",
                status: "in_progress",
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
            harness.store.insertExecution({
                id: executionId,
                taskId,
                workflowId: "multi_step_wf",
                parentExecutionId: null,
                agentId: "agent-1",
                roleId: "general_executor",
                runKind: "task_run",
                status: "executing",
                inputRef: null,
                traceId,
                attempt: 1,
                timeoutMs: 120000,
                budgetUsdLimit: 5,
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
            harness.store.insertWorkflowState({
                taskId,
                divisionId: "general_ops",
                workflowId: "multi_step_wf",
                currentStepIndex: 1,
                status: "running",
                outputsJson: JSON.stringify({ step0_output: "completed" }),
                lastErrorCode: null,
                retryCount: 0,
                resumableFromStep: null,
                startedAt: now,
                updatedAt: now,
            });
            harness.store.insertSession({
                id: sessionId,
                taskId,
                channel: "cli",
                status: "streaming",
                externalSessionId: null,
                createdAt: now,
                updatedAt: now,
            });
        });
        // Verify workflow is at step 1
        let workflow = harness.store.getWorkflowState(taskId);
        assert.equal(workflow?.currentStepIndex, 1, "Workflow should be at step 1");
        assert.equal(workflow?.status, "running", "Workflow should be running");
        // Pause the workflow
        ts.transitionWorkflowStatus({
            entityKind: "workflow",
            entityId: taskId,
            fromStatus: "running",
            toStatus: "paused",
            currentStepIndex: 1,
            outputsJson: JSON.stringify({ step0_output: "completed" }),
            reasonCode: "user_pause",
            traceId,
            actorType: "system",
            occurredAt: nowIso(),
        });
        workflow = harness.store.getWorkflowState(taskId);
        assert.equal(workflow?.status, "paused", "Workflow should be paused");
        assert.equal(workflow?.currentStepIndex, 1, "Step index should be preserved");
        // Resume the workflow
        ts.transitionWorkflowStatus({
            entityKind: "workflow",
            entityId: taskId,
            fromStatus: "paused",
            toStatus: "resuming",
            currentStepIndex: 1,
            outputsJson: JSON.stringify({ step0_output: "completed" }),
            reasonCode: "user_resume",
            traceId,
            actorType: "system",
            occurredAt: nowIso(),
        });
        workflow = harness.store.getWorkflowState(taskId);
        assert.equal(workflow?.status, "resuming", "Workflow should be resuming");
        ts.transitionWorkflowStatus({
            entityKind: "workflow",
            entityId: taskId,
            fromStatus: "resuming",
            toStatus: "running",
            currentStepIndex: 1,
            outputsJson: JSON.stringify({ step0_output: "completed" }),
            reasonCode: "system_resume",
            traceId,
            actorType: "system",
            occurredAt: nowIso(),
        });
        workflow = harness.store.getWorkflowState(taskId);
        assert.equal(workflow?.status, "running", "Workflow should be running after resume");
        assert.equal(workflow?.currentStepIndex, 1, "Step index should still be 1");
        assert.ok(JSON.parse(workflow.outputsJson).step0_output, "Partial outputs should be preserved");
    }
    finally {
        harness.cleanup();
    }
});
// ---------------------------------------------------------------------------
// Test 2: Workflow Paused Then Step Advances After Resume
// ---------------------------------------------------------------------------
test("E2E Workflow Resume: step advances after resume completes", async () => {
    const harness = createE2EHarness("aa-e2e-wf-resume-advance-");
    try {
        const taskId = newId("task");
        const executionId = newId("exec");
        const sessionId = newId("sess");
        const traceId = newId("trace");
        const ts = new TransitionService(harness.db, harness.store);
        const now = nowIso();
        // Setup: Task at step 1
        harness.db.transaction(() => {
            harness.store.insertTask({
                id: taskId,
                parentId: null,
                rootId: taskId,
                divisionId: "general_ops",
                title: "Resume advance test",
                status: "in_progress",
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
            harness.store.insertExecution({
                id: executionId,
                taskId,
                workflowId: "multi_step_wf",
                parentExecutionId: null,
                agentId: "agent-1",
                roleId: "general_executor",
                runKind: "task_run",
                status: "executing",
                inputRef: null,
                traceId,
                attempt: 1,
                timeoutMs: 120000,
                budgetUsdLimit: 5,
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
            harness.store.insertWorkflowState({
                taskId,
                divisionId: "general_ops",
                workflowId: "multi_step_wf",
                currentStepIndex: 1,
                status: "running",
                outputsJson: JSON.stringify({ step0_output: "done", step1_input: "received" }),
                lastErrorCode: null,
                retryCount: 0,
                resumableFromStep: null,
                startedAt: now,
                updatedAt: now,
            });
            harness.store.insertSession({
                id: sessionId,
                taskId,
                channel: "cli",
                status: "streaming",
                externalSessionId: null,
                createdAt: now,
                updatedAt: now,
            });
        });
        // Pause workflow
        ts.transitionWorkflowStatus({
            entityKind: "workflow",
            entityId: taskId,
            fromStatus: "running",
            toStatus: "paused",
            currentStepIndex: 1,
            outputsJson: JSON.stringify({ step0_output: "done", step1_input: "received" }),
            reasonCode: "user_pause",
            traceId,
            actorType: "system",
            occurredAt: nowIso(),
        });
        // Resume workflow
        ts.transitionWorkflowStatus({
            entityKind: "workflow",
            entityId: taskId,
            fromStatus: "paused",
            toStatus: "resuming",
            currentStepIndex: 1,
            outputsJson: JSON.stringify({ step0_output: "done", step1_input: "received" }),
            reasonCode: "user_resume",
            traceId,
            actorType: "system",
            occurredAt: nowIso(),
        });
        ts.transitionWorkflowStatus({
            entityKind: "workflow",
            entityId: taskId,
            fromStatus: "resuming",
            toStatus: "running",
            currentStepIndex: 1,
            outputsJson: JSON.stringify({ step0_output: "done", step1_input: "received" }),
            reasonCode: "system_resume",
            traceId,
            actorType: "system",
            occurredAt: nowIso(),
        });
        // After resume, step 1 completes and advances to step 2
        harness.db.transaction(() => {
            harness.store.updateWorkflowState(taskId, "running", 2, JSON.stringify({ step0_output: "done", step1_input: "received", step1_output: "processed" }), nowIso(), null);
        });
        let workflow = harness.store.getWorkflowState(taskId);
        assert.equal(workflow?.currentStepIndex, 2, "Step index should advance to 2 after resume");
        const outputs = JSON.parse(workflow.outputsJson);
        assert.equal(outputs.step1_output, "processed", "Step 1 output should be added");
        // Complete workflow
        harness.db.transaction(() => {
            harness.store.updateWorkflowState(taskId, "completed", 3, JSON.stringify({ step0_output: "done", step1_output: "processed", step2_output: "final" }), nowIso(), null);
        });
        workflow = harness.store.getWorkflowState(taskId);
        assert.equal(workflow?.status, "completed", "Workflow should be completed");
    }
    finally {
        harness.cleanup();
    }
});
// ---------------------------------------------------------------------------
// Test 3: Workflow Paused Then Cancelled
// ---------------------------------------------------------------------------
test("E2E Workflow Resume: paused workflow can be cancelled", async () => {
    const harness = createE2EHarness("aa-e2e-wf-resume-cancel-");
    try {
        const taskId = newId("task");
        const executionId = newId("exec");
        const sessionId = newId("sess");
        const traceId = newId("trace");
        const ts = new TransitionService(harness.db, harness.store);
        const now = nowIso();
        // Setup
        harness.db.transaction(() => {
            harness.store.insertTask({
                id: taskId,
                parentId: null,
                rootId: taskId,
                divisionId: "general_ops",
                title: "Pause cancel test",
                status: "in_progress",
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
            harness.store.insertExecution({
                id: executionId,
                taskId,
                workflowId: "multi_step_wf",
                parentExecutionId: null,
                agentId: "agent-1",
                roleId: "general_executor",
                runKind: "task_run",
                status: "executing",
                inputRef: null,
                traceId,
                attempt: 1,
                timeoutMs: 120000,
                budgetUsdLimit: 5,
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
            harness.store.insertWorkflowState({
                taskId,
                divisionId: "general_ops",
                workflowId: "multi_step_wf",
                currentStepIndex: 1,
                status: "running",
                outputsJson: "{}",
                lastErrorCode: null,
                retryCount: 0,
                resumableFromStep: null,
                startedAt: now,
                updatedAt: now,
            });
            harness.store.insertSession({
                id: sessionId,
                taskId,
                channel: "cli",
                status: "streaming",
                externalSessionId: null,
                createdAt: now,
                updatedAt: now,
            });
        });
        // Pause the workflow
        ts.transitionWorkflowStatus({
            entityKind: "workflow",
            entityId: taskId,
            fromStatus: "running",
            toStatus: "paused",
            currentStepIndex: 1,
            outputsJson: "{}",
            reasonCode: "user_pause",
            traceId,
            actorType: "system",
            occurredAt: nowIso(),
        });
        let workflow = harness.store.getWorkflowState(taskId);
        assert.equal(workflow?.status, "paused", "Workflow should be paused");
        // Cancel task while workflow is paused
        ts.transitionTaskTerminalState({
            taskId,
            sessionId,
            executionId,
            currentTaskStatus: "in_progress",
            currentWorkflowStatus: "paused",
            currentSessionStatus: "streaming",
            currentExecutionStatus: "executing",
            terminalStatus: "cancelled",
            taskOutputJson: "{}",
            outputsJson: "{}",
            context: {
                reasonCode: "user_cancelled",
                traceId,
                actorType: "user",
                occurredAt: nowIso(),
            },
        });
        const task = harness.store.getTask(taskId);
        assert.equal(task?.status, "cancelled", "Task should be cancelled");
        workflow = harness.store.getWorkflowState(taskId);
        assert.equal(workflow?.status, "cancelled", "Workflow should be cancelled too");
    }
    finally {
        harness.cleanup();
    }
});
// ---------------------------------------------------------------------------
// Test 4: Workflow Resume With Partial Outputs Preserved
// ---------------------------------------------------------------------------
test("E2E Workflow Resume: partial outputs are preserved across pause-resume", async () => {
    const harness = createE2EHarness("aa-e2e-wf-resume-outputs-");
    try {
        const taskId = newId("task");
        const executionId = newId("exec");
        const sessionId = newId("sess");
        const traceId = newId("trace");
        const ts = new TransitionService(harness.db, harness.store);
        const now = nowIso();
        // Setup: workflow at step 2 with partial outputs from steps 0 and 1
        harness.db.transaction(() => {
            harness.store.insertTask({
                id: taskId,
                parentId: null,
                rootId: taskId,
                divisionId: "general_ops",
                title: "Output preservation test",
                status: "in_progress",
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
            harness.store.insertExecution({
                id: executionId,
                taskId,
                workflowId: "multi_step_wf",
                parentExecutionId: null,
                agentId: "agent-1",
                roleId: "general_executor",
                runKind: "task_run",
                status: "executing",
                inputRef: null,
                traceId,
                attempt: 1,
                timeoutMs: 180000,
                budgetUsdLimit: 10,
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
            harness.store.insertWorkflowState({
                taskId,
                divisionId: "general_ops",
                workflowId: "multi_step_wf",
                currentStepIndex: 2,
                status: "running",
                outputsJson: JSON.stringify({
                    step0_data: "initial_result",
                    step1_data: "intermediate_result",
                }),
                lastErrorCode: null,
                retryCount: 0,
                resumableFromStep: null,
                startedAt: now,
                updatedAt: now,
            });
            harness.store.insertSession({
                id: sessionId,
                taskId,
                channel: "cli",
                status: "streaming",
                externalSessionId: null,
                createdAt: now,
                updatedAt: now,
            });
        });
        // Verify partial outputs exist
        let workflow = harness.store.getWorkflowState(taskId);
        let outputs = JSON.parse(workflow.outputsJson);
        assert.equal(outputs.step0_data, "initial_result", "Step 0 output should exist");
        assert.equal(outputs.step1_data, "intermediate_result", "Step 1 output should exist");
        // Pause at step 2
        ts.transitionWorkflowStatus({
            entityKind: "workflow",
            entityId: taskId,
            fromStatus: "running",
            toStatus: "paused",
            currentStepIndex: 2,
            outputsJson: JSON.stringify({
                step0_data: "initial_result",
                step1_data: "intermediate_result",
            }),
            reasonCode: "user_pause",
            traceId,
            actorType: "system",
            occurredAt: nowIso(),
        });
        workflow = harness.store.getWorkflowState(taskId);
        outputs = JSON.parse(workflow.outputsJson);
        assert.equal(outputs.step0_data, "initial_result", "Outputs preserved after pause");
        assert.equal(outputs.step1_data, "intermediate_result", "Outputs preserved after pause");
        // Resume and complete step 2
        ts.transitionWorkflowStatus({
            entityKind: "workflow",
            entityId: taskId,
            fromStatus: "paused",
            toStatus: "resuming",
            currentStepIndex: 2,
            outputsJson: JSON.stringify({
                step0_data: "initial_result",
                step1_data: "intermediate_result",
            }),
            reasonCode: "user_resume",
            traceId,
            actorType: "system",
            occurredAt: nowIso(),
        });
        ts.transitionWorkflowStatus({
            entityKind: "workflow",
            entityId: taskId,
            fromStatus: "resuming",
            toStatus: "running",
            currentStepIndex: 2,
            outputsJson: JSON.stringify({
                step0_data: "initial_result",
                step1_data: "intermediate_result",
            }),
            reasonCode: "system_resume",
            traceId,
            actorType: "system",
            occurredAt: nowIso(),
        });
        // Complete workflow with final output
        harness.db.transaction(() => {
            harness.store.updateWorkflowState(taskId, "completed", 3, JSON.stringify({
                step0_data: "initial_result",
                step1_data: "intermediate_result",
                step2_data: "final_result",
            }), nowIso(), null);
        });
        workflow = harness.store.getWorkflowState(taskId);
        outputs = JSON.parse(workflow.outputsJson);
        assert.equal(outputs.step0_data, "initial_result", "Step 0 output should remain");
        assert.equal(outputs.step1_data, "intermediate_result", "Step 1 output should remain");
        assert.equal(outputs.step2_data, "final_result", "Step 2 output should be added");
        assert.equal(workflow?.status, "completed", "Workflow should be completed");
    }
    finally {
        harness.cleanup();
    }
});
// ---------------------------------------------------------------------------
// Test 5: Multiple Pause-Resume Cycles
// ---------------------------------------------------------------------------
test("E2E Workflow Resume: workflow survives multiple pause-resume cycles", async () => {
    const harness = createE2EHarness("aa-e2e-wf-resume-multi-");
    try {
        const taskId = newId("task");
        const executionId = newId("exec");
        const sessionId = newId("sess");
        const traceId = newId("trace");
        const ts = new TransitionService(harness.db, harness.store);
        const now = nowIso();
        // Setup
        harness.db.transaction(() => {
            harness.store.insertTask({
                id: taskId,
                parentId: null,
                rootId: taskId,
                divisionId: "general_ops",
                title: "Multi pause-resume test",
                status: "in_progress",
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
            harness.store.insertExecution({
                id: executionId,
                taskId,
                workflowId: "multi_step_wf",
                parentExecutionId: null,
                agentId: "agent-1",
                roleId: "general_executor",
                runKind: "task_run",
                status: "executing",
                inputRef: null,
                traceId,
                attempt: 1,
                timeoutMs: 120000,
                budgetUsdLimit: 5,
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
            harness.store.insertWorkflowState({
                taskId,
                divisionId: "general_ops",
                workflowId: "multi_step_wf",
                currentStepIndex: 0,
                status: "running",
                outputsJson: "{}",
                lastErrorCode: null,
                retryCount: 0,
                resumableFromStep: null,
                startedAt: now,
                updatedAt: now,
            });
            harness.store.insertSession({
                id: sessionId,
                taskId,
                channel: "cli",
                status: "streaming",
                externalSessionId: null,
                createdAt: now,
                updatedAt: now,
            });
        });
        // First pause-resume cycle at step 0
        ts.transitionWorkflowStatus({
            entityKind: "workflow",
            entityId: taskId,
            fromStatus: "running",
            toStatus: "paused",
            currentStepIndex: 0,
            outputsJson: "{}",
            reasonCode: "pause_1",
            traceId,
            actorType: "system",
            occurredAt: nowIso(),
        });
        ts.transitionWorkflowStatus({
            entityKind: "workflow",
            entityId: taskId,
            fromStatus: "paused",
            toStatus: "resuming",
            currentStepIndex: 0,
            outputsJson: "{}",
            reasonCode: "resume_1",
            traceId,
            actorType: "system",
            occurredAt: nowIso(),
        });
        ts.transitionWorkflowStatus({
            entityKind: "workflow",
            entityId: taskId,
            fromStatus: "resuming",
            toStatus: "running",
            currentStepIndex: 0,
            outputsJson: "{}",
            reasonCode: "resume_complete_1",
            traceId,
            actorType: "system",
            occurredAt: nowIso(),
        });
        // Advance to step 1
        harness.db.transaction(() => {
            harness.store.updateWorkflowState(taskId, "running", 1, JSON.stringify({ step0: "done" }), nowIso(), null);
        });
        // Second pause-resume cycle at step 1
        ts.transitionWorkflowStatus({
            entityKind: "workflow",
            entityId: taskId,
            fromStatus: "running",
            toStatus: "paused",
            currentStepIndex: 1,
            outputsJson: JSON.stringify({ step0: "done" }),
            reasonCode: "pause_2",
            traceId,
            actorType: "system",
            occurredAt: nowIso(),
        });
        ts.transitionWorkflowStatus({
            entityKind: "workflow",
            entityId: taskId,
            fromStatus: "paused",
            toStatus: "resuming",
            currentStepIndex: 1,
            outputsJson: JSON.stringify({ step0: "done" }),
            reasonCode: "resume_2",
            traceId,
            actorType: "system",
            occurredAt: nowIso(),
        });
        ts.transitionWorkflowStatus({
            entityKind: "workflow",
            entityId: taskId,
            fromStatus: "resuming",
            toStatus: "running",
            currentStepIndex: 1,
            outputsJson: JSON.stringify({ step0: "done" }),
            reasonCode: "resume_complete_2",
            traceId,
            actorType: "system",
            occurredAt: nowIso(),
        });
        const workflow = harness.store.getWorkflowState(taskId);
        assert.equal(workflow?.currentStepIndex, 1, "Should still be at step 1 after cycles");
        assert.equal(workflow?.status, "running", "Should be running");
        assert.ok(JSON.parse(workflow.outputsJson).step0, "Step 0 output should be preserved");
    }
    finally {
        harness.cleanup();
    }
});
//# sourceMappingURL=workflow-resume-flow.test.js.map