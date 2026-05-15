import test from "node:test";
import assert from "node:assert/strict";

import {
  PlanSchema,
  PlanStepSchema,
  PlanStrategySchema,
  parsePlan,
  type Plan,
  type PlanStep,
  type PlanStrategy,
} from "../../../../../src/platform/five-plane-orchestration/oapeflir/types/plan.js";

test("PlanStrategySchema accepts all valid strategy values", () => {
  const strategies: PlanStrategy[] = [
    "linear",
    "hierarchical",
    "tree_branch",
    "reflexive",
    "goal_driven",
    "resource_constrained",
    "online",
    "replanned",
  ];
  for (const strategy of strategies) {
    const result = PlanStrategySchema.parse(strategy);
    assert.equal(result, strategy);
  }
});

test("PlanStrategySchema rejects invalid strategy values", () => {
  assert.throws(() => PlanStrategySchema.parse("invalid_strategy"));
  assert.throws(() => PlanStrategySchema.parse(""));
  assert.throws(() => PlanStrategySchema.parse("LINEAR"));
});

test("PlanStepSchema accepts valid step", () => {
  const step = {
    stepId: "step_1",
    action: "read",
    title: "Read file",
    inputs: { path: "/tmp/test" },
    outputs: ["content"],
    dependencies: [],
    status: "pending",
    timeout: 30000,
    retryPolicy: { maxRetries: 3, backoffMs: 500 },
  };
  const result = PlanStepSchema.parse(step);
  assert.equal(result.stepId, "step_1");
  assert.equal(result.action, "read");
  assert.equal(result.status, "pending");
});

test("PlanStepSchema applies default retryPolicy field", () => {
  const stepWithoutRetry = {
    stepId: "step_no_retry",
    action: "execute",
    timeout: 10000,
  };
  const result = PlanStepSchema.parse(stepWithoutRetry);
  assert.deepEqual(result.retryPolicy, { maxRetries: 0, backoffMs: 0 });
});

test("PlanStepSchema rejects step with empty stepId", () => {
  assert.throws(() => PlanStepSchema.parse({ stepId: "", action: "read", timeout: 1000, retryPolicy: { maxRetries: 0, backoffMs: 0 } }));
});

test("PlanStepSchema rejects step with empty action", () => {
  assert.throws(() => PlanStepSchema.parse({ stepId: "step_1", action: "", timeout: 1000, retryPolicy: { maxRetries: 0, backoffMs: 0 } }));
});

test("PlanStepSchema rejects negative timeout", () => {
  assert.throws(() => PlanStepSchema.parse({ stepId: "step_1", action: "read", timeout: -1, retryPolicy: { maxRetries: 0, backoffMs: 0 } }));
});

test("PlanStepSchema accepts all valid step statuses", () => {
  const statuses = ["pending", "running", "done", "failed", "skipped"] as const;
  for (const status of statuses) {
    const result = PlanStepSchema.parse({
      stepId: "step_test",
      action: "read",
      timeout: 1000,
      status,
      retryPolicy: { maxRetries: 0, backoffMs: 0 },
    });
    assert.equal(result.status, status);
  }
});

test("PlanSchema accepts valid plan", () => {
  const plan = {
    planId: "plan_abc123",
    taskId: "task_xyz",
    version: 1,
    assessmentRef: "assessment:task_xyz:1",
    strategy: "linear",
    steps: [
      {
        stepId: "step_1",
        action: "read",
        timeout: 5000,
        retryPolicy: { maxRetries: 0, backoffMs: 0 },
      },
    ],
    createdAt: Date.now(),
  };
  const result = PlanSchema.parse(plan);
  assert.equal(result.planId, "plan_abc123");
  assert.equal(result.taskId, "task_xyz");
  assert.equal(result.version, 1);
  assert.equal(result.strategy, "linear");
});

test("PlanSchema accepts plan with parentVersion", () => {
  const plan = {
    planId: "plan_v2",
    taskId: "task_replan",
    version: 2,
    assessmentRef: "assessment:task_replan:2",
    strategy: "replanned",
    steps: [
      { stepId: "step_1", action: "execute", timeout: 5000, retryPolicy: { maxRetries: 0, backoffMs: 0 } },
    ],
    createdAt: Date.now(),
    parentVersion: 1,
  };
  const result = PlanSchema.parse(plan);
  assert.equal(result.parentVersion, 1);
});

test("PlanSchema rejects plan with empty planId", () => {
  assert.throws(() =>
    PlanSchema.parse({
      planId: "",
      taskId: "task_1",
      version: 1,
      assessmentRef: "a",
      strategy: "linear",
      steps: [{ stepId: "s", action: "a", timeout: 1000, retryPolicy: { maxRetries: 0, backoffMs: 0 } }],
      createdAt: Date.now(),
    }),
  );
});

