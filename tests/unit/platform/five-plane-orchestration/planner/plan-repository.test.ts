import assert from "node:assert/strict";
import test from "node:test";

import { PlanRepository } from "../../../../../src/platform/five-plane-orchestration/planner/plan-repository.js";
import type { Plan } from "../../../../../src/platform/five-plane-orchestration/oapeflir/types/index.js";

function createPlan(taskId: string, version: number, planId = `plan-${taskId}-${version}`): Plan {
  return {
    planId,
    taskId,
    version,
    assessmentRef: `assessment:${taskId}`,
    strategy: "linear",
    steps: [{
      stepId: "step-1",
      action: "read",
      title: "Read task",
      inputs: {},
      dependencies: [],
      status: "pending",
      timeout: 1_000,
      retryPolicy: { maxRetries: 0, backoffMs: 0 },
    }],
    createdAt: Date.now(),
  };
}

test("PlanRepository stores and sorts plans by version", () => {
  const repository = new PlanRepository();

  repository.save(createPlan("task-1", 2));
  repository.save(createPlan("task-1", 1));
  repository.save(createPlan("task-1", 3));

  assert.deepEqual(
    repository.listByTask("task-1").map((plan) => plan.version),
    [1, 2, 3],
  );
  assert.equal(repository.latest("task-1")?.version, 3);
});

test("PlanRepository isolates plans per task", () => {
  const repository = new PlanRepository();

  repository.save(createPlan("task-a", 1));
  repository.save(createPlan("task-b", 1));
  repository.save(createPlan("task-a", 2));

  assert.equal(repository.listByTask("task-a").length, 2);
  assert.equal(repository.listByTask("task-b").length, 1);
  assert.equal(repository.latest("task-missing"), null);
});

test("PlanRepository deduplicates identical task/version pairs", () => {
  const repository = new PlanRepository();

  repository.save(createPlan("task-1", 1, "plan-original"));
  repository.save(createPlan("task-1", 1, "plan-duplicate"));

  const plans = repository.listByTask("task-1");
  assert.equal(plans.length, 1);
  assert.equal(plans[0]?.planId, "plan-original");
});
