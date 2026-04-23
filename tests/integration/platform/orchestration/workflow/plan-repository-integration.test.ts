/**
 * Integration Tests: Plan Repository
 *
 * Tests the PlanRepository which stores and retrieves plans
 * by task ID with version history.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { PlanRepository } from "../../../../../src/platform/orchestration/planner/plan-repository.js";
import type { Plan } from "../../../../../src/platform/orchestration/oapeflir/types/index.js";
import { newId } from "../../../../../src/platform/contracts/types/ids.js";

function createMockPlan(taskId: string, version: number): Plan {
  return {
    planId: newId("plan"),
    taskId,
    version,
    assessmentRef: "assessment-ref",
    strategy: "linear",
    steps: [
      {
        stepId: "step-1",
        action: "execute",
        title: "Test step",
        inputs: {},
        outputs: [],
        dependencies: [],
        status: "pending",
        timeout: 60000,
        retryPolicy: { maxRetries: 0, backoffMs: 250 },
      },
    ],
    createdAt: Date.now(),
  };
}

test("PlanRepository: saves and retrieves plan by task", () => {
  const repo = new PlanRepository();
  const taskId = newId("task");
  const plan = createMockPlan(taskId, 1);

  repo.save(plan);
  const plans = repo.listByTask(taskId);

  assert.equal(plans.length, 1);
  assert.equal(plans[0].version, 1);
});

test("PlanRepository: retrieves plans in version order", () => {
  const repo = new PlanRepository();
  const taskId = newId("task");

  repo.save(createMockPlan(taskId, 3));
  repo.save(createMockPlan(taskId, 1));
  repo.save(createMockPlan(taskId, 2));

  const plans = repo.listByTask(taskId);

  assert.equal(plans.length, 3);
  assert.equal(plans[0].version, 1);
  assert.equal(plans[1].version, 2);
  assert.equal(plans[2].version, 3);
});

test("PlanRepository: returns empty array for unknown task", () => {
  const repo = new PlanRepository();

  const plans = repo.listByTask("nonexistent-task");

  assert.deepEqual(plans, []);
});

test("PlanRepository: returns latest plan", () => {
  const repo = new PlanRepository();
  const taskId = newId("task");

  repo.save(createMockPlan(taskId, 1));
  repo.save(createMockPlan(taskId, 2));
  repo.save(createMockPlan(taskId, 3));

  const latest = repo.latest(taskId);

  assert.ok(latest);
  assert.equal(latest!.version, 3);
});

test("PlanRepository: returns null when no plans for task", () => {
  const repo = new PlanRepository();

  const latest = repo.latest("nonexistent-task");

  assert.equal(latest, null);
});

test("PlanRepository: multiple tasks maintain separate plans", () => {
  const repo = new PlanRepository();
  const taskId1 = newId("task");
  const taskId2 = newId("task");

  repo.save(createMockPlan(taskId1, 1));
  repo.save(createMockPlan(taskId2, 1));
  repo.save(createMockPlan(taskId2, 2));

  const plans1 = repo.listByTask(taskId1);
  const plans2 = repo.listByTask(taskId2);

  assert.equal(plans1.length, 1);
  assert.equal(plans2.length, 2);
});

test("PlanRepository: returns copy of plans list to prevent mutation", () => {
  const repo = new PlanRepository();
  const taskId = newId("task");
  const plan = createMockPlan(taskId, 1);

  repo.save(plan);
  const plans1 = repo.listByTask(taskId);
  plans1.push(createMockPlan(taskId, 99)); // Try to mutate
  const plans2 = repo.listByTask(taskId);

  assert.equal(plans2.length, 1);
  assert.equal(plans2[0].version, 1);
});
