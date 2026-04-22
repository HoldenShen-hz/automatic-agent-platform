import assert from "node:assert/strict";
import test from "node:test";

import { HarnessRuntimeService, type ConstraintPack } from "../../../../../src/platform/orchestration/harness/index.js";

function createConstraintPack(overrides: Partial<ConstraintPack> = {}): ConstraintPack {
  return {
    policyIds: ["policy.default"],
    approvalMode: "supervised",
    autonomyMode: "supervised",
    toolPolicy: {
      allowedTools: ["read", "summarize"],
    },
    budget: {
      maxSteps: 8,
      maxCost: 5,
      maxDurationMs: 60_000,
    },
    ...overrides,
  };
}

test("HarnessRuntimeService completes a planner-generator-evaluator loop", () => {
  const service = new HarnessRuntimeService();
  const run = service.runLoop({
    taskId: "task-1",
    domainId: "coding",
    constraintPack: createConstraintPack(),
    plannerOutput: { planId: "plan-1" },
    generatorOutput: { artifact: "patch.diff" },
    evaluatorOutput: { verdict: "pass" },
    evaluatorScore: 0.91,
  });

  assert.equal(run.steps.length, 3);
  assert.equal(run.status, "completed");
  assert.equal(run.decision?.action, "accept");
});

test("HarnessRuntimeService escalates to human when runtime requires HITL", () => {
  const service = new HarnessRuntimeService();
  const run = service.runLoop({
    taskId: "task-2",
    domainId: "legal",
    constraintPack: createConstraintPack(),
    plannerOutput: { planId: "plan-2" },
    generatorOutput: { artifact: "contract-review" },
    evaluatorOutput: { verdict: "needs-human" },
    evaluatorScore: 0.8,
    requiresHuman: true,
  });

  assert.equal(run.status, "paused");
  assert.equal(run.decision?.action, "escalate_to_human");
});

test("HarnessRuntimeService replans or aborts based on evaluator score and budget", () => {
  const service = new HarnessRuntimeService();
  const replanDecision = service.decide({
    evaluatorScore: 0.42,
    requiresHuman: false,
    maxIterationsReached: false,
  });
  const abortDecision = service.decide({
    evaluatorScore: 0.9,
    maxIterationsReached: true,
  });

  assert.equal(replanDecision.action, "replan");
  assert.equal(abortDecision.action, "abort");
});
