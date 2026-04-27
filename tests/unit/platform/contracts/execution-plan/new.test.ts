import assert from "node:assert/strict";
import test from "node:test";

import {
  createExecutionPlan,
  type ExecutionPlan,
  type ExecutionPlanStep,
} from "../../../../../src/platform/contracts/execution-plan/index.js";
import { ValidationError } from "../../../../../src/platform/contracts/errors.js";

test("ExecutionPlanStep interface accepts valid step", () => {
  const step: ExecutionPlanStep = {
    stepId: "step_1",
    title: "First Step",
    actionRef: "action_execute",
    dependsOn: [],
    requiresApproval: false,
  };

  assert.equal(step.stepId, "step_1");
  assert.equal(step.actionRef, "action_execute");
});

test("ExecutionPlanStep with dependsOn references", () => {
  const step: ExecutionPlanStep = {
    stepId: "step_2",
    title: "Second Step",
    actionRef: "action_followup",
    dependsOn: ["step_1", "step_0"],
    requiresApproval: true,
  };

  assert.equal(step.dependsOn.length, 2);
  assert.ok(step.dependsOn.includes("step_1"));
});

test("createExecutionPlan builds valid execution plan", () => {
  const plan = createExecutionPlan({
    taskId: "task_123",
    tenantId: "tenant_abc",
    version: 1,
    steps: [
      {
        stepId: "step_1",
        title: "Initialize",
        actionRef: "init_action",
        dependsOn: [],
        requiresApproval: false,
      },
    ],
  });

  assert.equal(plan.taskId, "task_123");
  assert.equal(plan.tenantId, "tenant_abc");
  assert.ok(plan.planId.startsWith("plan_"));
  assert.ok(plan.createdAt.includes("T"));
});

test("createExecutionPlan generates planId when not provided", () => {
  const plan = createExecutionPlan({
    taskId: "task_123",
    tenantId: null,
    version: 1,
    steps: [
      {
        stepId: "step_1",
        title: "Test",
        actionRef: "test_action",
        dependsOn: [],
        requiresApproval: false,
      },
    ],
  });

  assert.ok(plan.planId.startsWith("plan_"));
});

test("createExecutionPlan uses provided planId", () => {
  const plan = createExecutionPlan({
    planId: "custom_plan_123",
    taskId: "task_123",
    tenantId: null,
    version: 1,
    steps: [
      {
        stepId: "step_1",
        title: "Test",
        actionRef: "test_action",
        dependsOn: [],
        requiresApproval: false,
      },
    ],
  });

  assert.equal(plan.planId, "custom_plan_123");
});

test("createExecutionPlan sets createdAt to nowIso when not provided", () => {
  const plan = createExecutionPlan({
    taskId: "task_123",
    tenantId: null,
    version: 1,
    steps: [
      {
        stepId: "step_1",
        title: "Test",
        actionRef: "test_action",
        dependsOn: [],
        requiresApproval: false,
      },
    ],
  });

  assert.ok(plan.createdAt.includes("T"));
});

test("createExecutionPlan uses provided createdAt timestamp", () => {
  const plan = createExecutionPlan({
    taskId: "task_123",
    tenantId: null,
    version: 1,
    steps: [
      {
        stepId: "step_1",
        title: "Test",
        actionRef: "test_action",
        dependsOn: [],
        requiresApproval: false,
      },
    ],
    createdAt: "2026-02-01T12:00:00.000Z",
  });

  assert.equal(plan.createdAt, "2026-02-01T12:00:00.000Z");
});

