import assert from "node:assert/strict";
import test from "node:test";

import {
  PlanStrategySchema,
  PlanStepStatusSchema,
  PlanStepSchema,
  PlanSchema,
  type PlanStrategy,
  type PlanStepStatus,
  type PlanStep,
  type Plan,
  parsePlan,
} from "../../../../../../src/platform/orchestration/oapeflir/types/plan.js";
import { RetryPolicySchema } from "../../../../../../src/platform/orchestration/oapeflir/types/shared.js";

test("PlanStrategySchema accepts all valid values", () => {
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
  assert.equal(strategies.length, 8);
  for (const s of strategies) {
    assert.ok(PlanStrategySchema.parse(s));
  }
});

test("PlanStrategySchema rejects invalid values", () => {
  assert.throws(() => PlanStrategySchema.parse("invalid"));
  assert.throws(() => PlanStrategySchema.parse(""));
});

test("PlanStepStatusSchema accepts all valid values", () => {
  const statuses: PlanStepStatus[] = ["pending", "running", "done", "failed", "skipped"];
  assert.equal(statuses.length, 5);
  for (const s of statuses) {
    assert.ok(PlanStepStatusSchema.parse(s));
  }
});

test("PlanStepStatusSchema rejects invalid values", () => {
  assert.throws(() => PlanStepStatusSchema.parse("unknown"));
  assert.throws(() => PlanStepStatusSchema.parse(""));
});

test("PlanStepSchema parses valid step", () => {
  const step = PlanStepSchema.parse({
    stepId: "step1",
    action: "execute",
    title: "Test Step",
    inputs: { key: "value" },
    outputs: ["output1"],
    dependencies: [],
    status: "pending",
    timeout: 5000,
    retryPolicy: { maxRetries: 3, backoffMs: 1000 },
  });
  assert.equal(step.stepId, "step1");
  assert.equal(step.action, "execute");
  assert.equal(step.title, "Test Step");
  assert.equal(step.status, "pending");
  assert.equal(step.timeout, 5000);
});

test("PlanStepSchema with minimal fields", () => {
  const step = PlanStepSchema.parse({
    stepId: "minimal",
    action: "doSomething",
    timeout: 3000,
  });
  assert.equal(step.stepId, "minimal");
  assert.equal(step.action, "doSomething");
  assert.deepEqual(step.inputs, {});
  assert.deepEqual(step.dependencies, []);
  assert.equal(step.status, "pending");
});

test("PlanStepSchema requires stepId", () => {
  assert.throws(() => PlanStepSchema.parse({ action: "test", timeout: 1000 }));
});

test("PlanStepSchema requires action", () => {
  assert.throws(() => PlanStepSchema.parse({ stepId: "s1", timeout: 1000 }));
});

test("PlanStepSchema requires positive timeout", () => {
  assert.throws(() => PlanStepSchema.parse({ stepId: "s1", action: "test", timeout: 0 }));
  assert.throws(() => PlanStepSchema.parse({ stepId: "s1", action: "test", timeout: -1 }));
});

test("PlanStepSchema accepts default retry policy", () => {
  const step = PlanStepSchema.parse({
    stepId: "s1",
    action: "test",
    timeout: 1000,
  });
  assert.ok(step.retryPolicy);
});

test("PlanSchema parses valid plan", () => {
  const plan = PlanSchema.parse({
    planId: "plan-1",
    taskId: "task-1",
    version: 1,
    assessmentRef: "assessment-1",
    strategy: "linear",
    steps: [
      {
        stepId: "step1",
        action: "doSomething",
        timeout: 1000,
      },
    ],
    createdAt: Date.now(),
  });
  assert.equal(plan.planId, "plan-1");
  assert.equal(plan.taskId, "task-1");
  assert.equal(plan.strategy, "linear");
  assert.equal(plan.steps.length, 1);
});

