import assert from "node:assert/strict";
import test from "node:test";

import {
  HarnessRuntimeService,
  normalizeConstraintPack,
  toCanonicalHarnessRun,
  type ConstraintPack,
} from "../../../../src/platform/five-plane-orchestration/harness/index.js";

function createConstraintPack(): ConstraintPack {
  return normalizeConstraintPack({
    policyIds: ["policy.default"],
    approvalMode: "none",
    autonomyMode: "semi_auto",
    tool_policy: { allowedTools: ["read", "apply_patch"] },
    risk_policy: { maxRiskScore: 0.8, escalationThreshold: 0.7 },
    output_policy: { requiredEvidence: [], redactSensitiveData: false },
    budgetEnvelope: { maxSteps: 6, maxCost: 10, maxDurationMs: 60_000 },
    sandboxRequirement: { sandboxMode: "ephemeral", timeoutMs: 60_000 },
    approvalRequirement: {
      requiredForRiskClass: [],
      approverRoles: [],
      escalationTimeoutMs: 60_000,
    },
  });
}

test("HarnessRuntimeService creates runs with initial timeline state", () => {
  const service = new HarnessRuntimeService();
  const run = service.createRun({
    taskId: "task-1",
    domainId: "coding",
    constraintPack: createConstraintPack(),
  });

  assert.equal(run.status, "created");
  assert.equal(run.steps.length, 0);
  assert.equal(service.listTimeline(run)[0]?.type, "run_created");
});

test("HarnessRuntimeService appends steps and captures snapshots", () => {
  const service = new HarnessRuntimeService();
  const run = service.createRun({
    taskId: "task-2",
    domainId: "coding",
    constraintPack: createConstraintPack(),
  });
  const updated = service.appendStep(run, {
    role: "planner",
    stage: "plan",
    inputs: { taskId: "task-2" },
    outputs: { planId: "plan-1" },
    nodeRunId: "node-run-1",
  });
  const snapshot = service.captureContextSnapshot(updated);

  assert.equal(updated.steps[0]?.semanticPhase, "plan");
  assert.deepEqual(updated.nodeRunIds, ["node-run-1"]);
  assert.equal(snapshot.stepCount, 1);
});

test("HarnessRuntimeService decides accept, replan, and abort paths", () => {
  const service = new HarnessRuntimeService();

  assert.equal(service.decide({ evaluatorScore: 0.95 }).action, "accept");
  assert.equal(service.decide({ evaluatorScore: 0.3 }).action, "replan");
  assert.equal(service.decide({ evaluatorScore: 0.95, budgetExhausted: true }).action, "abort");
});

test("HarnessRuntimeService loop persists previous planner output across replans", () => {
  const service = new HarnessRuntimeService();
  const plannerInputs: Array<Readonly<Record<string, unknown>> | null> = [];

  const run = service.runLoop({
    taskId: "task-loop",
    domainId: "coding",
    constraintPack: createConstraintPack(),
    loopServices: {
      plan(input) {
        plannerInputs.push(input.previousPlannerOutput);
        return { planId: `plan-${input.iteration}` };
      },
      generate(input) {
        return { planId: input.plannerOutput.planId, output: "artifact" };
      },
      evaluate(input) {
        return input.iteration === 1
          ? { score: 0.2, verdict: "replan" }
          : { score: 0.95, verdict: "accept" };
      },
    },
  });

  assert.equal(run.status, "completed");
  assert.equal(plannerInputs.length, 2);
  assert.equal(plannerInputs[0], null);
  assert.equal(plannerInputs[1]?.planId, "plan-1");
});

test("toCanonicalHarnessRun backfills contract defaults", () => {
  const service = new HarnessRuntimeService();
  const run = service.createRun({
    taskId: "task-canonical",
    domainId: "coding",
    constraintPack: createConstraintPack(),
  });
  const canonical = toCanonicalHarnessRun(run);

  assert.equal(canonical.harnessRunId, run.harnessRunId);
  assert.equal(canonical.traceId, `trace:${run.harnessRunId}`);
  assert.equal(canonical.fencingToken, `fence:${run.harnessRunId}:${run.currentSeq}`);
});
