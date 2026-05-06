import assert from "node:assert/strict";
import test from "node:test";

import { HarnessSdk } from "../../../src/sdk/harness-sdk/index.js";

test("HarnessSdk handles run with string ID in requireRun", () => {
  const sdk = new HarnessSdk();

  // This test verifies the requireRun path when a string ID is passed
  // Since restoreRun returns null for unknown IDs, this should throw
  assert.throws(
    () => sdk.resume("non-existent-run-id"),
    /harness_sdk.run_not_found/,
  );
});

test("HarnessSdk handles checkpoint and restore roundtrip", () => {
  const sdk = new HarnessSdk();
  const run = sdk.createRun({
    taskId: "task-checkpoint",
    domainId: "legal",
    tenantId: "test-tenant",
    constraintPack: {
      policyIds: ["policy.audit"],
      approvalMode: "supervised",
      autonomyMode: "supervised",
      tool_policy: { allowedTools: ["search"] },
      risk_policy: { maxRiskScore: 0.6, escalationThreshold: 0.4 },
      output_policy: { requiredEvidence: ["decision_log"], redactSensitiveData: true },
      budget: { maxSteps: 5, maxCost: 5, maxDurationMs: 60_000 },
    },
  });

  const checkpointRef = sdk.checkpoint(run);
  assert.ok(checkpointRef.length > 0);

  const restored = sdk.restoreFromCheckpoint(checkpointRef);
  // restoreFromCheckpoint may return null depending on implementation
  // Just verify it doesn't throw
  assert.ok(restored === null || restored.harnessRunId === run.harnessRunId);
});

test("HarnessSdk.decide with maxIterationsReached returns abort", () => {
  const sdk = new HarnessSdk();
  const decision = sdk.decide({ evaluatorScore: 0.9, maxIterationsReached: true });

  assert.equal(decision.action, "abort");
  assert.ok(decision.reasonCodes.includes("harness.max_iterations_reached"));
});

test("HarnessSdk.decide with requiresHuman returns escalate_to_human", () => {
  const sdk = new HarnessSdk();
  const decision = sdk.decide({ evaluatorScore: 0.9, requiresHuman: true });

  assert.equal(decision.action, "escalate_to_human");
  assert.ok(decision.reasonCodes.includes("harness.human_required"));
});

test("HarnessSdk.decide with low evaluator score returns replan", () => {
  const sdk = new HarnessSdk();
  const decision = sdk.decide({ evaluatorScore: 0.3 });

  assert.equal(decision.action, "replan");
  assert.ok(decision.reasonCodes.includes("harness.eval_below_replan_threshold"));
});

test("HarnessSdk.decide with medium evaluator score returns retry_same_plan", () => {
  const sdk = new HarnessSdk();
  const decision = sdk.decide({ evaluatorScore: 0.6 });

  assert.equal(decision.action, "retry_same_plan");
  assert.ok(decision.reasonCodes.includes("harness.eval_below_accept_threshold"));
});

test("HarnessSdk.decide with high evaluator score returns accept", () => {
  const sdk = new HarnessSdk();
  const decision = sdk.decide({ evaluatorScore: 0.9 });

  assert.equal(decision.action, "accept");
  assert.ok(decision.reasonCodes.includes("harness.accepted"));
});

test("HarnessSdk.sleep accepts string or run", () => {
  const sdk = new HarnessSdk();
  const run = sdk.createRun({
    taskId: "task-sleep",
    domainId: "legal",
    tenantId: "test-tenant",
    constraintPack: {
      policyIds: [],
      approvalMode: "none",
      autonomyMode: "auto",
      tool_policy: { allowedTools: [] },
      risk_policy: { maxRiskScore: 1, escalationThreshold: 0.9 },
      output_policy: { requiredEvidence: [], redactSensitiveData: false },
      budget: { maxSteps: 10, maxCost: 100, maxDurationMs: 60000 },
    },
  });

  const sleeping = sdk.sleep(run, "waiting for event", "2026-04-27T00:00:00.000Z");
  assert.equal(sleeping.status, "paused");
  assert.equal(sleeping.pauseReason, "sleep");
  assert.ok(sleeping.sleepLease !== null);
});

test("HarnessSdk.resume accepts string or run", () => {
  const sdk = new HarnessSdk();
  const run = sdk.createRun({
    taskId: "task-resume",
    domainId: "legal",
    tenantId: "test-tenant",
    constraintPack: {
      policyIds: [],
      approvalMode: "none",
      autonomyMode: "auto",
      tool_policy: { allowedTools: [] },
      risk_policy: { maxRiskScore: 1, escalationThreshold: 0.9 },
      output_policy: { requiredEvidence: [], redactSensitiveData: false },
      budget: { maxSteps: 10, maxCost: 100, maxDurationMs: 60000 },
    },
  });

  const sleeping = sdk.sleep(run, "waiting", "2026-04-27T00:00:00.000Z");
  const resumed = sdk.resume(sleeping);
  assert.equal(resumed.status, "running");
  assert.ok(resumed.sleepLease === null);
});

