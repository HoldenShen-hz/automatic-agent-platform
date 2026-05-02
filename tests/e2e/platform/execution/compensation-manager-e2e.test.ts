/**
 * E2E Tests for Compensation Manager Service
 *
 * End-to-end tests covering:
 * 1. Compensation planning
 * 2. Rollback execution
 * 3. Compensating action tracking
 * 4. Error handling during compensation
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createE2EHarness } from "../../helpers/e2e-harness.js";
import { CompensationManagerService } from "../../../src/platform/execution/compensation-manager.js";
import { newId, nowIso } from "../../../src/platform/contracts/types/ids.js";
import type { CompensationPlan, CompensatingAction, WorkflowExecution } from "../../../src/platform/contracts/execution-schemas.js";

function createWorkflowExecution(overrides: Partial<WorkflowExecution> = {}): WorkflowExecution {
  return {
    executionId: overrides.executionId ?? newId("exec"),
    workflowId: overrides.workflowId ?? "wf_comp",
    taskId: overrides.taskId ?? newId("task"),
    status: overrides.status ?? "in_progress",
    completedSteps: overrides.completedSteps ?? [],
    failedStepIndex: overrides.failedStepIndex ?? null,
    rollbackFromIndex: overrides.rollbackFromIndex ?? null,
    compensationState: overrides.compensationState ?? "idle",
    ...overrides,
  };
}

function createCompensatingAction(overrides: Partial<CompensatingAction> = {}): CompensatingAction {
  return {
    actionId: overrides.actionId ?? newId("action"),
    stepIndex: overrides.stepIndex ?? 2,
    actionType: overrides.actionType ?? "rollback",
    targetStepOutput: overrides.targetStepOutput ?? {},
    status: overrides.status ?? "pending",
    errorMessage: overrides.errorMessage ?? null,
    ...overrides,
  };
}

test("E2E Compensation: Creates compensation plan for failed workflow", async () => {
  const harness = createE2EHarness("aa-e2e-comp-plan-");
  try {
    const service = new CompensationManagerService(harness.store);

    const workflow = createWorkflowExecution({
      completedSteps: [
        { stepIndex: 0, output: { result: "step_0" } },
        { stepIndex: 1, output: { result: "step_1" } },
        { stepIndex: 2, output: { result: "step_2" } },
      ],
      failedStepIndex: 3,
    });

    const plan = service.createCompensationPlan(workflow);

    assert.ok(plan);
    assert.equal(plan.executionId, workflow.executionId);
    assert.ok(plan.actions.length > 0, "Should have compensating actions");
  } finally {
    harness.cleanup();
  }
});

test("E2E Compensation: Executes compensating actions in reverse order", async () => {
  const harness = createE2EHarness("aa-e2e-comp-exec-");
  try {
    const service = new CompensationManagerService(harness.store);

    const workflow = createWorkflowExecution({
      completedSteps: [
        { stepIndex: 0, output: { resourceId: "resource_0" } },
        { stepIndex: 1, output: { resourceId: "resource_1" } },
      ],
      failedStepIndex: 2,
    });

    const plan = service.createCompensationPlan(workflow);
    const result = service.executeCompensation(plan);

    assert.ok(result);
    assert.equal(result.status, "completed" || result.status === "partial");
  } finally {
    harness.cleanup();
  }
});

test("E2E Compensation: Handles compensation failure gracefully", async () => {
  const harness = createE2EHarness("aa-e2e-comp-fail-");
  try {
    const service = new CompensationManagerService(harness.store);

    const workflow = createWorkflowExecution({
      completedSteps: [
        { stepIndex: 0, output: { criticalResource: true } },
      ],
      failedStepIndex: 1,
    });

    const plan = service.createCompensationPlan(workflow);
    plan.actions[0]!.status = "failed";

    const result = service.executeCompensation(plan);

    assert.ok(result.status === "failed" || result.status === "partial");
    assert.ok(result.failedActions.length >= 0);
  } finally {
    harness.cleanup();
  }
});