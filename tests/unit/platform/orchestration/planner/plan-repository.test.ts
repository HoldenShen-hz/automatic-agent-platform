import test from "node:test";
import assert from "node:assert/strict";

import { PlanRepository } from "../../../../../src/platform/five-plane-orchestration/planner/plan-repository.js";

test("PlanRepository stores versioned plan history per task", () => {
  const repository = new PlanRepository();
  repository.save({
    planId: "plan_2",
    taskId: "task_1",
    assessmentRef: "assessment:task_1:2",
    version: 2,
    strategy: "reflexive",
    steps: [
      {
        stepId: "step_1",
        action: "execute",
        title: "execute",
        inputs: {},
        outputs: [],
        dependencies: [],
        status: "pending",
        timeout: 1000,
        retryPolicy: {
          maxRetries: 0,
          backoffMs: 0,
        },
      },
    ],
    createdAt: Date.now(),
  });
  repository.save({
    planId: "plan_1",
    taskId: "task_1",
    assessmentRef: "assessment:task_1:1",
    version: 1,
    strategy: "linear",
    steps: [
      {
        stepId: "step_1",
        action: "execute",
        title: "execute",
        inputs: {},
        outputs: [],
        dependencies: [],
        status: "pending",
        timeout: 1000,
        retryPolicy: {
          maxRetries: 0,
          backoffMs: 0,
        },
      },
    ],
    createdAt: Date.now(),
  });

  assert.deepEqual(repository.listByTask("task_1").map((item) => item.version), [1, 2]);
  assert.equal(repository.latest("task_1")?.planId, "plan_2");
});

test("PlanRepository returns null for unknown task", () => {
  const repository = new PlanRepository();
  assert.equal(repository.latest("unknown_task"), null);
  assert.deepEqual(repository.listByTask("unknown_task"), []);
});

test("PlanRepository stores multiple plans for different tasks", () => {
  const repository = new PlanRepository();
  repository.save({
    planId: "plan_a",
    taskId: "task_a",
    assessmentRef: "assessment:task_a:1",
    version: 1,
    strategy: "linear",
    steps: [],
    createdAt: Date.now(),
  });
  repository.save({
    planId: "plan_b",
    taskId: "task_b",
    assessmentRef: "assessment:task_b:1",
    version: 1,
    strategy: "reflexive",
    steps: [],
    createdAt: Date.now(),
  });

  assert.equal(repository.latest("task_a")?.planId, "plan_a");
  assert.equal(repository.latest("task_b")?.planId, "plan_b");
  assert.notEqual(repository.latest("task_a"), repository.latest("task_b"));
});

test("PlanRepository latest returns most recent version", () => {
  const repository = new PlanRepository();
  repository.save({
    planId: "plan_v1",
    taskId: "task_v",
    assessmentRef: "assessment:task_v:1",
    version: 1,
    strategy: "linear",
    steps: [],
    createdAt: Date.now() - 1000,
  });
  repository.save({
    planId: "plan_v3",
    taskId: "task_v",
    assessmentRef: "assessment:task_v:3",
    version: 3,
    strategy: "reflexive",
    steps: [],
    createdAt: Date.now(),
  });
  repository.save({
    planId: "plan_v2",
    taskId: "task_v",
    assessmentRef: "assessment:task_v:2",
    version: 2,
    strategy: "linear",
    steps: [],
    createdAt: Date.now() - 500,
  });

  const latest = repository.latest("task_v");
  assert.equal(latest?.version, 3);
  assert.equal(latest?.planId, "plan_v3");
});