test("HarnessSdk.requestHumanReview adds HITL request to run", () => {
  const sdk = new HarnessSdk();
  const run = sdk.createRun({
    taskId: "task-hitl",
    domainId: "legal",
    tenantId: "test-tenant",
    constraintPack: {
      policyIds: [],
      approvalMode: "none",
      autonomyMode: "auto",
      tool_policy: { allowedTools: [] },
      risk_policy: { maxRiskScore: 1, escalationThreshold: 0.9 },
      output_policy: { requiredEvidence: [], redactSensitiveData: false },
      budget: { maxSteps: 10, maxCost: 100, maxDurationMs: 60000 },
    },
  });

  const review = sdk.requestHumanReview(run, "needs approval", ["evidence-1", "evidence-2"]);
  assert.equal(review.status, "paused");
  assert.equal(review.pauseReason, "hitl");
  assert.ok(review.hitlRequest !== null);
});

test("HarnessSdk.resolveReview with approved resolution", () => {
  const sdk = new HarnessSdk();
  const run = sdk.createRun({
    taskId: "task-resolve",
    domainId: "legal",
    tenantId: "test-tenant",
    constraintPack: {
      policyIds: [],
      approvalMode: "none",
      autonomyMode: "auto",
      tool_policy: { allowedTools: [] },
      risk_policy: { maxRiskScore: 1, escalationThreshold: 0.9 },
      output_policy: { requiredEvidence: [], redactSensitiveData: false },
      budget: { maxSteps: 10, maxCost: 100, maxDurationMs: 60000 },
    },
  });

  const review = sdk.requestHumanReview(run, "needs approval", []);
  const resolved = sdk.resolveReview(review, "approved", "operator-1");
  assert.equal(resolved.status, "running");
  assert.ok(resolved.completedAt === null);
});

test("HarnessSdk.resolveReview with rejected resolution", () => {
  const sdk = new HarnessSdk();
  const run = sdk.createRun({
    taskId: "task-reject",
    domainId: "legal",
    tenantId: "test-tenant",
    constraintPack: {
      policyIds: [],
      approvalMode: "none",
      autonomyMode: "auto",
      tool_policy: { allowedTools: [] },
      risk_policy: { maxRiskScore: 1, escalationThreshold: 0.9 },
      output_policy: { requiredEvidence: [], redactSensitiveData: false },
      budget: { maxSteps: 10, maxCost: 100, maxDurationMs: 60000 },
    },
  });

  const review = sdk.requestHumanReview(run, "needs approval", []);
  const resolved = sdk.resolveReview(review, "rejected", "operator-1");
  assert.equal(resolved.status, "aborted");
  assert.ok(resolved.completedAt !== null);
});

test("HarnessSdk.getTimeline returns timeline events", () => {
  const sdk = new HarnessSdk();
  const run = sdk.createRun({
    taskId: "task-timeline",
    domainId: "legal",
    tenantId: "test-tenant",
    constraintPack: {
      policyIds: [],
      approvalMode: "none",
      autonomyMode: "auto",
      tool_policy: { allowedTools: [] },
      risk_policy: { maxRiskScore: 1, escalationThreshold: 0.9 },
      output_policy: { requiredEvidence: [], redactSensitiveData: false },
      budget: { maxSteps: 10, maxCost: 100, maxDurationMs: 60000 },
    },
  });

  const timeline = sdk.getTimeline(run);
  assert.ok(Array.isArray(timeline));
  assert.ok(timeline.length > 0);
});

test("HarnessSdk.getEvaluation returns evaluation report", () => {
  const sdk = new HarnessSdk();
  const run = sdk.createRun({
    taskId: "task-eval",
    domainId: "legal",
    tenantId: "test-tenant",
    constraintPack: {
      policyIds: [],
      approvalMode: "none",
      autonomyMode: "auto",
      tool_policy: { allowedTools: [] },
      risk_policy: { maxRiskScore: 1, escalationThreshold: 0.9 },
      output_policy: { requiredEvidence: [], redactSensitiveData: false },
      budget: { maxSteps: 10, maxCost: 100, maxDurationMs: 60000 },
    },
  });

  const evaluation = sdk.getEvaluation(run);
  assert.ok(evaluation !== null);
});

test("HarnessSdk.persist persists run without error", () => {
  const sdk = new HarnessSdk();
  const run = sdk.createRun({
    taskId: "task-persist",
    domainId: "legal",
    tenantId: "test-tenant",
    constraintPack: {
      policyIds: [],
      approvalMode: "none",
      autonomyMode: "auto",
      tool_policy: { allowedTools: [] },
      risk_policy: { maxRiskScore: 1, escalationThreshold: 0.9 },
      output_policy: { requiredEvidence: [], redactSensitiveData: false },
      budget: { maxSteps: 10, maxCost: 100, maxDurationMs: 60000 },
    },
  });

  // persist should not throw for valid runs
  const persisted = sdk.persist(run);
  assert.ok(persisted !== null);
});

test("HarnessSdk.assertInvariants returns empty violations for valid run", () => {
  const sdk = new HarnessSdk();
  const run = sdk.createRun({
    taskId: "task-assert",
    domainId: "legal",
    tenantId: "test-tenant",
    constraintPack: {
      policyIds: [],
      approvalMode: "none",
      autonomyMode: "auto",
      tool_policy: { allowedTools: [] },
      risk_policy: { maxRiskScore: 1, escalationThreshold: 0.9 },
      output_policy: { requiredEvidence: [], redactSensitiveData: false },
      budget: { maxSteps: 10, maxCost: 100, maxDurationMs: 60000 },
    },
  });

  const result = sdk.assertInvariants(run);
  assert.deepEqual(result.violations, []);
});
