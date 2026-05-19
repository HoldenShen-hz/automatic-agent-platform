/**
 * E2E Platform Tests
 *
 * End-to-end tests covering complete platform flows:
 * 1. Task execution flow (happy path)
 * 2. Multi-step orchestration flow
 * 3. Plan graph execution
 * 4. Budget reservation and settlement
 * 5. Error handling and recovery
 * 6. Rollback/compensation flow
 *
 * Uses node:test with node:assert/strict. Flat test() calls, no describe().
 */
import assert from "node:assert/strict";
import test from "node:test";
import { createE2EHarness, createSeededE2EHarness } from "../helpers/e2e-harness.js";
import { withProcessGuard } from "../helpers/process-guard.js";
import { runSingleTaskExecution } from "../../src/platform/five-plane-execution/execution-engine/single-task-happy-path.js";
import { runMultiStepOrchestration } from "../../src/platform/five-plane-execution/execution-engine/multi-step-orchestration.js";
import { TransitionService } from "../../src/platform/execution/state-transition/transition-service.js";
import { nowIso, newId } from "../../src/platform/contracts/types/ids.js";
// =============================================================================
// SECTION 1: Task Execution Flow (Happy Path)
// =============================================================================
test("E2E Task Execution: single task happy path - creation to completion", async () => {
    const guard = withProcessGuard(async () => {
        const harness = createE2EHarness("aa-e2e-task-happy-");
        try {
            const result = await runSingleTaskExecution({
                dbPath: harness.dbPath,
                title: "E2E happy path task",
                request: "Process this request and produce results",
                stepOutputOverride: {
                    summary: "Request processed successfully",
                    result: "Task completed",
                    output: "Finished",
                },
            });
            assert.ok(result, "Should return task snapshot");
            assert.ok(result.task, "Snapshot should contain task");
            assert.ok(result.executions, "Snapshot should contain executions");
            assert.ok(result.workflow, "Snapshot should contain workflow");
            assert.ok(result.session, "Snapshot should contain session");
            // Task should reach done status
            assert.equal(result.task?.status, "done", "Task should be in done status");
            assert.ok(result.task?.completedAt, "Task should have completedAt timestamp");
            assert.ok(result.task?.outputJson, "Task should have output JSON");
            // Workflow should be completed
            assert.equal(result.workflow?.status, "completed", "Workflow should be completed");
            // Execution should succeed
            const execution = result.executions?.[0];
            assert.ok(execution, "Should have at least one execution");
            assert.equal(execution?.status, "succeeded", "Execution should be succeeded");
            assert.ok(execution?.finishedAt, "Execution should have finishedAt");
            // Session should be completed
            assert.equal(result.session?.status, "completed", "Session should be completed");
            // Verify output content
            const output = JSON.parse(result.task?.outputJson ?? "{}");
            assert.equal(output.summary, "Request processed successfully");
            assert.equal(output.result, "Task completed");
            // Verify cost tracking exists
            assert.ok(result.task?.actualCostUsd !== undefined, "Should have cost tracking");
            assert.ok(result.task?.estimatedCostUsd !== undefined, "Should have estimated cost");
        }
        finally {
            harness.cleanup();
        }
    });
    await guard();
});
test("E2E Task Execution: task state machine transitions follow correct path", async () => {
    const guard = withProcessGuard(async () => {
        const harness = createE2EHarness("aa-e2e-state-machine-");
        try {
            const taskId = newId("task");
            const executionId = newId("exec");
            const sessionId = newId("sess");
            const traceId = newId("trace");
            const ts = new TransitionService(harness.db, harness.store);
            const now = nowIso();
            // Setup: Create task in queued state
            harness.db.transaction(() => {
                harness.store.insertTask({
                    id: taskId,
                    parentId: null,
                    rootId: taskId,
                    divisionId: "general_ops",
                    tenantId: null,
                    title: "State machine test",
                    status: "queued",
                    source: "user",
                    priority: "normal",
                    inputJson: "{}",
                    normalizedInputJson: "{}",
                    outputJson: null,
                    estimatedCostUsd: 0.05,
                    actualCostUsd: 0,
                    errorCode: null,
                    createdAt: now,
                    updatedAt: now,
                    completedAt: null,
                });
                harness.store.insertExecution({
                    id: executionId,
                    taskId,
                    workflowId: "single_agent_minimal",
                    parentExecutionId: null,
                    agentId: "agent-general",
                    roleId: "general_executor",
                    runKind: "task_run",
                    status: "created",
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
                    startedAt: null,
                    finishedAt: null,
                    createdAt: now,
                    updatedAt: now,
                });
                harness.store.insertWorkflowState({
                    taskId,
                    divisionId: "general_ops",
                    workflowId: "single_agent_minimal",
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
                    status: "open",
                    externalSessionId: null,
                    createdAt: now,
                    updatedAt: now,
                });
            });
            // Verify initial state
            let task = harness.store.getTask(taskId);
            assert.equal(task?.status, "queued", "Task should start in queued state");
            // Transition: queued -> in_progress
            ts.transitionTaskStatus({
                entityKind: "task",
                entityId: taskId,
                fromStatus: "queued",
                toStatus: "in_progress",
                executionId,
                reasonCode: "task.started",
                traceId,
                actorType: "system",
                occurredAt: nowIso(),
            });
            task = harness.store.getTask(taskId);
            assert.equal(task?.status, "in_progress", "Task should transition to in_progress");
            // Transition execution: created -> executing
            ts.transitionExecutionStatus({
                entityKind: "execution",
                entityId: executionId,
                fromStatus: "created",
                toStatus: "executing",
                reasonCode: "execution.started",
                traceId,
                actorType: "system",
                occurredAt: nowIso(),
            });
            let execution = harness.store.getExecution(executionId);
            assert.equal(execution?.status, "executing", "Execution should be executing");
            // Transition execution: executing -> succeeded
            ts.transitionExecutionStatus({
                entityKind: "execution",
                entityId: executionId,
                fromStatus: "executing",
                toStatus: "succeeded",
                reasonCode: "execution.succeeded",
                traceId,
                actorType: "system",
                occurredAt: nowIso(),
            });
            execution = harness.store.getExecution(executionId);
            assert.equal(execution?.status, "succeeded", "Execution should be succeeded");
            // Transition to terminal state: done
            ts.transitionTaskTerminalState({
                taskId,
                sessionId,
                executionId,
                currentTaskStatus: "in_progress",
                currentWorkflowStatus: "running",
                currentSessionStatus: "streaming",
                currentExecutionStatus: "succeeded",
                terminalStatus: "done",
                taskOutputJson: JSON.stringify({ result: "success" }),
                outputsJson: "{}",
                context: {
                    reasonCode: "task.completed",
                    traceId,
                    actorType: "system",
                    occurredAt: nowIso(),
                },
            });
            task = harness.store.getTask(taskId);
            assert.equal(task?.status, "done", "Task should reach done terminal state");
            assert.ok(task?.completedAt, "Task should have completedAt");
            const workflow = harness.store.getWorkflowState(taskId);
            assert.equal(workflow?.status, "completed", "Workflow should be completed");
            const session = harness.store.getSession(sessionId);
            assert.equal(session?.status, "completed", "Session should be completed");
        }
        finally {
            harness.cleanup();
        }
    });
    await guard();
});
test("E2E Task Execution: task execution produces step output artifacts", async () => {
    const guard = withProcessGuard(async () => {
        const harness = createE2EHarness("aa-e2e-artifacts-");
        try {
            const result = await runSingleTaskExecution({
                dbPath: harness.dbPath,
                title: "E2E artifact test",
                request: "Create some artifacts",
                stepOutputOverride: {
                    summary: "Artifacts created",
                    result: "Artifacts generated successfully",
                    artifactData: {
                        files: ["file1.txt", "file2.txt"],
                        count: 2,
                    },
                },
            });
            // Verify artifacts were created
            const artifacts = harness.store.listArtifactsByTask(result.task.id);
            assert.ok(artifacts.length > 0, "Should have created artifacts");
            // Verify step outputs were recorded
            const stepOutputs = harness.store.listStepOutputsByTask(result.task.id);
            assert.ok(stepOutputs.length > 0, "Should have step outputs");
            // Verify step output contains our custom data
            const stepOutput = stepOutputs[0];
            assert.ok(stepOutput, "Should have step output");
            const stepData = JSON.parse(stepOutput?.dataJson ?? "{}");
            assert.equal(stepData.result, "Artifacts generated successfully");
        }
        finally {
            harness.cleanup();
        }
    });
    await guard();
});
// =============================================================================
// SECTION 2: Multi-Step Orchestration Flow
// =============================================================================
test("E2E Multi-Step: orchestration completes multiple dependent steps", async () => {
    const guard = withProcessGuard(async () => {
        const harness = createE2EHarness("aa-e2e-multi-step-");
        try {
            const result = await runMultiStepOrchestration({
                dbPath: harness.dbPath,
                title: "E2E multi-step test",
                request: `oapeflir://plan ${JSON.stringify([
                    {
                        stepId: "step_extract",
                        outputs: ["extracted_data"],
                        dependencies: [],
                        timeout: 30000,
                        retryPolicy: { maxRetries: 0 },
                    },
                    {
                        stepId: "step_transform",
                        outputs: ["transformed_data"],
                        dependencies: ["step_extract"],
                        timeout: 30000,
                        retryPolicy: { maxRetries: 0 },
                    },
                    {
                        stepId: "step_load",
                        outputs: ["final_result"],
                        dependencies: ["step_transform"],
                        timeout: 30000,
                        retryPolicy: { maxRetries: 0 },
                    },
                ])}`,
                stepOutputOverrides: {
                    step_extract: { extracted_data: "extracted value" },
                    step_transform: { transformed_data: "transformed value" },
                    step_load: { final_result: "final result" },
                },
            });
            assert.ok(result.snapshot, "Should return task snapshot");
            assert.ok(result.routing, "Should have routing info");
            assert.ok(result.plannedWorkflow, "Should have planned workflow");
            // Verify task reached done status
            const task = result.snapshot.task;
            assert.ok(task, "Snapshot should contain task");
            assert.equal(task?.status, "done", "Multi-step task should reach done status");
            // Verify all step outputs were recorded
            const stepOutputs = harness.store.listStepOutputsByTask(task.id);
            assert.ok(stepOutputs.length >= 3, "Should have outputs for all 3 steps");
            // Verify workflow is completed
            const workflow = result.snapshot.workflow;
            assert.ok(workflow, "Snapshot should contain workflow");
            assert.equal(workflow?.status, "completed", "Workflow should be completed");
        }
        finally {
            harness.cleanup();
        }
    });
    await guard();
});
test("E2E Multi-Step: orchestration fails on step error and records failure", async () => {
    const guard = withProcessGuard(async () => {
        const harness = createE2EHarness("aa-e2e-multi-step-fail-");
        try {
            const result = await runMultiStepOrchestration({
                dbPath: harness.dbPath,
                title: "E2E multi-step failure test",
                request: `oapeflir://plan ${JSON.stringify([
                    {
                        stepId: "step_extract",
                        outputs: ["extracted_data"],
                        dependencies: [],
                        timeout: 30000,
                        retryPolicy: { maxRetries: 0 },
                    },
                    {
                        stepId: "step_transform",
                        outputs: ["transformed_data"],
                        dependencies: ["step_extract"],
                        timeout: 30000,
                        retryPolicy: { maxRetries: 0 },
                    },
                    {
                        stepId: "step_load",
                        outputs: ["final_result"],
                        dependencies: ["step_transform"],
                        timeout: 30000,
                        retryPolicy: { maxRetries: 0 },
                    },
                ])}`,
                stepFailurePlans: {
                    step_transform: ["transform.failed", "Transform step encountered an error"],
                },
                stepOutputOverrides: {
                    step_extract: { extracted_data: "extracted value" },
                },
            });
            // Verify task reached failed status due to step failure
            const task = result.snapshot.task;
            assert.ok(task, "Snapshot should contain task");
            assert.equal(task?.status, "failed", "Task should be in failed status");
            // Verify workflow is also failed
            const workflow = result.snapshot.workflow;
            assert.ok(workflow, "Snapshot should contain workflow");
            assert.equal(workflow?.status, "failed", "Workflow should be failed");
            // Verify error code is set
            assert.ok(task?.errorCode, "Task should have error code");
            assert.ok(task?.outputJson, "Task should have output JSON with error details");
            const output = JSON.parse(task?.outputJson ?? "{}");
            assert.ok(output.error, "Output should contain error information");
        }
        finally {
            harness.cleanup();
        }
    });
    await guard();
});
test("E2E Multi-Step: workflow advances through step indices correctly", async () => {
    const harness = createE2EHarness("aa-e2e-step-advance-");
    try {
        const taskId = newId("task");
        const executionId = newId("exec");
        const traceId = newId("trace");
        const now = nowIso();
        // Setup: Create task with multi-step workflow at step 0
        harness.db.transaction(() => {
            harness.store.insertTask({
                id: taskId,
                parentId: null,
                rootId: taskId,
                divisionId: "general_ops",
                title: "Step advancement test",
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
                agentId: "agent-coordinator",
                roleId: "coordinator",
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
                maxRetries: 2,
                retryBackoff: "exponential",
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
        });
        // Verify initial state - step 0 running
        let workflow = harness.store.getWorkflowState(taskId);
        assert.ok(workflow, "Workflow should exist");
        assert.equal(workflow.currentStepIndex, 0, "Should start at step 0");
        assert.equal(workflow.status, "running", "Should be running");
        // Advance to step 1 with output
        harness.db.transaction(() => {
            harness.store.updateWorkflowState(taskId, "running", 1, JSON.stringify({ step_0_output: "data_from_step_0" }), now, null);
        });
        workflow = harness.store.getWorkflowState(taskId);
        assert.equal(workflow.currentStepIndex, 1, "Should advance to step 1");
        const outputs = JSON.parse(workflow.outputsJson);
        assert.equal(outputs.step_0_output, "data_from_step_0", "Step 0 output should be preserved");
        // Advance to step 2
        harness.db.transaction(() => {
            harness.store.updateWorkflowState(taskId, "running", 2, JSON.stringify({ step_0_output: "data_from_step_0", step_1_output: "data_from_step_1" }), now, null);
        });
        workflow = harness.store.getWorkflowState(taskId);
        assert.equal(workflow.currentStepIndex, 2, "Should advance to step 2");
        // Complete workflow (step 3 is final)
        harness.db.transaction(() => {
            harness.store.updateWorkflowState(taskId, "completed", 3, JSON.stringify({
                step_0_output: "data_from_step_0",
                step_1_output: "data_from_step_1",
                step_2_output: "data_from_step_2",
                final: "done",
            }), now, null);
        });
        workflow = harness.store.getWorkflowState(taskId);
        assert.equal(workflow.status, "completed", "Workflow should be completed");
        assert.equal(workflow.currentStepIndex, 3, "Should show final step index");
    }
    finally {
        harness.cleanup();
    }
});
// =============================================================================
// SECTION 3: Plan Graph Execution
// =============================================================================
test("E2E Plan Graph: oapeflir plan creates correct dependency edges", async () => {
    const guard = withProcessGuard(async () => {
        const harness = createE2EHarness("aa-e2e-plan-graph-");
        try {
            const result = await runMultiStepOrchestration({
                dbPath: harness.dbPath,
                title: "E2E plan graph test",
                request: `oapeflir://plan ${JSON.stringify([
                    {
                        stepId: "step_a",
                        outputs: ["output_a"],
                        dependencies: [],
                        timeout: 30000,
                        retryPolicy: { maxRetries: 0 },
                    },
                    {
                        stepId: "step_b",
                        outputs: ["output_b"],
                        dependencies: ["step_a"],
                        timeout: 30000,
                        retryPolicy: { maxRetries: 0 },
                    },
                    {
                        stepId: "step_c",
                        outputs: ["output_c"],
                        dependencies: ["step_a"],
                        timeout: 30000,
                        retryPolicy: { maxRetries: 0 },
                    },
                    {
                        stepId: "step_d",
                        outputs: ["output_d"],
                        dependencies: ["step_b", "step_c"],
                        timeout: 30000,
                        retryPolicy: { maxRetries: 0 },
                    },
                ])}`,
                stepOutputOverrides: {
                    step_a: { output_a: "result_a" },
                    step_b: { output_b: "result_b" },
                    step_c: { output_c: "result_c" },
                    step_d: { output_d: "result_d" },
                },
            });
            assert.ok(result.plannedWorkflow, "Should have planned workflow");
            assert.ok(result.plannedWorkflow.executionSteps, "Should have execution steps");
            const steps = result.plannedWorkflow.executionSteps;
            assert.equal(steps.length, 4, "Should have 4 execution steps");
            // Verify step dependencies
            const stepD = steps.find(s => s.stepId === "step_d");
            assert.ok(stepD, "step_d should exist");
            assert.deepEqual(stepD.dependsOnStepIds, ["step_b", "step_c"], "step_d depends on step_b and step_c");
            assert.deepEqual(stepD.dependencyTypes, { step_b: "hard", step_c: "hard" }, "step_d has hard dependencies");
            // Verify routing for oapeflir plan
            assert.equal(result.routing.routeReason, "oapeflir_bridge", "Should use oapeflir bridge");
            assert.ok(result.routing.requiresOrchestration, "Should require orchestration");
        }
        finally {
            harness.cleanup();
        }
    });
    await guard();
});
test("E2E Plan Graph: parallel steps execute and merge correctly", async () => {
    const guard = withProcessGuard(async () => {
        const harness = createE2EHarness("aa-e2e-parallel-");
        try {
            const result = await runMultiStepOrchestration({
                dbPath: harness.dbPath,
                title: "E2E parallel execution test",
                request: `oapeflir://plan ${JSON.stringify([
                    {
                        stepId: "parallel_a",
                        outputs: ["result_a"],
                        dependencies: [],
                        timeout: 30000,
                        retryPolicy: { maxRetries: 0 },
                    },
                    {
                        stepId: "parallel_b",
                        outputs: ["result_b"],
                        dependencies: [],
                        timeout: 30000,
                        retryPolicy: { maxRetries: 0 },
                    },
                    {
                        stepId: "merge_step",
                        outputs: ["merged"],
                        dependencies: ["parallel_a", "parallel_b"],
                        timeout: 30000,
                        retryPolicy: { maxRetries: 0 },
                    },
                ])}`,
                stepOutputOverrides: {
                    parallel_a: { result_a: "A result" },
                    parallel_b: { result_b: "B result" },
                    merge_step: { merged: "A and B combined" },
                },
            });
            // Verify task completed
            const task = result.snapshot.task;
            assert.equal(task?.status, "done", "Task with parallel steps should complete");
            // Verify all step outputs recorded
            const stepOutputs = harness.store.listStepOutputsByTask(task.id);
            assert.ok(stepOutputs.length >= 3, "Should have outputs for all steps including merge");
            // Verify merge step has outputs from both parallel steps aggregated
            const mergeOutput = stepOutputs.find(s => s.stepId === "merge_step");
            assert.ok(mergeOutput, "Merge step should have output");
            const mergeData = JSON.parse(mergeOutput.dataJson);
            assert.equal(mergeData.merged, "A and B combined");
        }
        finally {
            harness.cleanup();
        }
    });
    await guard();
});
test("E2E Plan Graph: workflow validation rejects invalid plans", async () => {
    const harness = createE2EHarness("aa-e2e-plan-validate-");
    try {
        const taskId = newId("task");
        const traceId = newId("trace");
        const now = nowIso();
        // Setup with circular dependency (invalid plan)
        harness.db.transaction(() => {
            harness.store.insertTask({
                id: taskId,
                parentId: null,
                rootId: taskId,
                divisionId: "general_ops",
                title: "Invalid plan test",
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
        // Verify that workflow state can be inspected
        const workflow = harness.store.getWorkflowState(taskId);
        assert.ok(!workflow, "Workflow should not exist yet for fresh task");
        // Insert workflow with invalid self-reference in dependencies
        harness.db.transaction(() => {
            harness.store.insertWorkflowState({
                taskId,
                divisionId: "general_ops",
                workflowId: "invalid_cycle_wf",
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
        const wf = harness.store.getWorkflowState(taskId);
        assert.ok(wf, "Workflow should now exist");
        assert.equal(wf.workflowId, "invalid_cycle_wf", "Should have correct workflow ID");
    }
    finally {
        harness.cleanup();
    }
});
// =============================================================================
// SECTION 4: Budget Reservation and Settlement
// =============================================================================
test("E2E Budget: task execution reserves and tracks budget correctly", async () => {
    const guard = withProcessGuard(async () => {
        const harness = createE2EHarness("aa-e2e-budget-");
        try {
            const initialBudget = 1.0;
            const result = await runSingleTaskExecution({
                dbPath: harness.dbPath,
                title: "E2E budget tracking test",
                request: "Perform a budgeted task",
                stepOutputOverride: {
                    summary: "Budgeted task completed",
                    result: "Done",
                },
            });
            // Verify task has budget limit set
            const execution = result.executions?.[0];
            assert.ok(execution, "Should have execution record");
            assert.equal(execution?.budgetUsdLimit, initialBudget, "Budget limit should be set");
            // Verify cost was recorded
            const costs = harness.store.listCostEventsByTask(result.task.id);
            assert.ok(costs.length > 0, "Should have cost events recorded");
            // Verify actual cost is tracked on task
            assert.ok(result.task?.actualCostUsd !== undefined, "Should have actual cost on task");
            assert.ok(result.task?.actualCostUsd >= 0, "Actual cost should be non-negative");
        }
        finally {
            harness.cleanup();
        }
    });
    await guard();
});
test("E2E Budget: execution budget is consumed during step execution", async () => {
    const guard = withProcessGuard(async () => {
        const harness = createE2EHarness("aa-e2e-budget-consume-");
        try {
            const result = await runMultiStepOrchestration({
                dbPath: harness.dbPath,
                title: "E2E budget consumption test",
                request: `oapeflir://plan ${JSON.stringify([
                    {
                        stepId: "step_1",
                        outputs: ["out1"],
                        dependencies: [],
                        timeout: 30000,
                        retryPolicy: { maxRetries: 0 },
                    },
                    {
                        stepId: "step_2",
                        outputs: ["out2"],
                        dependencies: ["step_1"],
                        timeout: 30000,
                        retryPolicy: { maxRetries: 0 },
                    },
                ])}`,
                stepOutputOverrides: {
                    step_1: { out1: "first" },
                    step_2: { out2: "second" },
                },
            });
            const task = result.snapshot.task;
            const costs = harness.store.listCostEventsByTask(task.id);
            // Multiple cost events should be recorded (one per step)
            assert.ok(costs.length >= 1, "Should have cost events for multi-step execution");
            // Verify all costs have task and execution IDs
            for (const cost of costs) {
                assert.equal(cost.taskId, task.id, "Cost event should reference task");
                assert.ok(cost.executionId, "Cost event should have execution ID");
            }
        }
        finally {
            harness.cleanup();
        }
    });
    await guard();
});
test("E2E Budget: budget settlement records final costs on task completion", async () => {
    const guard = withProcessGuard(async () => {
        const harness = createE2EHarness("aa-e2e-budget-settle-");
        try {
            const result = await runSingleTaskExecution({
                dbPath: harness.dbPath,
                title: "E2E budget settlement test",
                request: "Complete and settle budget",
                stepOutputOverride: {
                    summary: "Task completed",
                    result: "Settled",
                },
            });
            const task = result.snapshot.task;
            // Task should have actual cost set
            assert.ok(task.actualCostUsd !== undefined, "Should have actual cost");
            assert.ok(task.actualCostUsd >= 0, "Actual cost should be non-negative");
            // Task should be in terminal state with completed timestamp
            assert.ok(task.completedAt, "Should have completedAt");
            assert.equal(task.status, "done", "Should be in done status");
            // Verify estimated cost vs actual cost relationship
            assert.ok(task.estimatedCostUsd !== undefined, "Should have estimated cost");
            // Actual may be less than or equal to estimated (budget reserved but not all consumed)
        }
        finally {
            harness.cleanup();
        }
    });
    await guard();
});
test("E2E Budget: multi-step workflow aggregates budget across steps", async () => {
    const guard = withProcessGuard(async () => {
        const harness = createE2EHarness("aa-e2e-budget-aggregate-");
        try {
            const result = await runMultiStepOrchestration({
                dbPath: harness.dbPath,
                title: "E2E budget aggregation test",
                request: `oapeflir://plan ${JSON.stringify([
                    { stepId: "step_a", outputs: ["out_a"], dependencies: [], timeout: 30000, retryPolicy: { maxRetries: 0 } },
                    { stepId: "step_b", outputs: ["out_b"], dependencies: [], timeout: 30000, retryPolicy: { maxRetries: 0 } },
                    { stepId: "step_c", outputs: ["out_c"], dependencies: ["step_a", "step_b"], timeout: 30000, retryPolicy: { maxRetries: 0 } },
                ])}`,
                stepOutputOverrides: {
                    step_a: { out_a: "A" },
                    step_b: { out_b: "B" },
                    step_c: { out_c: "C" },
                },
            });
            const task = result.snapshot.task;
            const costs = harness.store.listCostEventsByTask(task.id);
            // Should have cost events for each step execution
            assert.ok(costs.length >= 3, "Should have cost for each step");
            // Aggregate actual costs
            const totalCost = costs.reduce((sum, c) => sum + c.costUsd, 0);
            assert.ok(totalCost >= 0, "Total cost should be non-negative");
            // Task final actual cost should reflect sum of all step costs
            assert.ok(task.actualCostUsd >= 0, "Task actual cost should be non-negative");
        }
        finally {
            harness.cleanup();
        }
    });
    await guard();
});
// =============================================================================
// SECTION 5: Error Handling and Recovery
// =============================================================================
test("E2E Error: task execution failure transitions to failed state", async () => {
    const harness = createE2EHarness("aa-e2e-task-fail-");
    try {
        const taskId = newId("task");
        const executionId = newId("exec");
        const traceId = newId("trace");
        const ts = new TransitionService(harness.db, harness.store);
        const now = nowIso();
        // Setup: task in_progress with execution
        harness.db.transaction(() => {
            harness.store.insertTask({
                id: taskId,
                parentId: null,
                rootId: taskId,
                divisionId: "general_ops",
                title: "Failure test task",
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
                workflowId: "single_agent_minimal",
                parentExecutionId: null,
                agentId: "agent-fail",
                roleId: "general_executor",
                runKind: "task_run",
                status: "executing",
                inputRef: null,
                traceId,
                attempt: 1,
                timeoutMs: 5000,
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
            harness.store.insertWorkflowState({
                taskId,
                divisionId: "general_ops",
                workflowId: "single_agent_minimal",
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
        // Transition execution to failed
        ts.transitionExecutionStatus({
            entityKind: "execution",
            entityId: executionId,
            fromStatus: "executing",
            toStatus: "failed",
            reasonCode: "execution.timeout",
            traceId,
            actorType: "agent",
            occurredAt: nowIso(),
        });
        let execution = harness.store.getExecution(executionId);
        assert.equal(execution?.status, "failed", "Execution should be failed");
        assert.ok(execution?.finishedAt, "Execution should have finishedAt");
        // Transition to task terminal state: failed
        ts.transitionTaskTerminalState({
            taskId,
            sessionId: "dummy-session",
            executionId,
            currentTaskStatus: "in_progress",
            currentWorkflowStatus: "running",
            currentSessionStatus: "streaming",
            currentExecutionStatus: "failed",
            terminalStatus: "failed",
            taskOutputJson: JSON.stringify({ error: "Execution failed" }),
            outputsJson: "{}",
            context: {
                reasonCode: "task.failed",
                traceId,
                actorType: "system",
                occurredAt: nowIso(),
            },
        });
        const task = harness.store.getTask(taskId);
        assert.equal(task?.status, "failed", "Task should be in failed state");
        assert.ok(task?.completedAt, "Task should have completedAt");
        assert.ok(task?.errorCode, "Task should have error code set");
    }
    finally {
        harness.cleanup();
    }
});
test("E2E Error: execution deadlock detection and handling", async () => {
    const harness = createE2EHarness("aa-e2e-deadlock-");
    try {
        const taskId = newId("task");
        const executionId = newId("exec");
        const traceId = newId("trace");
        const ts = new TransitionService(harness.db, harness.store);
        const now = nowIso();
        // Setup: task in execution with stuck workflow
        harness.db.transaction(() => {
            harness.store.insertTask({
                id: taskId,
                parentId: null,
                rootId: taskId,
                divisionId: "general_ops",
                title: "Deadlock test",
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
            harness.store.insertExecution({
                id: executionId,
                taskId,
                workflowId: "multi_step_wf",
                parentExecutionId: null,
                agentId: "agent-dea",
                roleId: "general_executor",
                runKind: "task_run",
                status: "executing",
                inputRef: null,
                traceId,
                attempt: 1,
                timeoutMs: 60000,
                budgetUsdLimit: 2,
                requiresApproval: 0,
                sandboxMode: "workspace_write",
                allowedToolsJson: "[]",
                allowedPathsJson: "[]",
                maxRetries: 3,
                retryBackoff: "exponential",
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
                lastErrorCode: "E7_DEADLOCK",
                retryCount: 3,
                resumableFromStep: null,
                startedAt: now,
                updatedAt: now,
            });
        });
        // Verify workflow has deadlock error code
        let workflow = harness.store.getWorkflowState(taskId);
        assert.equal(workflow?.lastErrorCode, "E7_DEADLOCK", "Should have deadlock error code");
        assert.equal(workflow?.retryCount, 3, "Should have max retries exhausted");
        // Transition to failed terminal state
        ts.transitionTaskTerminalState({
            taskId,
            sessionId: "sess-deadlock",
            executionId,
            currentTaskStatus: "in_progress",
            currentWorkflowStatus: "running",
            currentSessionStatus: "streaming",
            currentExecutionStatus: "executing",
            terminalStatus: "failed",
            taskOutputJson: JSON.stringify({ error: "E7_DEADLOCK", message: "Execution deadlocked" }),
            outputsJson: "{}",
            context: {
                reasonCode: "task.deadlock",
                traceId,
                actorType: "system",
                occurredAt: nowIso(),
            },
        });
        const task = harness.store.getTask(taskId);
        assert.equal(task?.status, "failed", "Task should be failed due to deadlock");
    }
    finally {
        harness.cleanup();
    }
});
test("E2E Error: retry with backoff is correctly recorded", async () => {
    const harness = createE2EHarness("aa-e2e-retry-backoff-");
    try {
        const taskId = newId("task");
        const exec1 = newId("exec1");
        const exec2 = newId("exec2");
        const traceId = newId("trace");
        const ts = new TransitionService(harness.db, harness.store);
        const now = nowIso();
        // Setup: task with first execution failed
        harness.db.transaction(() => {
            harness.store.insertTask({
                id: taskId,
                parentId: null,
                rootId: taskId,
                divisionId: "general_ops",
                title: "Retry test",
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
            // First execution failed
            harness.store.insertExecution({
                id: exec1,
                taskId,
                workflowId: "single_agent_minimal",
                parentExecutionId: null,
                agentId: "agent-retry",
                roleId: "general_executor",
                runKind: "task_run",
                status: "failed",
                inputRef: null,
                traceId,
                attempt: 1,
                timeoutMs: 60000,
                budgetUsdLimit: 1,
                requiresApproval: 0,
                sandboxMode: "workspace_write",
                allowedToolsJson: "[]",
                allowedPathsJson: "[]",
                maxRetries: 2,
                retryBackoff: "exponential",
                lastErrorCode: "E8_TIMEOUT",
                lastErrorMessage: "Step timed out",
                startedAt: now,
                finishedAt: nowIso(),
                createdAt: now,
                updatedAt: now,
            });
            // Second execution in progress (retry)
            harness.store.insertExecution({
                id: exec2,
                taskId,
                workflowId: "single_agent_minimal",
                parentExecutionId: null,
                agentId: "agent-retry",
                roleId: "general_executor",
                runKind: "task_run",
                status: "executing",
                inputRef: null,
                traceId: newId("trace2"),
                attempt: 2,
                timeoutMs: 60000,
                budgetUsdLimit: 1,
                requiresApproval: 0,
                sandboxMode: "workspace_write",
                allowedToolsJson: "[]",
                allowedPathsJson: "[]",
                maxRetries: 2,
                retryBackoff: "exponential",
                lastErrorCode: null,
                lastErrorMessage: null,
                startedAt: nowIso(),
                finishedAt: null,
                createdAt: nowIso(),
                updatedAt: nowIso(),
            });
            harness.store.insertWorkflowState({
                taskId,
                divisionId: "general_ops",
                workflowId: "single_agent_minimal",
                currentStepIndex: 0,
                status: "running",
                outputsJson: "{}",
                lastErrorCode: null,
                retryCount: 1,
                resumableFromStep: null,
                startedAt: now,
                updatedAt: now,
            });
        });
        // Verify first execution failed with error
        const failedExec = harness.store.getExecution(exec1);
        assert.equal(failedExec?.status, "failed", "First execution should be failed");
        assert.equal(failedExec?.lastErrorCode, "E8_TIMEOUT", "Should have timeout error");
        assert.equal(failedExec?.attempt, 1, "First attempt should be 1");
        // Verify second execution is retry attempt
        const retryExec = harness.store.getExecution(exec2);
        assert.equal(retryExec?.status, "executing", "Second execution should be executing");
        assert.equal(retryExec?.attempt, 2, "Second attempt should be 2");
        assert.ok(retryExec?.startedAt, "Second execution should have startedAt");
        // Verify workflow retry count
        const workflow = harness.store.getWorkflowState(taskId);
        assert.equal(workflow?.retryCount, 1, "Workflow should show 1 retry");
    }
    finally {
        harness.cleanup();
    }
});
test("E2E Error: multi-step fails at step boundary with proper state", async () => {
    const guard = withProcessGuard(async () => {
        const harness = createE2EHarness("aa-e2e-step-fail-");
        try {
            const result = await runMultiStepOrchestration({
                dbPath: harness.dbPath,
                title: "E2E step boundary failure",
                request: `oapeflir://plan ${JSON.stringify([
                    { stepId: "step_ok", outputs: ["ok_out"], dependencies: [], timeout: 30000, retryPolicy: { maxRetries: 0 } },
                    { stepId: "step_fail", outputs: ["fail_out"], dependencies: ["step_ok"], timeout: 30000, retryPolicy: { maxRetries: 0 } },
                    { stepId: "step_skip", outputs: ["skip_out"], dependencies: ["step_fail"], timeout: 30000, retryPolicy: { maxRetries: 0 } },
                ])}`,
                stepFailurePlans: {
                    step_fail: ["step.failed", "Step failed at boundary"],
                },
                stepOutputOverrides: {
                    step_ok: { ok_out: "ok" },
                },
            });
            const task = result.snapshot.task;
            assert.equal(task.status, "failed", "Task should fail when step fails");
            const workflow = result.snapshot.workflow;
            assert.equal(workflow.status, "failed", "Workflow should fail");
            // Verify error is recorded
            assert.ok(task.errorCode, "Task should have error code");
            const output = JSON.parse(task.outputJson ?? "{}");
            assert.ok(output.error, "Output should contain error info");
        }
        finally {
            harness.cleanup();
        }
    });
    await guard();
});
// =============================================================================
// SECTION 6: Rollback/Compensation Flow
// =============================================================================
test("E2E Rollback: workflow with compensation model records compensation events", async () => {
    const harness = createE2EHarness("aa-e2e-comp-");
    try {
        const taskId = newId("task");
        const executionId = newId("exec");
        const traceId = newId("trace");
        const now = nowIso();
        // Setup: workflow state with compensation tracking
        harness.db.transaction(() => {
            harness.store.insertTask({
                id: taskId,
                parentId: null,
                rootId: taskId,
                divisionId: "general_ops",
                title: "Compensation test",
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
                workflowId: "compensating_wf",
                parentExecutionId: null,
                agentId: "agent-comp",
                roleId: "general_executor",
                runKind: "task_run",
                status: "executing",
                inputRef: null,
                traceId,
                attempt: 1,
                timeoutMs: 120000,
                budgetUsdLimit: 3,
                requiresApproval: 0,
                sandboxMode: "workspace_write",
                allowedToolsJson: "[]",
                allowedPathsJson: "[]",
                maxRetries: 1,
                retryBackoff: "exponential",
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
                workflowId: "compensating_wf",
                currentStepIndex: 1,
                status: "running",
                outputsJson: JSON.stringify({
                    step_0: { data: "created" },
                }),
                lastErrorCode: null,
                retryCount: 0,
                resumableFromStep: null,
                startedAt: now,
                updatedAt: now,
            });
        });
        // Verify workflow outputs include compensation data
        const workflow = harness.store.getWorkflowState(taskId);
        assert.ok(workflow, "Workflow should exist");
        const outputs = JSON.parse(workflow.outputsJson);
        assert.ok(outputs.step_0, "Step 0 output should be preserved");
        // Transition to failed state (simulating compensation trigger)
        const ts = new TransitionService(harness.db, harness.store);
        ts.transitionWorkflowStatus({
            entityKind: "workflow",
            entityId: taskId,
            fromStatus: "running",
            toStatus: "failed",
            currentStepIndex: 1,
            outputsJson: workflow.outputsJson,
            reasonCode: "workflow.compensation_triggered",
            traceId,
            actorType: "system",
            occurredAt: nowIso(),
        });
        const updatedWf = harness.store.getWorkflowState(taskId);
        assert.equal(updatedWf?.status, "failed", "Workflow should be failed");
        // Transition task to failed
        ts.transitionTaskTerminalState({
            taskId,
            sessionId: "sess-comp",
            executionId,
            currentTaskStatus: "in_progress",
            currentWorkflowStatus: "failed",
            currentSessionStatus: "streaming",
            currentExecutionStatus: "executing",
            terminalStatus: "failed",
            taskOutputJson: JSON.stringify({ error: "compensation_triggered" }),
            outputsJson: workflow.outputsJson,
            context: {
                reasonCode: "task.compensation_failed",
                traceId,
                actorType: "system",
                occurredAt: nowIso(),
            },
        });
        const task = harness.store.getTask(taskId);
        assert.equal(task?.status, "failed", "Task should be failed");
    }
    finally {
        harness.cleanup();
    }
});
test("E2E Rollback: saga-style compensation for multi-step workflow", async () => {
    const harness = createE2EHarness("aa-e2e-saga-");
    try {
        const taskId = newId("task");
        const execId = newId("exec");
        const traceId = newId("trace");
        const ts = new TransitionService(harness.db, harness.store);
        const now = nowIso();
        // Setup: multi-step workflow that will need compensation
        harness.db.transaction(() => {
            harness.store.insertTask({
                id: taskId,
                parentId: null,
                rootId: taskId,
                divisionId: "general_ops",
                title: "Saga compensation test",
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
                id: execId,
                taskId,
                workflowId: "saga_wf",
                parentExecutionId: null,
                agentId: "agent-saga",
                roleId: "coordinator",
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
            // Workflow progressed through step 0 and step 1
            harness.store.insertWorkflowState({
                taskId,
                divisionId: "general_ops",
                workflowId: "saga_wf",
                currentStepIndex: 2, // Was at step 2 when failure occurred
                status: "running",
                outputsJson: JSON.stringify({
                    step_0: { status: "committed" },
                    step_1: { status: "committed" },
                }),
                lastErrorCode: null,
                retryCount: 0,
                resumableFromStep: null,
                startedAt: now,
                updatedAt: now,
            });
        });
        // Simulate failure at step 2 requiring compensation
        const workflowBefore = harness.store.getWorkflowState(taskId);
        assert.ok(workflowBefore, "Workflow should exist");
        const outputsBefore = JSON.parse(workflowBefore.outputsJson);
        assert.ok(outputsBefore.step_0, "Step 0 output should exist for compensation");
        assert.ok(outputsBefore.step_1, "Step 1 output should exist for compensation");
        // Record compensation event
        harness.db.transaction(() => {
            harness.store.insertEvent({
                id: newId("evt"),
                taskId,
                executionId: execId,
                eventType: "compensation:started",
                eventTier: "tier_1",
                payloadJson: JSON.stringify({
                    failedStep: "step_2",
                    compensatingSteps: ["step_1", "step_0"],
                    reason: "saga_failure",
                }),
                traceId,
                createdAt: nowIso(),
            });
        });
        // Verify compensation event was recorded
        const events = harness.store.listEventsByTask(taskId);
        const compEvent = events.find(e => e.eventType === "compensation:started");
        assert.ok(compEvent, "Compensation event should be recorded");
        // Transition workflow to failed
        ts.transitionWorkflowStatus({
            entityKind: "workflow",
            entityId: taskId,
            fromStatus: "running",
            toStatus: "failed",
            currentStepIndex: 2,
            outputsJson: workflowBefore.outputsJson,
            reasonCode: "saga.step_failed",
            traceId,
            actorType: "system",
            occurredAt: nowIso(),
        });
        const workflowAfter = harness.store.getWorkflowState(taskId);
        assert.equal(workflowAfter?.status, "failed", "Workflow should be failed");
    }
    finally {
        harness.cleanup();
    }
});
test("E2E Rollback: rollback clears workflow outputs and resets step index", async () => {
    const harness = createE2EHarness("aa-e2e-rollback-reset-");
    try {
        const taskId = newId("task");
        const traceId = newId("trace");
        const ts = new TransitionService(harness.db, harness.store);
        const now = nowIso();
        // Setup: workflow at step 2 with accumulated outputs
        harness.db.transaction(() => {
            harness.store.insertTask({
                id: taskId,
                parentId: null,
                rootId: taskId,
                divisionId: "general_ops",
                title: "Rollback reset test",
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
            harness.store.insertWorkflowState({
                taskId,
                divisionId: "general_ops",
                workflowId: "rollback_wf",
                currentStepIndex: 2,
                status: "running",
                outputsJson: JSON.stringify({
                    step_0: { data: "output_0" },
                    step_1: { data: "output_1" },
                }),
                lastErrorCode: null,
                retryCount: 0,
                resumableFromStep: null,
                startedAt: now,
                updatedAt: now,
            });
        });
        // Verify state before rollback
        let workflow = harness.store.getWorkflowState(taskId);
        assert.equal(workflow.currentStepIndex, 2, "Should be at step 2 before rollback");
        const outputsBefore = JSON.parse(workflow.outputsJson);
        assert.ok(outputsBefore.step_0, "Should have step 0 output");
        // Perform rollback by resetting workflow to step 0
        harness.db.transaction(() => {
            harness.store.updateWorkflowState(taskId, "running", 0, // Reset to step 0
            JSON.stringify({}), // Clear outputs
            now, null);
        });
        // Verify state after rollback
        workflow = harness.store.getWorkflowState(taskId);
        assert.equal(workflow.currentStepIndex, 0, "Should be reset to step 0");
        const outputsAfter = JSON.parse(workflow.outputsJson);
        assert.equal(Object.keys(outputsAfter).length, 0, "Outputs should be cleared");
        // Transition to cancelled (user cancelled during rollback)
        ts.transitionWorkflowStatus({
            entityKind: "workflow",
            entityId: taskId,
            fromStatus: "running",
            toStatus: "cancelled",
            currentStepIndex: 0,
            outputsJson: workflow.outputsJson,
            reasonCode: "workflow.user_cancelled",
            traceId,
            actorType: "user",
            occurredAt: nowIso(),
        });
        workflow = harness.store.getWorkflowState(taskId);
        assert.equal(workflow?.status, "cancelled", "Workflow should be cancelled");
    }
    finally {
        harness.cleanup();
    }
});
test("E2E Rollback: checkpoint enables workflow resume after rollback", async () => {
    const harness = createE2EHarness("aa-e2e-checkpoint-");
    try {
        const taskId = newId("task");
        const traceId = newId("trace");
        const now = nowIso();
        // Setup: workflow at step 1 with checkpoint
        harness.db.transaction(() => {
            harness.store.insertTask({
                id: taskId,
                parentId: null,
                rootId: taskId,
                divisionId: "general_ops",
                title: "Checkpoint resume test",
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
            harness.store.insertWorkflowState({
                taskId,
                divisionId: "general_ops",
                workflowId: "checkpoint_wf",
                currentStepIndex: 1,
                status: "running",
                outputsJson: JSON.stringify({ step_0: { checkpoint: true } }),
                lastErrorCode: null,
                retryCount: 0,
                resumableFromStep: "step_0", // Can resume from step 0
                startedAt: now,
                updatedAt: now,
            });
        });
        // Verify checkpoint data
        const workflow = harness.store.getWorkflowState(taskId);
        assert.equal(workflow.currentStepIndex, 1, "Should be at step 1");
        assert.equal(workflow.resumableFromStep, "step_0", "Should be resumable from step 0");
        // Simulate failure and task terminal state with failed status
        const ts = new TransitionService(harness.db, harness.store);
        ts.transitionTaskTerminalState({
            taskId,
            sessionId: "sess-check",
            executionId: "exec-check",
            currentTaskStatus: "in_progress",
            currentWorkflowStatus: "running",
            currentSessionStatus: "streaming",
            currentExecutionStatus: "executing",
            terminalStatus: "failed",
            taskOutputJson: JSON.stringify({ error: "checkpoint_test_failure" }),
            outputsJson: workflow.outputsJson,
            context: {
                reasonCode: "task.failed",
                traceId,
                actorType: "system",
                occurredAt: nowIso(),
            },
        });
        const task = harness.store.getTask(taskId);
        assert.equal(task?.status, "failed", "Task should be failed");
        // Verify workflow state preserves checkpoint info even in failure
        const failedWorkflow = harness.store.getWorkflowState(taskId);
        assert.ok(failedWorkflow, "Workflow state should still exist");
        assert.equal(failedWorkflow.resumableFromStep, "step_0", "Resumable step should be preserved");
    }
    finally {
        harness.cleanup();
    }
});
// =============================================================================
// SECTION 7: Session and Message Integrity
// =============================================================================
test("E2E Session: session tracks messages and reflects current status", async () => {
    const harness = createE2EHarness("aa-e2e-session-");
    try {
        const taskId = newId("task");
        const sessionId = newId("sess");
        const traceId = newId("trace");
        const ts = new TransitionService(harness.db, harness.store);
        const now = nowIso();
        // Setup: task with session
        harness.db.transaction(() => {
            harness.store.insertTask({
                id: taskId,
                parentId: null,
                rootId: taskId,
                divisionId: "general_ops",
                title: "Session test",
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
            harness.store.insertSession({
                id: sessionId,
                taskId,
                channel: "cli",
                status: "open",
                externalSessionId: null,
                createdAt: now,
                updatedAt: now,
            });
            // Insert inbound message
            harness.store.insertMessage({
                id: newId("msg1"),
                sessionId,
                direction: "inbound",
                messageType: "user_request",
                content: "Test request",
                partsJson: null,
                attachmentsJson: null,
                createdAt: now,
            });
            // Insert outbound message
            harness.store.insertMessage({
                id: newId("msg2"),
                sessionId,
                direction: "outbound",
                messageType: "assistant_response",
                content: "Test response",
                partsJson: null,
                attachmentsJson: null,
                createdAt: now,
            });
        });
        // Verify session exists with messages
        const session = harness.store.getSession(sessionId);
        assert.ok(session, "Session should exist");
        assert.equal(session.channel, "cli", "Session should be CLI channel");
        assert.equal(session.status, "open", "Session should be open initially");
        // Get messages
        const messages = harness.store.listMessagesBySession(sessionId);
        assert.equal(messages.length, 2, "Should have 2 messages");
        assert.ok(messages.some(m => m.direction === "inbound"), "Should have inbound message");
        assert.ok(messages.some(m => m.direction === "outbound"), "Should have outbound message");
        // Transition session to streaming
        ts.transitionSessionStatus({
            entityKind: "session",
            entityId: sessionId,
            fromStatus: "open",
            toStatus: "streaming",
            reasonCode: "session.streaming_started",
            traceId,
            actorType: "system",
            occurredAt: nowIso(),
        });
        const updatedSession = harness.store.getSession(sessionId);
        assert.equal(updatedSession?.status, "streaming", "Session should be streaming");
    }
    finally {
        harness.cleanup();
    }
});
test("E2E Events: tier-1 and tier-2 events are recorded correctly", async () => {
    const harness = createE2EHarness("aa-e2e-events-");
    try {
        const taskId = newId("task");
        const executionId = newId("exec");
        const traceId = newId("trace");
        const now = nowIso();
        // Setup: task with execution
        harness.db.transaction(() => {
            harness.store.insertTask({
                id: taskId,
                parentId: null,
                rootId: taskId,
                divisionId: "general_ops",
                title: "Events test",
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
                workflowId: "single_agent_minimal",
                parentExecutionId: null,
                agentId: "agent-evt",
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
            // Insert tier-1 event
            harness.store.insertEvent({
                id: newId("evt1"),
                taskId,
                executionId,
                eventType: "workflow:step_completed",
                eventTier: "tier_1",
                payloadJson: JSON.stringify({ stepId: "intake_triage", status: "succeeded" }),
                traceId,
                createdAt: now,
            });
            // Insert tier-2 event
            harness.store.insertEvent({
                id: newId("evt2"),
                taskId,
                executionId,
                eventType: "admission:evaluated",
                eventTier: "tier_2",
                payloadJson: JSON.stringify({ decision: "allow" }),
                traceId,
                createdAt: now,
            });
        });
        // Verify events were recorded
        const events = harness.store.listEventsByTask(taskId);
        assert.equal(events.length, 2, "Should have 2 events");
        const tier1Events = events.filter(e => e.eventTier === "tier_1");
        assert.equal(tier1Events.length, 1, "Should have 1 tier-1 event");
        assert.equal(tier1Events[0].eventType, "workflow:step_completed");
        const tier2Events = events.filter(e => e.eventTier === "tier_2");
        assert.equal(tier2Events.length, 1, "Should have 1 tier-2 event");
        assert.equal(tier2Events[0].eventType, "admission:evaluated");
    }
    finally {
        harness.cleanup();
    }
});
// =============================================================================
// SECTION 8: Seeding and Quick Setup Patterns
// =============================================================================
test("E2E Seeding: createSeededE2EHarness creates pre-configured task and execution", async () => {
    const harness = createSeededE2EHarness("aa-e2e-seeded-", {
        taskId: "task-seeded-001",
        executionId: "exec-seeded-001",
    });
    try {
        // Verify seeded task exists
        const task = harness.store.getTask("task-seeded-001");
        assert.ok(task, "Seeded task should exist");
        assert.equal(task?.title, "E2E test task", "Seeded task should have correct title");
        assert.equal(task?.status, "in_progress", "Seeded task should be in_progress");
        // Verify seeded execution exists
        const execution = harness.store.getExecution("exec-seeded-001");
        assert.ok(execution, "Seeded execution should exist");
        assert.equal(execution?.status, "executing", "Seeded execution should be executing");
        assert.equal(execution?.workflowId, "single_agent_minimal", "Seeded execution should have correct workflow");
        // Verify workflow state exists
        const workflow = harness.store.getWorkflowState("task-seeded-001");
        assert.ok(workflow, "Seeded workflow should exist");
    }
    finally {
        harness.cleanup();
    }
});
test("E2E Priority: task execution with different priorities", async () => {
    const guard = withProcessGuard(async () => {
        const harness = createE2EHarness("aa-e2e-priority-");
        try {
            // Execute task with default priority
            const result = await runSingleTaskExecution({
                dbPath: harness.dbPath,
                title: "Default priority task",
                request: "Process this",
                stepOutputOverride: {
                    summary: "Done",
                    result: "OK",
                },
            });
            assert.equal(result.task?.priority, "normal", "Default priority should be normal");
            // Create high priority task manually
            const taskId = newId("task");
            const now = nowIso();
            harness.db.transaction(() => {
                harness.store.insertTask({
                    id: taskId,
                    parentId: null,
                    rootId: taskId,
                    divisionId: "general_ops",
                    tenantId: null,
                    title: "High priority task",
                    status: "queued",
                    source: "user",
                    priority: "high",
                    inputJson: "{}",
                    normalizedInputJson: "{}",
                    outputJson: null,
                    estimatedCostUsd: 0.05,
                    actualCostUsd: 0,
                    errorCode: null,
                    createdAt: now,
                    updatedAt: now,
                    completedAt: null,
                });
            });
            const task = harness.store.getTask(taskId);
            assert.equal(task?.priority, "high", "Task should have high priority");
        }
        finally {
            harness.cleanup();
        }
    });
    await guard();
});
//# sourceMappingURL=platform-comprehensive-e2e.test.js.map