test("createExecutionPlan throws when steps array is empty", () => {
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

test("createExecutionPlan throws when step has empty stepId", () => {
  assert.throws(
    () =>
      createExecutionPlan({
        taskId: "task_123",
        tenantId: null,
        version: 1,
        steps: [
          {
            stepId: "",
            title: "Test",
            actionRef: "test_action",
            dependsOn: [],
            requiresApproval: false,
          },
        ],
      }),
    ValidationError,
  );
});

test("createExecutionPlan throws when step has whitespace-only stepId", () => {
  assert.throws(
    () =>
      createExecutionPlan({
        taskId: "task_123",
        tenantId: null,
        version: 1,
        steps: [
          {
            stepId: "   ",
            title: "Test",
            actionRef: "test_action",
            dependsOn: [],
            requiresApproval: false,
          },
        ],
      }),
    ValidationError,
  );
});

test("createExecutionPlan throws when step has empty actionRef", () => {
  assert.throws(
    () =>
      createExecutionPlan({
        taskId: "task_123",
        tenantId: null,
        version: 1,
        steps: [
          {
            stepId: "step_1",
            title: "Test",
            actionRef: "",
            dependsOn: [],
            requiresApproval: false,
          },
        ],
      }),
    ValidationError,
  );
});

test("createExecutionPlan throws when step has empty title", () => {
  assert.throws(
    () =>
      createExecutionPlan({
        taskId: "task_123",
        tenantId: null,
        version: 1,
        steps: [
          {
            stepId: "step_1",
            title: "",
            actionRef: "test_action",
            dependsOn: [],
            requiresApproval: false,
          },
        ],
      }),
    ValidationError,
  );
});

test("createExecutionPlan throws when step title is only whitespace", () => {
  assert.throws(
    () =>
      createExecutionPlan({
        taskId: "task_123",
        tenantId: null,
        version: 1,
        steps: [
          {
            stepId: "step_1",
            title: "   ",
            actionRef: "test_action",
            dependsOn: [],
            requiresApproval: false,
          },
        ],
      }),
    ValidationError,
  );
});

test("createExecutionPlan accepts multiple steps", () => {
  const plan = createExecutionPlan({
    taskId: "task_123",
    tenantId: null,
    version: 1,
    steps: [
      {
        stepId: "step_1",
        title: "Step One",
        actionRef: "action_1",
        dependsOn: [],
        requiresApproval: false,
      },
      {
        stepId: "step_2",
        title: "Step Two",
        actionRef: "action_2",
        dependsOn: ["step_1"],
        requiresApproval: true,
      },
      {
        stepId: "step_3",
        title: "Step Three",
        actionRef: "action_3",
        dependsOn: ["step_1", "step_2"],
        requiresApproval: false,
      },
    ],
  });

  assert.equal(plan.steps.length, 3);
  assert.equal(plan.steps[0]?.stepId, "step_1");
  assert.equal(plan.steps[1]?.requiresApproval, true);
});

test("createExecutionPlan copies steps to avoid mutation", () => {
  const originalSteps = [
    {
      stepId: "step_1",
      title: "Test",
      actionRef: "test_action",
      dependsOn: [] as string[],
      requiresApproval: false,
    },
  ];

  const plan = createExecutionPlan({
    taskId: "task_123",
    tenantId: null,
    version: 1,
    steps: originalSteps,
  });

  // Verify it's a copy
  originalSteps[0]!.stepId = "modified";
  assert.equal(plan.steps[0]!.stepId, "step_1");
});

test("createExecutionPlan copies dependsOn array", () => {
  const originalDependsOn = ["step_0", "step_prev"];
  const plan = createExecutionPlan({
    taskId: "task_123",
    tenantId: null,
    version: 1,
    steps: [
      {
        stepId: "step_1",
        title: "Test",
        actionRef: "test_action",
        dependsOn: originalDependsOn,
        requiresApproval: false,
      },
    ],
  });

  // Verify dependsOn is copied
  originalDependsOn.push("step_extra");
  assert.equal(plan.steps[0]!.dependsOn.length, 2);
  assert.ok(!plan.steps[0]!.dependsOn.includes("step_extra"));
});

test("ExecutionPlan interface accepts all fields", () => {
  const plan: ExecutionPlan = {
    planId: "plan_abc",
    taskId: "task_xyz",
    tenantId: "tenant_123",
    version: 5,
    steps: [
      {
        stepId: "step_a",
        title: "Final Step",
        actionRef: "final_action",
        dependsOn: ["step_b"],
        requiresApproval: true,
      },
    ],
    createdAt: "2026-03-15T00:00:00.000Z",
  };

  assert.equal(plan.planId, "plan_abc");
  assert.equal(plan.version, 5);
  assert.equal(plan.steps[0]?.dependsOn[0], "step_b");
});

test("createExecutionPlan allows null tenantId", () => {
  const plan = createExecutionPlan({
    taskId: "task_123",
    tenantId: null,
    version: 1,
    steps: [
      {
        stepId: "step_1",
        title: "Test",
        actionRef: "test_action",
        dependsOn: [],
        requiresApproval: false,
      },
    ],
  });

  assert.equal(plan.tenantId, null);
});

test("createExecutionPlan copies steps array to prevent mutation", () => {
  const steps = [
    {
      stepId: "step_1",
      title: "Original",
      actionRef: "action_1",
      dependsOn: [] as string[],
      requiresApproval: false,
    },
  ];

  const plan = createExecutionPlan({
    taskId: "task_123",
    tenantId: null,
    version: 1,
    steps,
  });

  // Mutate original array
  steps.push({
    stepId: "step_2",
    title: "Added later",
    actionRef: "action_2",
    dependsOn: [],
    requiresApproval: false,
  });

  // Plan should still have only original step
  assert.equal(plan.steps.length, 1);
});