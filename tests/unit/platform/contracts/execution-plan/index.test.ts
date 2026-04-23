import assert from "node:assert/strict";
import test from "node:test";

import {
  createExecutionPlan,
  type ExecutionPlan,
  type ExecutionPlanStep,
} from "../../../../../src/platform/contracts/execution-plan/index.js";
import { ValidationError } from "../../../../../src/platform/contracts/errors.js";

test("createExecutionPlan generates a planId when not provided", () => {
  const plan = createExecutionPlan({
    taskId: "task-1",
    tenantId: "tenant-1",
    version: 1,
    steps: [
      { stepId: "step-1", title: "Step one", actionRef: "action.one", dependsOn: [], requiresApproval: false },
    ],
  });

  assert.ok(plan.planId.startsWith("plan_"));
  assert.equal(plan.taskId, "task-1");
  assert.equal(plan.tenantId, "tenant-1");
  assert.equal(plan.version, 1);
});

test("createExecutionPlan uses provided planId", () => {
  const plan = createExecutionPlan({
    planId: "custom-plan-id",
    taskId: "task-1",
    tenantId: null,
    version: 2,
    steps: [
      { stepId: "step-1", title: "Step one", actionRef: "action.one", dependsOn: [], requiresApproval: false },
    ],
  });

  assert.equal(plan.planId, "custom-plan-id");
});

test("createExecutionPlan sets createdAt to nowIso when not provided", () => {
  const plan = createExecutionPlan({
    taskId: "task-1",
    tenantId: "tenant-1",
    version: 1,
    steps: [
      { stepId: "step-1", title: "Step one", actionRef: "action.one", dependsOn: [], requiresApproval: false },
    ],
  });

  assert.ok(plan.createdAt.includes("T"));
});

test("createExecutionPlan uses provided createdAt timestamp", () => {
  const plan = createExecutionPlan({
    taskId: "task-1",
    tenantId: "tenant-1",
    version: 1,
    createdAt: "2026-01-01T00:00:00.000Z",
    steps: [
      { stepId: "step-1", title: "Step one", actionRef: "action.one", dependsOn: [], requiresApproval: false },
    ],
  });

  assert.equal(plan.createdAt, "2026-01-01T00:00:00.000Z");
});

test("createExecutionPlan throws when steps array is empty", () => {
  assert.throws(
    () =>
      createExecutionPlan({
        taskId: "task-1",
        tenantId: "tenant-1",
        version: 1,
        steps: [],
      }),
    ValidationError,
  );
});

test("createExecutionPlan throws when step has empty stepId", () => {
  assert.throws(
    () =>
      createExecutionPlan({
        taskId: "task-1",
        tenantId: "tenant-1",
        version: 1,
        steps: [
          { stepId: "", title: "Step one", actionRef: "action.one", dependsOn: [], requiresApproval: false },
        ],
      }),
    ValidationError,
  );
});

test("createExecutionPlan throws when step has empty actionRef", () => {
  assert.throws(
    () =>
      createExecutionPlan({
        taskId: "task-1",
        tenantId: "tenant-1",
        version: 1,
        steps: [
          { stepId: "step-1", title: "Step one", actionRef: "", dependsOn: [], requiresApproval: false },
        ],
      }),
    ValidationError,
  );
});

test("createExecutionPlan throws when step has empty title", () => {
  assert.throws(
    () =>
      createExecutionPlan({
        taskId: "task-1",
        tenantId: "tenant-1",
        version: 1,
        steps: [
          { stepId: "step-1", title: "", actionRef: "action.one", dependsOn: [], requiresApproval: false },
        ],
      }),
    ValidationError,
  );
});

test("createExecutionPlan includes step details including dependsOn and requiresApproval", () => {
  const plan = createExecutionPlan({
    taskId: "task-1",
    tenantId: "tenant-1",
    version: 1,
    steps: [
      {
        stepId: "step-1",
        title: "Deploy",
        actionRef: "deploy.run",
        dependsOn: ["dep-step-1", "dep-step-2"],
        requiresApproval: true,
      },
    ],
  });

  assert.equal(plan.steps.length, 1);
  assert.equal(plan.steps[0]?.stepId, "step-1");
  assert.equal(plan.steps[0]?.actionRef, "deploy.run");
  assert.deepEqual(plan.steps[0]?.dependsOn, ["dep-step-1", "dep-step-2"]);
  assert.equal(plan.steps[0]?.requiresApproval, true);
});

test("createExecutionPlan allows null tenantId", () => {
  const plan = createExecutionPlan({
    taskId: "task-1",
    tenantId: null,
    version: 1,
    steps: [
      { stepId: "step-1", title: "Step one", actionRef: "action.one", dependsOn: [], requiresApproval: false },
    ],
  });

  assert.equal(plan.tenantId, null);
});

test("ExecutionPlanStep interface accepts all required fields", () => {
  const step: ExecutionPlanStep = {
    stepId: "step-1",
    title: "Test step",
    actionRef: "test.action",
    dependsOn: ["prev-step"],
    requiresApproval: false,
  };

  assert.equal(step.stepId, "step-1");
  assert.equal(step.title, "Test step");
  assert.equal(step.actionRef, "test.action");
  assert.deepEqual(step.dependsOn, ["prev-step"]);
  assert.equal(step.requiresApproval, false);
});