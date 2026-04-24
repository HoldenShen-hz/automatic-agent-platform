import assert from "node:assert/strict";
import test from "node:test";

import { HarnessSdk } from "../../../src/sdk/harness-sdk/index.js";

test("HarnessSdk provides a stable facade over HarnessRuntimeService", () => {
  const sdk = new HarnessSdk();
  const run = sdk.createRun({
    taskId: "task_1",
    domainId: "legal",
    constraintPack: {
      policyIds: ["policy.audit"],
      approvalMode: "supervised",
      autonomyMode: "supervised",
      toolPolicy: { allowedTools: ["search", "compose"] },
      risk_policy: { maxRiskScore: 0.6, escalationThreshold: 0.4 },
      output_policy: { requiredEvidence: ["decision_log"], redactSensitiveData: true },
      budget: { maxSteps: 5, maxCost: 5, maxDurationMs: 60_000 },
    },
  });

  const runWithStep = sdk.appendStep(run, {
    role: "planner",
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

  assert.ok(run.runId.startsWith("harness_run_"));
  assert.equal(runWithStep.steps.length, 1);
  assert.equal(decision.action, "accept");
  assert.equal(reviewRequested.status, "waiting_hitl");
  assert.equal(reviewResolved.status, "running");
  assert.ok(timeline.length >= 3);
  assert.ok(evaluation != null);
  assert.deepEqual(sdk.assertInvariants(runWithStep).violations, []);
});
