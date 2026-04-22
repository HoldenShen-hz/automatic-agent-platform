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
    risk_policy: {
      maxRiskScore: 70,
      escalationThreshold: 55,
    },
    output_policy: {
      requiredEvidence: ["risk_profile"],
      redactSensitiveData: true,
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
  assert.equal(run.contextSnapshots.length, 1);
  assert.equal(run.steps[0]?.semanticPhase, "plan");
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

  assert.equal(run.status, "waiting_hitl");
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

test("HarnessRuntimeService supports sleep recover and resume lifecycle transitions", () => {
  const service = new HarnessRuntimeService();
  const created = service.createRun({
    taskId: "task-3",
    domainId: "finance-accounting",
    constraintPack: createConstraintPack(),
  });
  const sleeping = service.sleep(created, "awaiting_budget", "2026-04-23T00:00:00.000Z");
  const recovering = service.recover(sleeping);
  const resumed = service.resume(recovering);

  assert.equal(created.status, "created");
  assert.equal(sleeping.status, "sleeping");
  assert.equal(recovering.status, "recovering");
  assert.equal(resumed.status, "running");
  assert.equal(resumed.sleepLease, null);
});