test("PlanSchema rejects plan with zero version", () => {
  assert.throws(() =>
    PlanSchema.parse({
      planId: "plan_1",
      taskId: "task_1",
      version: 0,
      assessmentRef: "a",
      strategy: "linear",
      steps: [{ stepId: "s", action: "a", timeout: 1000, retryPolicy: { maxRetries: 0, backoffMs: 0 } }],
      createdAt: Date.now(),
    }),
  );
});

test("PlanSchema requires at least one step", () => {
  assert.throws(() =>
    PlanSchema.parse({
      planId: "plan_1",
      taskId: "task_1",
      version: 1,
      assessmentRef: "a",
      strategy: "linear",
      steps: [],
      createdAt: Date.now(),
    }),
  );
});

test("parsePlan parses valid plan object", () => {
  const input = {
    planId: "plan_parsed",
    taskId: "task_parse",
    version: 3,
    assessmentRef: "assessment:task_parse:3",
    strategy: "tree_branch",
    steps: [
      {
        stepId: "step_a",
        action: "apply_patch",
        title: "Apply patch",
        timeout: 60000,
        retryPolicy: { maxRetries: 2, backoffMs: 1000 },
      },
      {
        stepId: "step_b",
        action: "validate_output",
        title: "Validate",
        timeout: 30000,
        dependencies: ["step_a"],
        retryPolicy: { maxRetries: 1, backoffMs: 500 },
      },
    ],
    createdAt: Date.now(),
    parentVersion: 2,
  };
  const result = parsePlan(input);
  assert.equal(result.planId, "plan_parsed");
  assert.equal(result.version, 3);
  assert.equal(result.parentVersion, 2);
  assert.equal(result.steps.length, 2);
  assert.equal(result.steps[1]!.dependencies[0], "step_a");
});

test("parsePlan throws on invalid plan", () => {
  assert.throws(() =>
    parsePlan({
      planId: "",
      taskId: "task_bad",
      version: 1,
      assessmentRef: "a",
      strategy: "linear",
      steps: [],
      createdAt: Date.now(),
    }),
  );
});

test("PlanStepSchema allows optional outputs field", () => {
  const withOutputs = {
    stepId: "step_out",
    action: "write",
    timeout: 5000,
    outputs: ["file_1", "file_2"],
    retryPolicy: { maxRetries: 0, backoffMs: 0 },
  };
  const result = PlanStepSchema.parse(withOutputs);
  assert.deepEqual(result.outputs, ["file_1", "file_2"]);
});

test("PlanStepSchema allows missing outputs field", () => {
  const withoutOutputs = {
    stepId: "step_no_out",
    action: "read",
    timeout: 5000,
    retryPolicy: { maxRetries: 0, backoffMs: 0 },
  };
  const result = PlanStepSchema.parse(withoutOutputs);
  assert.equal(result.outputs, undefined);
});

test("PlanStepSchema allows optional title field", () => {
  const withTitle = {
    stepId: "step_titled",
    action: "execute",
    title: "Execute task",
    timeout: 10000,
    retryPolicy: { maxRetries: 0, backoffMs: 0 },
  };
  const result = PlanStepSchema.parse(withTitle);
  assert.equal(result.title, "Execute task");
});

test("PlanSchema rejects invalid strategy in plan", () => {
  assert.throws(() =>
    PlanSchema.parse({
      planId: "plan_bad",
      taskId: "task_1",
      version: 1,
      assessmentRef: "a",
      strategy: "invalid",
      steps: [{ stepId: "s", action: "a", timeout: 1000, retryPolicy: { maxRetries: 0, backoffMs: 0 } }],
      createdAt: Date.now(),
    }),
  );
});

test("Plan types are exported correctly", () => {
  // Verify type exports are valid by checking schema inference
  const strategyType: PlanStrategy = "hierarchical";
  assert.equal(strategyType, "hierarchical");

  const step: PlanStep = {
    stepId: "typed_step",
    action: "read",
    inputs: {},
    dependencies: [],
    status: "done",
    timeout: 20000,
    retryPolicy: { maxRetries: 5, backoffMs: 200 },
  };
  assert.equal(step.stepId, "typed_step");
  assert.equal(step.status, "done");

  const plan: Plan = {
    planId: "typed_plan",
    taskId: "typed_task",
    version: 1,
    assessmentRef: "assessment:typed_task:1",
    strategy: "linear",
    steps: [step],
    createdAt: Date.now(),
  };
  assert.equal(plan.planId, "typed_plan");
  assert.equal(plan.strategy, "linear");
});
