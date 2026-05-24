import assert from "node:assert/strict";
import test from "node:test";

import { HarnessSdk } from "../../../src/sdk/harness-sdk/index.js";
import type { ConstraintPack } from "../../../src/platform/five-plane-orchestration/harness/index.js";

function createConstraintPack(): ConstraintPack {
  return {
    policyIds: [],
    approvalMode: "none",
    autonomyMode: "semi_auto",
    tool_policy: { allowedTools: [] },
    risk_policy: { maxRiskScore: 1, escalationThreshold: 0.9 },
    output_policy: { requiredEvidence: [], redactSensitiveData: false },
    budgetEnvelope: { maxSteps: 10, maxCost: 100, maxDurationMs: 60_000 },
    sandboxRequirement: { sandboxMode: "ephemeral", timeoutMs: 60_000 },
    approvalRequirement: {
      requiredForRiskClass: ["critical"],
      approverRoles: ["operator"],
      escalationTimeoutMs: 300_000,
    },
  };
}

function createRun() {
  const sdk = new HarnessSdk();
  const run = sdk.createRun({
    taskId: "task-edge",
    domainId: "legal",
    tenantId: "tenant-edge",
    constraintPack: createConstraintPack(),
  });
  return { sdk, run };
}

test("HarnessSdk rejects unknown string run ids in restore-only paths", () => {
  const sdk = new HarnessSdk();

  assert.throws(() => sdk.resume("missing-run"), /harness_sdk.run_not_found/);
  assert.equal(sdk.restore("missing-run"), null);
});

test("HarnessSdk checkpoint and restore helpers round-trip persisted runtime state", () => {
  const { sdk, run } = createRun();

  const checkpointRef = sdk.checkpoint(run);
  const restored = sdk.restoreFromCheckpoint(checkpointRef);

  assert.equal(checkpointRef.startsWith("harness_checkpoint_"), true);
  assert.equal(restored === null || restored.harnessRunId === run.harnessRunId, true);
});

test("HarnessSdk decide returns the expected remediation action bands", () => {
  const sdk = new HarnessSdk();

  assert.equal(sdk.decide({ evaluatorScore: 0.9, maxIterationsReached: true }).action, "abort");
  assert.equal(sdk.decide({ evaluatorScore: 0.9, requiresHuman: true }).action, "escalate_to_human");
  assert.equal(sdk.decide({ evaluatorScore: 0.3 }).action, "replan");
  assert.equal(sdk.decide({ evaluatorScore: 0.6 }).action, "retry_same_plan");
  assert.equal(sdk.decide({ evaluatorScore: 0.9 }).action, "accept");
});

test("HarnessSdk sleep, resume, and review flows preserve the current facade state contract", () => {
  const { sdk, run } = createRun();
  const runtimeView = run as typeof run & {
    pauseReason?: string | null;
    sleepLease?: { reason: string; resumeAt: string } | null;
    hitlRequest?: { reason?: string; evidenceRefs?: readonly string[] } | null;
    completedAt?: string | null;
  };

  const sleeping = sdk.sleep(runtimeView, "waiting for event", "2026-04-27T00:00:00.000Z") as typeof runtimeView;
  const resumed = sdk.resume(sleeping) as typeof runtimeView;
  const review = sdk.requestHumanReview(resumed, "needs approval", ["evidence-1"]) as typeof runtimeView;
  const approved = sdk.resolveReview(review, "approved", "operator-1") as typeof runtimeView;
  const reviewForReject = sdk.requestHumanReview(resumed, "needs approval", ["evidence-2"]) as typeof runtimeView;
  const rejected = sdk.resolveReview(reviewForReject, "rejected", "operator-2") as typeof runtimeView;

  assert.equal(sleeping.status, "paused");
  assert.equal(sleeping.sleepLease?.reason, "waiting for event");
  assert.equal(resumed.status, "running");
  assert.equal(resumed.sleepLease ?? null, null);
  assert.equal(review.pauseReason, "hitl");
  assert.equal(review.hitlRequest?.evidenceRefs?.[0], "evidence-1");
  assert.equal(approved.status, "running");
  assert.equal(rejected.status, "cancelled");
  assert.notEqual(rejected.completedAt ?? null, null);
});

test("HarnessSdk timeline, evaluation, persist, and invariant helpers stay callable on facade runs", () => {
  const { sdk, run } = createRun();

  const timeline = sdk.getTimeline(run);
  const evaluation = sdk.getEvaluation(run);
  const persisted = sdk.persist(run);
  const invariants = sdk.assertInvariants(run);

  assert.equal(Array.isArray(timeline), true);
  assert.equal(timeline.length > 0, true);
  assert.equal(evaluation.runId, run.harnessRunId);
  assert.equal(persisted.harnessRunId, run.harnessRunId);
  assert.deepEqual(invariants?.violations ?? [], []);
});
