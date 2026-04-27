/**
 * Execution Plan Contract Unit Tests
 *
 * Tests the execution plan creation and validation logic.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { createExecutionPlan } from "../../../../src/platform/contracts/execution-plan/index.js";
import { ValidationError } from "../../../../src/platform/contracts/errors.js";

test("execution-plan: createExecutionPlan generates valid plan with required fields", () => {
  const plan = createExecutionPlan({
    taskId: "task_123",
    tenantId: "tenant_abc",
    version: 1,
    steps: [
      {
        stepId: "step_1",
        title: "First step",
        actionRef: "action_one",
        dependsOn: [],
        requiresApproval: false,
      },
    ],
  });

  assert.equal(plan.taskId, "task_123");
  assert.equal(plan.tenantId, "tenant_abc");
  assert.equal(plan.version, 1);
  assert.equal(plan.steps.length, 1);
  assert.ok(plan.planId.startsWith("plan_"));
  assert.ok(plan.createdAt.length > 0);
});

test("execution-plan: createExecutionPlan throws when steps array is empty", () => {
  assert.throws(
    () =>
      createExecutionPlan({
        taskId: "task_123",
        tenantId: null,
        version: 1,
        steps: [],
      }),
    ValidationError,
  );
});

test("execution-plan: createExecutionPlan throws when step has empty stepId", () => {
  assert.throws(
    () =>
      createExecutionPlan({
        taskId: "task_123",
        tenantId: null,
        version: 1,
        steps: [
          {
            stepId: "   ",
            title: "First step",
            actionRef: "action_one",
            dependsOn: [],
            requiresApproval: false,
          },
        ],
      }),
    ValidationError,
  );
});

test("execution-plan: createExecutionPlan throws when step has empty actionRef", () => {
  assert.throws(
    () =>
      createExecutionPlan({
        taskId: "task_123",
        tenantId: null,
        version: 1,
        steps: [
          {
            stepId: "step_1",
            title: "First step",
            actionRef: "",
            dependsOn: [],
            requiresApproval: false,
          },
        ],
      }),
    ValidationError,
  );
});

test("execution-plan: createExecutionPlan throws when step has empty title", () => {
  assert.throws(
    () =>
      createExecutionPlan({
        taskId: "task_123",
        tenantId: null,
        version: 1,
        steps: [
          {
            stepId: "step_1",
            title: "  ",
            actionRef: "action_one",
            dependsOn: [],
            requiresApproval: false,
          },
        ],
      }),
    ValidationError,
  );
});

test("execution-plan: createExecutionPlan preserves step dependencies", () => {
  const plan = createExecutionPlan({
    taskId: "task_123",
    tenantId: null,
    version: 1,
    steps: [
      {
        stepId: "step_1",
        title: "First step",
        actionRef: "action_one",
        dependsOn: [],
        requiresApproval: false,
      },
      {
        stepId: "step_2",
        title: "Second step",
        actionRef: "action_two",
        dependsOn: ["step_1"],
        requiresApproval: false,
      },
    ],
  });

  assert.equal(plan.steps[1].dependsOn.length, 1);
  assert.equal(plan.steps[1].dependsOn[0], "step_1");
  // Ensure original array is not modified
  assert.ok(plan.steps[1].dependsOn !== plan.steps[0].dependsOn);
});

test("execution-plan: createExecutionPlan accepts optional planId and createdAt", () => {
  const plan = createExecutionPlan({
    taskId: "task_123",
    tenantId: null,
    version: 1,
    steps: [
      {
        stepId: "step_1",
        title: "First step",
        actionRef: "action_one",
        dependsOn: [],
        requiresApproval: false,
      },
    ],
    planId: "custom_plan_id",
    createdAt: "2026-01-01T00:00:00.000Z",
  });

  assert.equal(plan.planId, "custom_plan_id");
  assert.equal(plan.createdAt, "2026-01-01T00:00:00.000Z");
});
