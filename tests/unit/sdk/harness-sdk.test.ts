import assert from "node:assert/strict";
import test from "node:test";

import { HarnessSdk } from "../../../src/sdk/harness-sdk/index.js";
import type { ConstraintPack } from "../../../src/platform/five-plane-orchestration/harness/index.js";

function createConstraintPack(): ConstraintPack {
  return {
    policyIds: ["policy.audit"],
    approvalMode: "none",
    autonomyMode: "semi_auto",
    tool_policy: { allowedTools: ["search", "compose"] },
    risk_policy: { maxRiskScore: 0.6, escalationThreshold: 0.4 },
    output_policy: { requiredEvidence: ["decision_log"], redactSensitiveData: true },
    budgetEnvelope: { maxSteps: 5, maxCost: 5, maxDurationMs: 60_000 },
    sandboxRequirement: { sandboxMode: "ephemeral", timeoutMs: 60_000 },
    approvalRequirement: {
      requiredForRiskClass: ["high", "critical"],
      approverRoles: ["operator"],
      escalationTimeoutMs: 300_000,
    },
  };
}

test("HarnessSdk provides a stable facade over the current runtime contract", () => {
  const sdk = new HarnessSdk();
  const run = sdk.createRun({
    taskId: "task_1",
    domainId: "legal",
    tenantId: "tenant_1",
    constraintPack: createConstraintPack(),
  });
  const runtimeView = run as typeof run & {
    planGraphBundle: { graph: { graphId: string } };
  };

  const runWithStep = sdk.appendStep(run, {
    role: "planner",
    nodeRunId: "node_run_1",
    planGraphId: runtimeView.planGraphBundle.graph.graphId,
    stage: "plan",
    inputs: { prompt: "plan" },
    outputs: { plan: "ok" },
  });
  const decision = sdk.decide({ evaluatorScore: 0.9 });
  const sleeping = sdk.sleep(runWithStep, "wait_for_event", "2026-04-25T00:00:00.000Z");
  const resumed = sdk.resume(sleeping);
  const reviewRequested = sdk.requestHumanReview(resumed, "needs signoff", ["evidence_1"]);
  const reviewResolved = sdk.resolveReview(reviewRequested, "approved", "operator_1");
  const timeline = sdk.getTimeline(reviewResolved);
  const evaluation = sdk.getEvaluation(reviewResolved);

  assert.equal(run.harnessRunId.startsWith("harness_run_"), true);
  assert.equal(runWithStep.currentSeq, run.currentSeq);
  assert.equal(decision.action, "accept");
  assert.equal(sleeping.status, "paused");
  assert.equal(reviewRequested.status, "paused");
  assert.equal(reviewResolved.status, "running");
  assert.equal(timeline.length >= 3, true);
  assert.equal(evaluation.runId, run.harnessRunId);
  assert.deepEqual(sdk.assertInvariants(runWithStep)?.violations ?? [], []);
});

test("HarnessSdk enforces ISO timestamps for sleep requests", () => {
  const sdk = new HarnessSdk();
  const run = sdk.createRun({
    taskId: "task_2",
    domainId: "ops",
    tenantId: "tenant_2",
    constraintPack: createConstraintPack(),
  });

  assert.throws(
    () => sdk.sleep(run, "wait_for_event", "not-an-iso-timestamp"),
    /ISO-8601 timestamp/i,
  );
});
