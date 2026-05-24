import assert from "node:assert/strict";
import test from "node:test";

import { HarnessRuntimeService, type ConstraintPack } from "../../../../../src/platform/five-plane-orchestration/harness/index.js";

function createConstraintPack(maxSteps = 30, maxCost = 100): ConstraintPack {
  return {
    policyIds: [],
    approvalMode: "none",
    autonomyMode: "supervised",
    tool_policy: { allowedTools: [] },
    risk_policy: { maxRiskScore: 100, escalationThreshold: 80 },
    output_policy: { requiredEvidence: [], redactSensitiveData: false },
    budgetEnvelope: { maxSteps, maxCost, maxDurationMs: 60000 },
    sandboxRequirement: { sandboxMode: "ephemeral", timeoutMs: 1000 },
    approvalRequirement: {
      requiredForRiskClass: ["critical"],
      approverRoles: ["operator"],
      escalationTimeoutMs: 1000,
    },
  };
}

test("HarnessRuntimeService.decide returns the expected actions across score bands", () => {
  const runtime = new HarnessRuntimeService();

  assert.equal(runtime.decide({ evaluatorScore: 0.9 }).action, "accept");
  assert.equal(runtime.decide({ evaluatorScore: 0.6 }).action, "retry_same_plan");
  assert.equal(runtime.decide({ evaluatorScore: 0.4 }).action, "replan");
  assert.equal(runtime.decide({ evaluatorScore: 0.9, requiresHuman: true }).action, "escalate_to_human");
  assert.equal(runtime.decide({ evaluatorScore: 0.9, maxIterationsReached: true }).action, "abort");
});

test("HarnessRuntimeService.assertInvariants accepts healthy runs", () => {
  const run = new HarnessRuntimeService().createRun({
    taskId: "task-1",
    domainId: "coding",
    constraintPack: createConstraintPack(),
  });

  const result = new HarnessRuntimeService().assertInvariants(run);
  assert.equal(result.violations.length, 0);
});

test("HarnessRuntimeService.assertInvariants reports budget and replan violations", () => {
  const runtime = new HarnessRuntimeService();
  const baseRun = runtime.createRun({
    taskId: "task-1",
    domainId: "coding",
    constraintPack: createConstraintPack(10, 50),
  });

  const overBudget = {
    ...baseRun,
    loopMetrics: {
      iterationCount: 15,
      replanCount: 5,
      totalCost: 100,
      durationMs: 1000,
      maxIterations: 10,
      maxCost: 50,
      maxDurationMs: 60000,
    },
  };

  const result = runtime.assertInvariants(overBudget);

  assert.ok(result.violations.includes("INV-1:harness.invariant.iteration_exceeds_budget"));
  assert.ok(result.violations.includes("INV-2:harness.invariant.replan_count_exceeds_budget"));
  assert.ok(result.violations.includes("INV-3:harness.invariant.total_cost_exceeds_budget"));
});
