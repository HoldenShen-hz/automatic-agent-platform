import assert from "node:assert/strict";
import test from "node:test";

import { estimateMaxConcurrency } from "../../../../../src/platform/five-plane-orchestration/planner/plan-evaluator.js";
import type { Plan } from "../../../../../src/platform/five-plane-orchestration/oapeflir/types/index.js";

function createPlan(steps: Plan["steps"]): Plan {
  return {
    planId: "parallel-plan",
    taskId: "parallel-task",
    version: 1,
    assessmentRef: "assessment:parallel-task",
    strategy: "linear",
    steps,
    createdAt: Date.now(),
  };
}

test("estimateMaxConcurrency returns 1 for linear plans", () => {
  const concurrency = estimateMaxConcurrency(createPlan([
    {
      stepId: "step-1",
      action: "read",
      title: "Read",
      inputs: {},
      dependencies: [],
      status: "pending",
      timeout: 1_000,
      retryPolicy: { maxRetries: 0, backoffMs: 0 },
    },
    {
      stepId: "step-2",
      action: "write",
      title: "Write",
      inputs: {},
      dependencies: ["step-1"],
      status: "pending",
      timeout: 1_000,
      retryPolicy: { maxRetries: 0, backoffMs: 0 },
    },
  ]));

  assert.equal(concurrency, 1);
});

test("estimateMaxConcurrency returns parallel branch width", () => {
  const concurrency = estimateMaxConcurrency(createPlan([
    {
      stepId: "step-1",
      action: "read",
      title: "Read",
      inputs: {},
      dependencies: [],
      status: "pending",
      timeout: 1_000,
      retryPolicy: { maxRetries: 0, backoffMs: 0 },
    },
    {
      stepId: "step-2",
      action: "execute-a",
      title: "Execute A",
      inputs: {},
      dependencies: ["step-1"],
      status: "pending",
      timeout: 1_000,
      retryPolicy: { maxRetries: 0, backoffMs: 0 },
    },
    {
      stepId: "step-3",
      action: "execute-b",
      title: "Execute B",
      inputs: {},
      dependencies: ["step-1"],
      status: "pending",
      timeout: 1_000,
      retryPolicy: { maxRetries: 0, backoffMs: 0 },
    },
    {
      stepId: "step-4",
      action: "join",
      title: "Join",
      inputs: {},
      dependencies: ["step-2", "step-3"],
      status: "pending",
      timeout: 1_000,
      retryPolicy: { maxRetries: 0, backoffMs: 0 },
    },
  ]));

  assert.equal(concurrency, 2);
});

test("estimateMaxConcurrency returns all ready roots when no dependencies exist", () => {
  const concurrency = estimateMaxConcurrency(createPlan([
    {
      stepId: "step-1",
      action: "read",
      title: "Read A",
      inputs: {},
      dependencies: [],
      status: "pending",
      timeout: 1_000,
      retryPolicy: { maxRetries: 0, backoffMs: 0 },
    },
    {
      stepId: "step-2",
      action: "read",
      title: "Read B",
      inputs: {},
      dependencies: [],
      status: "pending",
      timeout: 1_000,
      retryPolicy: { maxRetries: 0, backoffMs: 0 },
    },
    {
      stepId: "step-3",
      action: "read",
      title: "Read C",
      inputs: {},
      dependencies: [],
      status: "pending",
      timeout: 1_000,
      retryPolicy: { maxRetries: 0, backoffMs: 0 },
    },
  ]));

  assert.equal(concurrency, 3);
});
