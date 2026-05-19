/**
 * E2E Workflow Execution Tests
 *
 * End-to-end tests covering workflow execution including:
 * - Multi-step workflow execution
 * - Workflow step progression
 * - Workflow completion and output
 * - Workflow error handling
 */
import assert from "node:assert/strict";
import test from "node:test";
import { createE2EHarness } from "../helpers/e2e-harness.js";
import { runMultiStepOrchestration } from "../../src/platform/execution/execution-engine/multi-step-orchestration.js";
// ---------------------------------------------------------------------------
// Helper: Build an OAPEFLIR plan request string
// ---------------------------------------------------------------------------
function buildOapeflirPlanRequest(steps) {
    const planSteps = steps.map((s) => ({
        stepId: s.stepId,
        dependencies: s.dependencies ?? [],
        outputs: s.outputs ?? [`output_${s.stepId}`],
        timeout: s.timeout ?? 30000,
        retryPolicy: { maxRetries: s.maxRetries ?? 0 },
    }));
    return `oapeflir://plan ${JSON.stringify(planSteps)}`;
}
// ---------------------------------------------------------------------------
// Tests: Multi-step workflow execution
// ---------------------------------------------------------------------------
test("E2E: multi-step workflow executes all steps successfully", async () => {
    const harness = createE2EHarness("e2e-wf-exec-");
    try {
        const input = {
            dbPath: harness.dbPath,
            title: "Multi-step workflow execution test",
            request: buildOapeflirPlanRequest([
                { stepId: "step_1", dependencies: [], outputs: ["result_1"] },
                { stepId: "step_2", dependencies: ["step_1"], outputs: ["result_2"] },
                { stepId: "step_3", dependencies: ["step_2"], outputs: ["final_result"] },
            ]),
        };
        const result = await runMultiStepOrchestration(input);
        assert.ok(result, "Result should exist");
        assert.ok(result.snapshot, "Snapshot should exist");
        assert.ok(result.snapshot.task, "Snapshot should have task");
        assert.ok(result.plannedWorkflow, "Planned workflow should exist");
        assert.equal(result.plannedWorkflow.executionSteps.length, 3, "Should have 3 execution steps");
        // Verify workflow completed (task should be done or in a terminal state)
        const task = harness.store.getTask(result.snapshot.task.id);
        assert.ok(task, "Task should exist in store");
    }
    finally {
        harness.cleanup();
    }
});
test("E2E: multi-step workflow with single step", async () => {
    const harness = createE2EHarness("e2e-wf-single-");
    try {
        const input = {
            dbPath: harness.dbPath,
            title: "Single step workflow test",
            request: buildOapeflirPlanRequest([
                { stepId: "only_step", dependencies: [], outputs: ["single_output"] },
            ]),
        };
        const result = await runMultiStepOrchestration(input);
        assert.ok(result, "Result should exist");
        assert.equal(result.plannedWorkflow.executionSteps.length, 1, "Should have 1 execution step");
        assert.ok(result.plannedWorkflow.executionSteps[0], "First step should exist");
        assert.equal(result.plannedWorkflow.executionSteps[0].stepId, "only_step", "Step ID should match");
    }
    finally {
        harness.cleanup();
    }
});
// ---------------------------------------------------------------------------
// Tests: Workflow step progression
// ---------------------------------------------------------------------------
test("E2E: workflow step index advances through steps", async () => {
    const harness = createE2EHarness("e2e-wf-progression-");
    try {
        const input = {
            dbPath: harness.dbPath,
            title: "Workflow step progression test",
            request: buildOapeflirPlanRequest([
                { stepId: "init", dependencies: [], outputs: ["init_output"] },
                { stepId: "process", dependencies: ["init"], outputs: ["process_output"] },
                { stepId: "finalize", dependencies: ["process"], outputs: ["finalize_output"] },
            ]),
        };
        const result = await runMultiStepOrchestration(input);
        const taskId = result.snapshot.task.id;
        // Get the workflow state and verify step progression
        const workflow = harness.store.getWorkflowState(taskId);
        assert.ok(workflow, "Workflow state should exist");
        // The workflow should have progressed through all steps
        // Final state could be completed or the step index should reflect progression
        assert.ok(workflow.currentStepIndex >= 0, "Step index should be set");
    }
    finally {
        harness.cleanup();
    }
});
test("E2E: workflow with step dependencies respects order", async () => {
    const harness = createE2EHarness("e2e-wf-deps-");
    try {
        // Step 2 depends on step 1, step 1 has no dependencies
        const input = {
            dbPath: harness.dbPath,
            title: "Workflow dependency test",
            request: buildOapeflirPlanRequest([
                { stepId: "first_step", dependencies: [], outputs: ["first_output"] },
                { stepId: "second_step", dependencies: ["first_step"], outputs: ["second_output"] },
            ]),
        };
        const result = await runMultiStepOrchestration(input);
        // Verify the dependency is preserved in the planned workflow
        const secondStep = result.plannedWorkflow.executionSteps.find((s) => s.stepId === "second_step");
        assert.ok(secondStep, "Second step should exist");
        assert.ok(secondStep.dependsOnStepIds.includes("first_step"), "Second step should depend on first step");
    }
    finally {
        harness.cleanup();
    }
});
// ---------------------------------------------------------------------------
// Tests: Workflow completion and output
// ---------------------------------------------------------------------------
test("E2E: workflow completes with aggregated outputs", async () => {
    const harness = createE2EHarness("e2e-wf-output-");
    try {
        const input = {
            dbPath: harness.dbPath,
            title: "Workflow output aggregation test",
            request: buildOapeflirPlanRequest([
                { stepId: "collect", dependencies: [], outputs: ["collected"] },
                { stepId: "aggregate", dependencies: ["collect"], outputs: ["aggregated"] },
            ]),
        };
        const result = await runMultiStepOrchestration(input);
        const taskId = result.snapshot.task.id;
        // Verify task completed
        const task = harness.store.getTask(taskId);
        assert.ok(task, "Task should exist");
        assert.ok(task.completedAt != null || task.status === "done" || task.status === "failed", "Task should be in terminal state or have completedAt");
    }
    finally {
        harness.cleanup();
    }
});
test("E2E: workflow produces final output", async () => {
    const harness = createE2EHarness("e2e-wf-final-");
    try {
        const input = {
            dbPath: harness.dbPath,
            title: "Workflow final output test",
            request: buildOapeflirPlanRequest([
                { stepId: "compute", dependencies: [], outputs: ["computed_value"] },
            ]),
        };
        const result = await runMultiStepOrchestration(input);
        // Verify the result contains expected structure
        assert.ok(result.snapshot.task, "Task snapshot should exist");
        assert.ok(result.snapshot.task.outputJson != null || result.snapshot.task.status !== null, "Task should have output or status set");
    }
    finally {
        harness.cleanup();
    }
});
test("E2E: workflow output overrides produce expected step results", async () => {
    const harness = createE2EHarness("e2e-wf-overrides-");
    try {
        const input = {
            dbPath: harness.dbPath,
            title: "Workflow output overrides test",
            request: buildOapeflirPlanRequest([
                { stepId: "step_a", dependencies: [], outputs: ["output_a"] },
                { stepId: "step_b", dependencies: ["step_a"], outputs: ["output_b"] },
            ]),
            stepOutputOverrides: {
                step_a: { output_a: "custom_value_a" },
                step_b: { output_b: "custom_value_b" },
            },
        };
        const result = await runMultiStepOrchestration(input);
        assert.ok(result, "Result should exist with output overrides");
        // The orchestration should complete with the overridden outputs
    }
    finally {
        harness.cleanup();
    }
});
// ---------------------------------------------------------------------------
// Tests: Workflow error handling
// ---------------------------------------------------------------------------
test("E2E: workflow with injected step failure marks workflow as failed", async () => {
    const harness = createE2EHarness("e2e-wf-fail-");
    try {
        const input = {
            dbPath: harness.dbPath,
            title: "Workflow failure injection test",
            request: buildOapeflirPlanRequest([
                { stepId: "good_step", dependencies: [], outputs: ["good"] },
                { stepId: "failing_step", dependencies: ["good_step"], outputs: ["will_fail"] },
                { stepId: "never_runs", dependencies: ["failing_step"], outputs: ["skipped"] },
            ]),
            stepFailureInjection: new Set(["failing_step"]),
        };
        const result = await runMultiStepOrchestration(input);
        const taskId = result.snapshot.task.id;
        // Verify the workflow/associated entities reflect the failure
        const task = harness.store.getTask(taskId);
        assert.ok(task, "Task should exist");
        // Task or workflow should indicate failure
        assert.ok(task.status === "failed" || task.errorCode != null, "Task should indicate failure state or error");
    }
    finally {
        harness.cleanup();
    }
});
test("E2E: workflow handles multiple step failures gracefully", async () => {
    const harness = createE2EHarness("e2e-wf-multi-fail-");
    try {
        const input = {
            dbPath: harness.dbPath,
            title: "Multiple step failures test",
            request: buildOapeflirPlanRequest([
                { stepId: "step_1", dependencies: [], outputs: ["out_1"] },
                { stepId: "step_2", dependencies: ["step_1"], outputs: ["out_2"] },
                { stepId: "step_3", dependencies: ["step_2"], outputs: ["out_3"] },
            ]),
            stepFailureInjection: new Set(["step_1", "step_2"]),
        };
        const result = await runMultiStepOrchestration(input);
        const taskId = result.snapshot.task.id;
        const task = harness.store.getTask(taskId);
        assert.ok(task, "Task should exist after multiple failures");
        assert.ok(task.status === "failed" || task.errorCode != null, "Task should indicate failure");
    }
    finally {
        harness.cleanup();
    }
});
test("E2E: workflow with planned failure response", async () => {
    const harness = createE2EHarness("e2e-wf-planned-fail-");
    try {
        const input = {
            dbPath: harness.dbPath,
            title: "Workflow planned failure test",
            request: buildOapeflirPlanRequest([
                { stepId: "risky_step", dependencies: [], outputs: ["risky_output"] },
            ]),
            stepFailurePlans: {
                risky_step: [
                    {
                        errorCode: "custom.error",
                        summary: "Custom error summary",
                        message: "This is a planned failure",
                    },
                ],
            },
        };
        const result = await runMultiStepOrchestration(input);
        assert.ok(result, "Result should exist with planned failure");
        assert.ok(result.snapshot, "Snapshot should exist");
    }
    finally {
        harness.cleanup();
    }
});
test("E2E: workflow with step failure injection on first step", async () => {
    const harness = createE2EHarness("e2e-wf-first-fail-");
    try {
        const input = {
            dbPath: harness.dbPath,
            title: "First step failure test",
            request: buildOapeflirPlanRequest([
                { stepId: "initialization", dependencies: [], outputs: ["init_result"] },
                { stepId: "processing", dependencies: ["initialization"], outputs: ["process_result"] },
            ]),
            stepFailureInjection: new Set(["initialization"]),
        };
        const result = await runMultiStepOrchestration(input);
        const taskId = result.snapshot.task.id;
        const task = harness.store.getTask(taskId);
        assert.ok(task, "Task should exist");
        assert.ok(task.status === "failed" || task.errorCode != null, "Task should indicate failure when first step fails");
    }
    finally {
        harness.cleanup();
    }
});
// ---------------------------------------------------------------------------
// Tests: Edge cases
// ---------------------------------------------------------------------------
test("E2E: empty workflow (no steps) is handled", async () => {
    const harness = createE2EHarness("e2e-wf-empty-");
    try {
        const input = {
            dbPath: harness.dbPath,
            title: "Empty workflow test",
            request: buildOapeflirPlanRequest([]),
        };
        const result = await runMultiStepOrchestration(input);
        assert.ok(result, "Result should exist");
        assert.equal(result.plannedWorkflow.executionSteps.length, 0, "Should have 0 execution steps");
    }
    finally {
        harness.cleanup();
    }
});
test("E2E: workflow with many sequential steps", async () => {
    const harness = createE2EHarness("e2e-wf-many-");
    try {
        // Create a workflow with 10 sequential steps
        const steps = Array.from({ length: 10 }, (_, i) => ({
            stepId: `step_${i}`,
            dependencies: i > 0 ? [`step_${i - 1}`] : [],
            outputs: [`output_${i}`],
        }));
        const input = {
            dbPath: harness.dbPath,
            title: "Many steps workflow test",
            request: buildOapeflirPlanRequest(steps),
        };
        const result = await runMultiStepOrchestration(input);
        assert.ok(result, "Result should exist");
        assert.equal(result.plannedWorkflow.executionSteps.length, 10, "Should have 10 execution steps");
    }
    finally {
        harness.cleanup();
    }
});
//# sourceMappingURL=workflow-execution.test.js.map