test("PlanSchema requires at least one step", () => {
  assert.throws(() =>
    PlanSchema.parse({
      planId: "p1",
      taskId: "t1",
      version: 1,
      assessmentRef: "a1",
      strategy: "linear",
      steps: [],
      createdAt: Date.now(),
    }),
  );
});

test("PlanSchema accepts parentVersion", () => {
  const plan = PlanSchema.parse({
    planId: "plan-2",
    taskId: "task-2",
    version: 2,
    assessmentRef: "assessment-2",
    strategy: "replanned",
    steps: [{ stepId: "s1", action: "a1", timeout: 1000 }],
    createdAt: Date.now(),
    parentVersion: 1,
  });
  assert.equal(plan.parentVersion, 1);
});

test("PlanSchema without parentVersion", () => {
  const plan = PlanSchema.parse({
    planId: "plan-3",
    taskId: "task-3",
    version: 1,
    assessmentRef: "a1",
    strategy: "linear",
    steps: [{ stepId: "s1", action: "a1", timeout: 1000 }],
    createdAt: Date.now(),
  });
  assert.equal(plan.parentVersion, undefined);
});

test("parsePlan utility works", () => {
  const input = {
    planId: "plan-parse",
    taskId: "task-parse",
    version: 1,
    assessmentRef: "ar-1",
    strategy: "hierarchical",
    steps: [
      { stepId: "s1", action: "a1", timeout: 1000 },
      { stepId: "s2", action: "a2", timeout: 2000, dependencies: ["s1"] },
    ],
    createdAt: 1700000000000,
  };
  const plan = parsePlan(input);
  assert.equal(plan.planId, "plan-parse");
  assert.equal(plan.steps.length, 2);
});

test("parsePlan throws on invalid input", () => {
  assert.throws(() => parsePlan({}));
  assert.throws(() => parsePlan({ planId: "p1" }));
});

test("PlanStep outputs is optional", () => {
  const step = PlanStepSchema.parse({
    stepId: "no-outputs",
    action: "test",
    timeout: 1000,
  });
  assert.equal(step.outputs, undefined);
});

test("PlanStep title is optional", () => {
  const step = PlanStepSchema.parse({
    stepId: "no-title",
    action: "test",
    timeout: 1000,
  });
  assert.equal(step.title, undefined);
});

test("PlanStrategy enum count", () => {
  const values = PlanStrategySchema.options;
  assert.equal(values.length, 8);
});

test("PlanStepStatus enum count", () => {
  const values = PlanStepStatusSchema.options;
  assert.equal(values.length, 5);
});

test("Plan with multiple steps", () => {
  const plan = PlanSchema.parse({
    planId: "multi-step-plan",
    taskId: "task-multi",
    version: 1,
    assessmentRef: "ar-multi",
    strategy: "tree_branch",
    steps: [
      { stepId: "s1", action: "init", timeout: 5000 },
      { stepId: "s2", action: "process", timeout: 10000, dependencies: ["s1"] },
      { stepId: "s3", action: "branch_a", timeout: 8000, dependencies: ["s1"] },
      { stepId: "s4", action: "merge", timeout: 5000, dependencies: ["s2", "s3"] },
    ],
    createdAt: Date.now(),
  });
  assert.equal(plan.steps.length, 4);
  assert.equal(plan.steps[3]!.dependencies.length, 2);
});

test("PlanVersion must be positive integer", () => {
  assert.throws(() =>
    PlanSchema.parse({
      planId: "p1",
      taskId: "t1",
      version: 0,
      assessmentRef: "a1",
      strategy: "linear",
      steps: [{ stepId: "s1", action: "a1", timeout: 1000 }],
      createdAt: Date.now(),
    }),
  );
});

test("Plan createdAt must be non-negative integer", () => {
  assert.throws(() =>
    PlanSchema.parse({
      planId: "p1",
      taskId: "t1",
      version: 1,
      assessmentRef: "a1",
      strategy: "linear",
      steps: [{ stepId: "s1", action: "a1", timeout: 1000 }],
      createdAt: -1,
    }),
  );
});