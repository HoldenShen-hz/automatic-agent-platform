/**
 * Integration Test: Workflow Planner
 *
 * Tests the WorkflowPlanner service which transforms workflow definitions
 * into executable execution plans with agent assignments and dependency edges.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { createIntegrationContext, createSeededIntegrationContext } from "../../../helpers/integration-context.js";
import { WorkflowPlanner } from "../../../../src/platform/orchestration/routing/workflow-planner.js";
import { nowIso } from "../../../../src/platform/contracts/types/ids.js";
test("WorkflowPlanner creates a single-step execution plan from single_agent_minimal workflow", () => {
    const ctx = createIntegrationContext("aa-planner-single-");
    try {
        const planner = new WorkflowPlanner();
        const input = {
            workflowId: "single_agent_minimal",
            request: "analyze this request",
        };
        const result = planner.plan(input);
        assert.equal(result.workflow.workflowId, "single_agent_minimal");
        assert.equal(result.executionSteps.length, 1);
        assert.equal(result.executionSteps[0].stepId, "analyze_request");
        assert.equal(result.executionSteps[0].roleId, "general_executor");
        assert.equal(result.executionSteps[0].agentId, "agent_general_executor");
        assert.equal(result.executionSteps[0].outputKey, "analysis");
        assert.deepEqual(result.executionSteps[0].dependsOnStepIds, []);
        assert.equal(result.planReason, "workflow.single_step_execution");
        assert.deepEqual(result.dependencyEdges, []);
    }
    finally {
        ctx.cleanup();
    }
});
test("WorkflowPlanner creates multi-step execution plan from orchestration workflow", () => {
    const ctx = createIntegrationContext("aa-planner-multi-");
    try {
        const planner = new WorkflowPlanner();
        const input = {
            workflowId: "single_division_multi_step_orchestration",
            request: "plan and execute a complex workflow with multiple steps",
        };
        const result = planner.plan(input);
        assert.equal(result.workflow.workflowId, "single_division_multi_step_orchestration");
        assert.equal(result.executionSteps.length, 3);
        // Step 1: intake_triage (entrypoint)
        const step1 = result.executionSteps.find((s) => s.stepId === "intake_triage");
        assert.ok(step1, "Should have intake_triage step");
        assert.equal(step1.roleId, "intake_router");
        assert.equal(step1.agentId, "agent_intake_router");
        assert.deepEqual(step1.dependsOnStepIds, []);
        assert.deepEqual(step1.dependencyTypes, {});
        // Step 2: draft_solution (depends on intake_triage)
        const step2 = result.executionSteps.find((s) => s.stepId === "draft_solution");
        assert.ok(step2, "Should have draft_solution step");
        assert.equal(step2.roleId, "general_executor");
        assert.deepEqual(step2.inputKeys, ["triage"]);
        assert.deepEqual(step2.dependsOnStepIds, ["intake_triage"]);
        assert.deepEqual(step2.dependencyTypes, { intake_triage: "hard" });
        // Step 3: final_review (depends on draft_solution)
        const step3 = result.executionSteps.find((s) => s.stepId === "final_review");
        assert.ok(step3, "Should have final_review step");
        assert.equal(step3.roleId, "workflow_planner");
        assert.deepEqual(step3.inputKeys, ["draft"]);
        assert.deepEqual(step3.dependsOnStepIds, ["draft_solution"]);
        assert.deepEqual(step3.dependencyTypes, { draft_solution: "hard" });
        // Dependency edges
        assert.equal(result.dependencyEdges.length, 2);
        assert.deepEqual(result.dependencyEdges[0], { fromStepId: "intake_triage", toStepId: "draft_solution" });
        assert.deepEqual(result.dependencyEdges[1], { fromStepId: "draft_solution", toStepId: "final_review" });
        assert.equal(result.planReason, "workflow.requires_multi_step_orchestration");
    }
    finally {
        ctx.cleanup();
    }
});
test("WorkflowPlanner throws StorageError for unknown workflow", () => {
    const ctx = createIntegrationContext("aa-planner-not-found-");
    try {
        const planner = new WorkflowPlanner();
        const input = {
            workflowId: "non_existent_workflow",
            request: "test request",
        };
        assert.throws(() => planner.plan(input), (err) => {
            const error = err;
            return error.message?.includes("workflow.not_found:non_existent_workflow") ?? false;
        });
    }
    finally {
        ctx.cleanup();
    }
});
test("WorkflowPlanner preserves workflow division ID in step defaults", () => {
    const ctx = createIntegrationContext("aa-planner-division-");
    try {
        const planner = new WorkflowPlanner();
        const input = {
            workflowId: "single_agent_minimal",
            request: "simple task",
        };
        const result = planner.plan(input);
        assert.equal(result.workflow.divisionId, "general_ops");
        assert.equal(result.executionSteps[0].divisionId, "general_ops");
    }
    finally {
        ctx.cleanup();
    }
});
test("WorkflowPlanner computes agent IDs from role IDs correctly", () => {
    const ctx = createIntegrationContext("aa-planner-agent-id-");
    try {
        const planner = new WorkflowPlanner();
        const input = {
            workflowId: "single_division_multi_step_orchestration",
            request: "multi-step task",
        };
        const result = planner.plan(input);
        const expectedAgentIds = [
            "agent_intake_router",
            "agent_general_executor",
            "agent_workflow_planner",
        ];
        const actualAgentIds = result.executionSteps.map((s) => s.agentId);
        assert.deepEqual(actualAgentIds, expectedAgentIds);
    }
    finally {
        ctx.cleanup();
    }
});
test("WorkflowPlanner applies correct timeout and retry values per step", () => {
    const ctx = createIntegrationContext("aa-planner-timeout-");
    try {
        const planner = new WorkflowPlanner();
        const input = {
            workflowId: "single_division_multi_step_orchestration",
            request: "test timeout values",
        };
        const result = planner.plan(input);
        const intakeTriage = result.executionSteps.find((s) => s.stepId === "intake_triage");
        assert.equal(intakeTriage.timeoutMs, 60_000);
        assert.equal(intakeTriage.maxAttempts, 1);
        const draftSolution = result.executionSteps.find((s) => s.stepId === "draft_solution");
        assert.equal(draftSolution.timeoutMs, 180_000);
        assert.equal(draftSolution.maxAttempts, 2);
        const finalReview = result.executionSteps.find((s) => s.stepId === "final_review");
        assert.equal(finalReview.timeoutMs, 90_000);
        assert.equal(finalReview.maxAttempts, 1);
    }
    finally {
        ctx.cleanup();
    }
});
test("WorkflowPlanner stores output schema path when defined", () => {
    const ctx = createIntegrationContext("aa-planner-schema-");
    try {
        const planner = new WorkflowPlanner();
        const input = {
            workflowId: "single_agent_minimal",
            request: "test schema path",
        };
        const result = planner.plan(input);
        assert.ok(result.executionSteps[0].outputSchemaPath, "Should have outputSchemaPath");
        assert.ok(result.executionSteps[0].outputSchemaPath.includes("minimal-output.json"));
    }
    finally {
        ctx.cleanup();
    }
});
test("WorkflowPlanner uses seeded database for task persistence", () => {
    const ctx = createSeededIntegrationContext("aa-planner-seeded-");
    try {
        const now = nowIso();
        const taskId = "task-planner-integration";
        const executionId = "exec-planner-integration";
        ctx.db.transaction(() => {
            ctx.store.insertTask({
                id: taskId,
                parentId: null,
                rootId: taskId,
                divisionId: "coding",
                tenantId: null,
                title: "Planner integration test",
                status: "in_progress",
                source: "user",
                priority: "normal",
                inputJson: JSON.stringify({ workflowId: "single_agent_minimal", request: "test" }),
                normalizedInputJson: "{}",
                outputJson: null,
                estimatedCostUsd: 0,
                actualCostUsd: 0,
                errorCode: null,
                createdAt: now,
                updatedAt: now,
                completedAt: null,
            });
            ctx.store.insertExecution({
                id: executionId,
                taskId,
                workflowId: "single_agent_minimal",
                parentExecutionId: null,
                agentId: "agent-1",
                roleId: "general_executor",
                runKind: "task_run",
                status: "executing",
                inputRef: null,
                traceId: `trace-${executionId}`,
                attempt: 1,
                timeoutMs: 120_000,
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
        });
        const execution = ctx.store.getExecution(executionId);
        assert.ok(execution, "Should retrieve execution from seeded store");
        assert.equal(execution.workflowId, "single_agent_minimal");
        assert.equal(execution.roleId, "general_executor");
        ctx.db.close();
    }
    finally {
        ctx.cleanup();
    }
});
test("WorkflowPlanner integration with seeded execution and task store", () => {
    const ctx = createSeededIntegrationContext("aa-planner-store-");
    try {
        const planner = new WorkflowPlanner();
        const result = planner.plan({
            workflowId: "single_agent_minimal",
            request: "integration test",
        });
        assert.equal(result.executionSteps.length, 1);
        assert.equal(result.executionSteps[0].roleId, "general_executor");
        const task = ctx.store.getTask(ctx.store.listTasks()[0].id);
        assert.ok(task, "Should be able to retrieve task from store");
        ctx.db.close();
    }
    finally {
        ctx.cleanup();
    }
});
//# sourceMappingURL=workflow-planner-integration.test.js.map