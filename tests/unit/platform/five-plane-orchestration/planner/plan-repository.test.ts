/**
 * Plan Repository Unit Tests
 */

import assert from "node:assert/strict";
import test from "node:test";

import { PlanRepository } from "../../../../../src/platform/five-plane-orchestration/planner/plan-repository.js";

function makePlan(overrides: Partial<{ planId: string; taskId: string; version: number }> = {}): {
  planId: string;
  taskId: string;
  version: number;
  steps: Array<{ stepId: string }>;
  createdAt: number;
} {
  return {
    planId: "plan-001",
    taskId: "task-001",
    version: 1,
    steps: [],
    createdAt: Date.now(),
    ...overrides,
  };
}

test("PlanRepository.save stores plan", () => {
  const repo = new PlanRepository();
  const plan = makePlan({ planId: "plan-save-1" });

  repo.save(plan);

  const list = repo.listByTask("task-001");
  assert.equal(list.length, 1);
  assert.equal(list[0].planId, "plan-save-1");
});

test("PlanRepository.save sorts plans by version ascending", () => {
  const repo = new PlanRepository();
  repo.save(makePlan({ planId: "v2", version: 2 }));
  repo.save(makePlan({ planId: "v1", version: 1 }));
  repo.save(makePlan({ planId: "v3", version: 3 }));

  const list = repo.listByTask("task-001");
  assert.equal(list[0].version, 1);
  assert.equal(list[1].version, 2);
  assert.equal(list[2].version, 3);
});

test("PlanRepository.listByTask returns empty array for unknown task", () => {
  const repo = new PlanRepository();
  const list = repo.listByTask("nonexistent-task");

  assert.equal(list.length, 0);
});

test("PlanRepository.listByTask returns copy of plans array", () => {
  const repo = new PlanRepository();
  repo.save(makePlan());

  const list1 = repo.listByTask("task-001");
  const list2 = repo.listByTask("task-001");

  assert.ok(list1 !== list2);
  assert.deepEqual(list1, list2);
});

test("PlanRepository.latest returns last plan by version", () => {
  const repo = new PlanRepository();
  repo.save(makePlan({ version: 1 }));
  repo.save(makePlan({ version: 2 }));
  repo.save(makePlan({ version: 3 }));

  const latest = repo.latest("task-001");

  assert.ok(latest !== null);
  assert.equal(latest.version, 3);
});

test("PlanRepository.latest returns null for unknown task", () => {
  const repo = new PlanRepository();
  const latest = repo.latest("nonexistent-task");

  assert.equal(latest, null);
});

test("PlanRepository.latest returns null for task with no plans", () => {
  const repo = new PlanRepository();
  repo.save(makePlan({ taskId: "task-001" }));

  const latest = repo.latest("task-002");

  assert.equal(latest, null);
});

test("PlanRepository.save handles multiple tasks independently", () => {
  const repo = new PlanRepository();
  repo.save(makePlan({ taskId: "task-A" }));
  repo.save(makePlan({ taskId: "task-B" }));
  repo.save(makePlan({ taskId: "task-A", version: 2 }));

  assert.equal(repo.listByTask("task-A").length, 2);
  assert.equal(repo.listByTask("task-B").length, 1);
});

test("R29-10: PlanRepository.save deduplicates same version", () => {
  const repo = new PlanRepository();
  const planV1a = makePlan({ planId: "v1a", taskId: "task-001", version: 1 });
  const planV1b = makePlan({ planId: "v1b", taskId: "task-001", version: 1 });

  repo.save(planV1a);
  repo.save(planV1b);

  const list = repo.listByTask("task-001");
  // Only one plan with version 1 should exist (first one saved)
  assert.equal(list.length, 1);
  assert.equal(list[0].planId, "v1a");
});

test("R29-10: PlanRepository.save allows same version on different tasks", () => {
  const repo = new PlanRepository();
  repo.save(makePlan({ planId: "v1-taskA", taskId: "task-A", version: 1 }));
  repo.save(makePlan({ planId: "v1-taskB", taskId: "task-B", version: 1 }));

  assert.equal(repo.listByTask("task-A").length, 1);
  assert.equal(repo.listByTask("task-B").length, 1);
});
