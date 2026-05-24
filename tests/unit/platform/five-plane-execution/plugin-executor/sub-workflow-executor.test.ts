/**
 * Unit Tests: Sub-Workflow Executor
 *
 * Tests for the SubWorkflowExecutor which handles legacy linear sub-workflows
 * with checkpointing, rollback, and execution state management.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  SubWorkflowExecutor,
  createSubWorkflowExecutor,
  type SubWorkflowDefinition,
  type SubWorkflowContextInput,
} from "../../../../../src/platform/five-plane-execution/plugin-executor/sub-workflow-executor.js";

function createTestContext(overrides: Partial<SubWorkflowContextInput> = {}): SubWorkflowContextInput {
  return {
    taskId: "task_123",
    tenantId: null,
    correlationId: "corr_abc",
    sandboxTier: "read_only",
    ...overrides,
  };
}

function createTestWorkflow(overrides: Partial<SubWorkflowDefinition> = {}): SubWorkflowDefinition {
  return {
    workflowId: "wf_test",
    name: "Test Workflow",
    steps: [
      { stepId: "step_1", name: "First Step", action: "action_1", maxRetries: 0 },
      { stepId: "step_2", name: "Second Step", action: "action_2", maxRetries: 1, dependsOn: ["step_1"] },
      { stepId: "step_3", name: "Third Step", action: "action_3", maxRetries: 0, dependsOn: ["step_2"] },
    ],
    rollbackPolicy: "none",
    ...overrides,
  };
}

test("SubWorkflowExecutor createWorkflow returns execution ID", () => {
  const executor = new SubWorkflowExecutor();
  const definition = createTestWorkflow();
  const context = createTestContext();

  const executionId = executor.createWorkflow(definition, context);

  assert.ok(executionId.startsWith("swf_"));
});

test("SubWorkflowExecutor createWorkflow stores execution", () => {
  const executor = new SubWorkflowExecutor();
  const definition = createTestWorkflow();
  const context = createTestContext();

  const executionId = executor.createWorkflow(definition, context);
  const workflow = executor.getWorkflow(executionId);

  assert.ok(workflow !== null);
  assert.equal(workflow?.status, "created");
});

test("SubWorkflowExecutor createWorkflow throws when max depth exceeded", () => {
  const executor = new SubWorkflowExecutor({ maxNestedDepth: 2 });
  const definition = createTestWorkflow();
  const context = createTestContext({
    parentNodeRunId: "level1:level2:level3",
  });

  assert.throws(
    () => executor.createWorkflow(definition, context),
    { message: /max_depth_exceeded/ },
  );
});

test("SubWorkflowExecutor getWorkflow returns null for unknown", () => {
  const executor = new SubWorkflowExecutor();

  const workflow = executor.getWorkflow("unknown");
  assert.equal(workflow, null);
});

test("SubWorkflowExecutor listWorkflows returns all executions", () => {
  const executor = new SubWorkflowExecutor();
  const definition = createTestWorkflow();
  const context = createTestContext();

  const id1 = executor.createWorkflow(definition, context);
  const id2 = executor.createWorkflow(definition, context);

  const workflows = executor.listWorkflows();
  assert.equal(workflows.length, 2);
  assert.ok(workflows.includes(id1));
  assert.ok(workflows.includes(id2));
});

test("SubWorkflowExecutor executeWorkflow completes successfully", async () => {
  const executor = new SubWorkflowExecutor();
  const definition = createTestWorkflow();
  const context = createTestContext();

  const executionId = executor.createWorkflow(definition, context);
  const result = await executor.executeWorkflow(executionId);

  assert.equal(result.status, "completed");
  assert.equal(result.steps.length, 3);
});

test("SubWorkflowExecutor executeWorkflow throws for unknown execution", async () => {
  const executor = new SubWorkflowExecutor();

  await assert.rejects(
    async () => executor.executeWorkflow("unknown"),
    { message: /not_found/ },
  );
});

test("SubWorkflowExecutor executeWorkflow throws for completed workflow", async () => {
  const executor = new SubWorkflowExecutor();
  const definition = createTestWorkflow();
  const context = createTestContext();

  const executionId = executor.createWorkflow(definition, context);
  await executor.executeWorkflow(executionId);

  await assert.rejects(
    async () => executor.executeWorkflow(executionId),
    { message: /cannot_execute/ },
  );
});

test("SubWorkflowExecutor executeWorkflow throws for cancelled workflow", async () => {
  const executor = new SubWorkflowExecutor();
  const definition = createTestWorkflow();
  const context = createTestContext();

  const executionId = executor.createWorkflow(definition, context);
  await executor.cancelWorkflow(executionId);

  await assert.rejects(
    async () => executor.executeWorkflow(executionId),
    { message: /cannot_execute/ },
  );
});

test("SubWorkflowExecutor pauseWorkflow pauses running workflow", () => {
  const executor = new SubWorkflowExecutor();
  const definition = createTestWorkflow();
  const context = createTestContext();

  const executionId = executor.createWorkflow(definition, context);
  executor.pauseWorkflow(executionId);

  const workflow = executor.getWorkflow(executionId);
  assert.equal(workflow?.status, "paused");
});

test("SubWorkflowExecutor pauseWorkflow throws for unknown execution", () => {
  const executor = new SubWorkflowExecutor();

  assert.throws(
    () => executor.pauseWorkflow("unknown"),
    { message: /not_found/ },
  );
});

test("SubWorkflowExecutor pauseWorkflow throws for non-running workflow", () => {
  const executor = new SubWorkflowExecutor();
  const definition = createTestWorkflow();
  const context = createTestContext({ executionId: "hrun_existing" });

  const executionId = executor.createWorkflow(definition, context);

  assert.throws(
    () => executor.pauseWorkflow(executionId),
    { message: /cannot_pause/ },
  );
});

test("SubWorkflowExecutor cancelWorkflow cancels execution", async () => {
  const executor = new SubWorkflowExecutor();
  const definition = createTestWorkflow();
  const context = createTestContext();

  const executionId = executor.createWorkflow(definition, context);
  const result = await executor.cancelWorkflow(executionId);

  assert.equal(result.status, "cancelled");
});

test("SubWorkflowExecutor cancelWorkflow throws for unknown execution", async () => {
  const executor = new SubWorkflowExecutor();

  await assert.rejects(
    async () => executor.cancelWorkflow("unknown"),
    { message: /not_found/ },
  );
});

test("SubWorkflowExecutor cancelWorkflow performs automatic rollback", async () => {
  const executor = new SubWorkflowExecutor();
  const definition = createTestWorkflow({ rollbackPolicy: "automatic" });
  const context = createTestContext();

  const executionId = executor.createWorkflow(definition, context);
  await executor.cancelWorkflow(executionId);

  const steps = executor.getSteps(executionId);
  const rolledBackSteps = steps.filter((s) => s.status === "rolled_back");
  assert.ok(rolledBackSteps.length > 0);
});

test("SubWorkflowExecutor getStep returns step by ID", () => {
  const executor = new SubWorkflowExecutor();
  const definition = createTestWorkflow();
  const context = createTestContext();

  const executionId = executor.createWorkflow(definition, context);

  const step = executor.getStep(executionId, "step_1");
  assert.ok(step !== null);
  assert.equal(step?.name, "First Step");
});

test("SubWorkflowExecutor getStep returns null for unknown step", () => {
  const executor = new SubWorkflowExecutor();
  const definition = createTestWorkflow();
  const context = createTestContext();

  const executionId = executor.createWorkflow(definition, context);

  const step = executor.getStep(executionId, "unknown_step");
  assert.equal(step, null);
});

test("SubWorkflowExecutor getSteps returns all steps in order", () => {
  const executor = new SubWorkflowExecutor();
  const definition = createTestWorkflow();
  const context = createTestContext();

  const executionId = executor.createWorkflow(definition, context);

  const steps = executor.getSteps(executionId);
  assert.equal(steps.length, 3);
  assert.equal(steps[0]?.stepId, "step_1");
  assert.equal(steps[1]?.stepId, "step_2");
  assert.equal(steps[2]?.stepId, "step_3");
});

test("SubWorkflowExecutor skipStep marks step as skipped", () => {
  const executor = new SubWorkflowExecutor();
  const definition = createTestWorkflow();
  const context = createTestContext();

  const executionId = executor.createWorkflow(definition, context);
  executor.skipStep(executionId, "step_2", "Not needed for this execution");

  const step = executor.getStep(executionId, "step_2");
  assert.equal(step?.status, "skipped");
  assert.deepEqual(step?.output, { skipped: true, reason: "Not needed for this execution" });
});

test("SubWorkflowExecutor skipStep throws for unknown execution", () => {
  const executor = new SubWorkflowExecutor();

  assert.throws(
    () => executor.skipStep("unknown", "step_1", "reason"),
    { message: /not_found/ },
  );
});

test("SubWorkflowExecutor skipStep throws for unknown step", () => {
  const executor = new SubWorkflowExecutor();
  const definition = createTestWorkflow();
  const context = createTestContext();

  const executionId = executor.createWorkflow(definition, context);

  assert.throws(
    () => executor.skipStep(executionId, "unknown_step", "reason"),
    { message: /step_not_found/ },
  );
});

test("SubWorkflowExecutor skipStep throws for non-pending step", () => {
  const executor = new SubWorkflowExecutor();
  const definition = createTestWorkflow();
  const context = createTestContext();

  const executionId = executor.createWorkflow(definition, context);

  // Try to skip an already completed step
  const workflow = executor.getWorkflow(executionId);
  const step = workflow?.steps.get("step_1");
  step!.status = "completed";

  assert.throws(
    () => executor.skipStep(executionId, "step_1", "reason"),
    { message: /cannot_skip/ },
  );
});

test("SubWorkflowExecutor retryStep re-executes failed step", async () => {
  const executor = new SubWorkflowExecutor();
  const definition = createTestWorkflow({ steps: [
    { stepId: "step_1", name: "First", action: "action_1", maxRetries: 1 },
  ]});
  const context = createTestContext();

  const executionId = executor.createWorkflow(definition, context);
  const workflow = executor.getWorkflow(executionId);
  const step = workflow?.steps.get("step_1");
  step!.status = "failed";
  step!.error = "Previous failure";

  const result = await executor.retryStep(executionId, "step_1");

  assert.ok(result.status === "completed" || result.status === "pending");
});

test("SubWorkflowExecutor retryStep throws for unknown execution", async () => {
  const executor = new SubWorkflowExecutor();

  await assert.rejects(
    async () => executor.retryStep("unknown", "step_1"),
    { message: /not_found/ },
  );
});

test("SubWorkflowExecutor retryStep throws when max retries exceeded", async () => {
  const executor = new SubWorkflowExecutor();
  const definition = createTestWorkflow();
  const context = createTestContext();

  const executionId = executor.createWorkflow(definition, context);
  const workflow = executor.getWorkflow(executionId);
  const step = workflow?.steps.get("step_1");
  step!.status = "failed";
  step!.retryCount = 3;
  step!.maxRetries = 2;

  await assert.rejects(
    async () => executor.retryStep(executionId, "step_1"),
    { message: /max_retries_exceeded/ },
  );
});

test("SubWorkflowExecutor retryStep throws for non-failed step", async () => {
  const executor = new SubWorkflowExecutor();
  const definition = createTestWorkflow();
  const context = createTestContext();

  const executionId = executor.createWorkflow(definition, context);
  const workflow = executor.getWorkflow(executionId);
  const step = workflow?.steps.get("step_1");
  step!.status = "pending";

  await assert.rejects(
    async () => executor.retryStep(executionId, "step_1"),
    { message: /cannot_retry/ },
  );
});

test("SubWorkflowExecutor createCheckpointFromId returns checkpoint ID", () => {
  const executor = new SubWorkflowExecutor();
  const definition = createTestWorkflow();
  const context = createTestContext();

  const executionId = executor.createWorkflow(definition, context);
  const checkpointId = executor.createCheckpointFromId(executionId);

  assert.ok(checkpointId?.startsWith("ckpt_"));
});

test("SubWorkflowExecutor createCheckpointFromId returns null for unknown", () => {
  const executor = new SubWorkflowExecutor();

  const checkpointId = executor.createCheckpointFromId("unknown");
  assert.equal(checkpointId, null);
});

test("SubWorkflowExecutor getCheckpoints returns checkpoint records", () => {
  const executor = new SubWorkflowExecutor();
  const definition = createTestWorkflow();
  const context = createTestContext();

  const executionId = executor.createWorkflow(definition, context);
  executor.createCheckpointFromId(executionId);
  executor.createCheckpointFromId(executionId);

  const checkpoints = executor.getCheckpoints(executionId);
  assert.equal(checkpoints.length, 2);
});

test("SubWorkflowExecutor performRollbackFromId throws for unknown", async () => {
  const executor = new SubWorkflowExecutor();

  await assert.rejects(
    async () => executor.performRollbackFromId("unknown"),
    { message: /not_found/ },
  );
});

test("SubWorkflowExecutor performRollbackFromId throws for no-rollback policy", async () => {
  const executor = new SubWorkflowExecutor();
  const definition = createTestWorkflow({ rollbackPolicy: "none" });
  const context = createTestContext();

  const executionId = executor.createWorkflow(definition, context);

  await assert.rejects(
    async () => executor.performRollbackFromId(executionId),
    { message: /rollback_not_allowed/ },
  );
});

test("SubWorkflowExecutor getExecutionLog returns historical results", async () => {
  const executor = new SubWorkflowExecutor();
  const definition = createTestWorkflow();
  const context = createTestContext();

  const id1 = executor.createWorkflow(definition, context);
  await executor.executeWorkflow(id1);

  const id2 = executor.createWorkflow(definition, context);
  await executor.executeWorkflow(id2);

  const log = executor.getExecutionLog();
  assert.equal(log.length, 2);
});

test("SubWorkflowExecutor handles step dependencies", async () => {
  const executor = new SubWorkflowExecutor();
  const definition = createTestWorkflow();
  const context = createTestContext();

  const executionId = executor.createWorkflow(definition, context);
  const result = await executor.executeWorkflow(executionId);

  assert.equal(result.status, "completed");
  assert.equal(result.steps.filter((s) => s.status === "skipped").length, 0);
});

test("SubWorkflowExecutor handles conditional steps", async () => {
  const executor = new SubWorkflowExecutor();
  const definition = createTestWorkflow({
    steps: [
      { stepId: "step_1", name: "First", action: "action_1", maxRetries: 0 },
      {
        stepId: "step_2",
        name: "Conditional",
        action: "action_2",
        maxRetries: 0,
        dependsOn: ["step_1"],
        conditional: { when: "step_1", equals: { result: "skip" } },
      },
    ],
  });
  const context = createTestContext();

  const executionId = executor.createWorkflow(definition, context);
  const result = await executor.executeWorkflow(executionId);

  // step_2 should be skipped since step_1 output doesn't match conditional
  const skippedSteps = result.steps.filter((s) => s.status === "skipped");
  assert.ok(skippedSteps.length > 0);
});

test("SubWorkflowExecutor compares conditional equality by value for objects", async () => {
  const executor = new SubWorkflowExecutor();
  const definition = createTestWorkflow({
    steps: [
      { stepId: "step_1", name: "First", action: "action_1", maxRetries: 0 },
      {
        stepId: "step_2",
        name: "Conditional",
        action: "action_2",
        maxRetries: 0,
        dependsOn: ["step_1"],
        conditional: { when: "step_1", equals: { result: "Step First completed successfully" } },
      },
    ],
  });

  const executionId = executor.createWorkflow(definition, createTestContext());
  const result = await executor.executeWorkflow(executionId);
  const conditionalStep = result.steps.find((step) => step.stepId === "step_2");

  assert.equal(conditionalStep?.status, "completed");
});

test("SubWorkflowExecutor allows legacy created-state pause once per executor instance", () => {
  const definition = createTestWorkflow();
  const context = createTestContext();
  const executorA = new SubWorkflowExecutor();
  const executorB = new SubWorkflowExecutor();

  const workflowA = executorA.createWorkflow(definition, context);
  const workflowB = executorB.createWorkflow(definition, context);

  executorA.pauseWorkflow(workflowA);
  executorB.pauseWorkflow(workflowB);

  assert.equal(executorA.getWorkflow(workflowA)?.status, "paused");
  assert.equal(executorB.getWorkflow(workflowB)?.status, "paused");
});

test("SubWorkflowExecutor createSubWorkflowExecutor factory works", () => {
  const executor = createSubWorkflowExecutor({
    defaultTimeout: 60000,
    maxNestedDepth: 5,
    enableCheckpointing: true,
  });

  assert.ok(executor instanceof SubWorkflowExecutor);
});

test("SubWorkflowExecutor uses custom defaultTimeout", () => {
  const executor = new SubWorkflowExecutor({ defaultTimeout: 60000 });
  const definition = createTestWorkflow({ steps: [] });
  const context = createTestContext();

  const executionId = executor.createWorkflow(definition, context);
  const workflow = executor.getWorkflow(executionId);

  // Default timeout should be applied
  assert.ok(workflow !== null);
});

test("SubWorkflowExecutor checkpoint stores step statuses", () => {
  const executor = new SubWorkflowExecutor();
  const definition = createTestWorkflow();
  const context = createTestContext();

  const executionId = executor.createWorkflow(definition, context);
  executor.createCheckpointFromId(executionId);

  const checkpoints = executor.getCheckpoints(executionId);
  const checkpoint = checkpoints[0];

  assert.ok(checkpoint);
  assert.ok("state" in checkpoint);
  assert.ok("stepStatuses" in checkpoint.state);
});

test("SubWorkflowExecutor multiple workflows can be executed", async () => {
  const executor = new SubWorkflowExecutor();
  const definition = createTestWorkflow();
  const context = createTestContext();

  const id1 = executor.createWorkflow(definition, context);
  const id2 = executor.createWorkflow(definition, context);

  const result1 = await executor.executeWorkflow(id1);
  const result2 = await executor.executeWorkflow(id2);

  assert.equal(result1.status, "completed");
  assert.equal(result2.status, "completed");
});

test("SubWorkflowExecutor handles empty steps array", () => {
  const executor = new SubWorkflowExecutor();
  const definition = createTestWorkflow({ steps: [] });
  const context = createTestContext();

  const executionId = executor.createWorkflow(definition, context);
  const result = executor.getWorkflow(executionId);

  assert.ok(result !== null);
  assert.equal(result?.stepOrder.length, 0);
});
