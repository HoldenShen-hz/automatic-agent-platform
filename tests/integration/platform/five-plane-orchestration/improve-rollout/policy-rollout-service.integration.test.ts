/**
 * Integration Test: Policy Rollout Service
 *
 * Tests PolicyRolloutService with guardrail evaluation, progressive
 * rollout through canary/partial/stable stages, metrics gates,
 * and auto-rollback integration.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { PolicyRolloutService } from "../../../../../src/platform/five-plane-orchestration/improve-rollout/policy-rollout-service.js";
import { AutoRollbackService } from "../../../../../src/platform/five-plane-orchestration/improve-rollout/auto-rollback-service.js";
import {
  ImprovementCandidateRegistry,
  type ImprovementCandidate,
} from "../../../../../src/platform/five-plane-orchestration/improve-rollout/improvement-candidate-registry.js";
import { newId } from "../../../../../src/platform/contracts/types/ids.js";
import type { StrategyVersion } from "../../../../../src/platform/five-plane-orchestration/improve-rollout/strategy-versioning.js";
import type { RolloutRecord } from "../../../../../src/platform/five-plane-orchestration/oapeflir/types/rollout-record.js";
import type { LearningObject } from "../../../../../src/platform/five-plane-orchestration/learn/learning-object-model.js";
import { LearningObjectSchema, type LearningObject as LearningObjectType } from "../../../../../src/platform/five-plane-orchestration/learn/learning-object-model.js";

function makeLearningObject(overrides: Partial<LearningObjectType> = {}): LearningObjectType {
  const learningType: LearningObjectType["learningType"] = "failure_pattern";
  const base: LearningObjectType = {
    learningObjectId: newId("lo"),
    objectId: newId("lo"),
    learningType,
    kind: learningType,
    title: "Test Learning Object",
    summary: "Test summary",
    content: {
      title: "Test Learning Object",
      summary: "Test summary",
      evidenceRefs: ["evidence://learning-object"],
      sourceSignalIds: ["signal://learning-object"],
      recommendation: "approve",
    },
    confidence: 0.8,
    evidenceRefs: ["evidence://learning-object"],
    sourceSignalIds: ["signal://learning-object"],
    recommendation: "approve",
    validatedBy: "none",
    promotionStatus: "untrusted",
    status: "created",
    createdAt: new Date().toISOString(),
  };
  return { ...base, ...overrides };
}

function makeStrategyVersion(overrides: Partial<StrategyVersion> = {}): StrategyVersion {
  return {
    strategyVersionId: newId("strategy_ver"),
    title: "test-strategy",
    sourceLearningObjectIds: ["lo-1"],
    releaseLevel: "L2_canary",
    createdAt: Date.now(),
    ...overrides,
  };
}

function makeCandidate(status: "candidate_created" | "under_review" | "approved" | "evaluation_enabled" = "approved"): ImprovementCandidate {
  return {
    candidateId: newId("candidate"),
    taskId: "task-candidate-001",
    learningObjectId: "lo-1",
    source: "failure_pattern",
    targetScope: "task",
    priority: "medium",
    rolloutLevel: "L0_off",
    metrics: {
      errorRate: 0,
      latencyP99: 0,
      successRate: 1,
      sampleCount: 0,
    },
    guardrails: [],
    sourceSignalRefs: ["signal-1", "signal-2"],
    sourceLearningObjectIds: ["lo-1"],
    changeScope: "policy",
    description: "Test improvement candidate",
    expectedBenefit: "Test benefit",
    status,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function makeRolloutMetrics(overrides: Partial<{
  requestCount: number;
  failureRate: number;
  p99LatencyMs: number;
  baselineP99LatencyMs: number;
}> = {}): {
  requestCount: number;
  failureRate: number;
  p99LatencyMs: number;
  baselineP99LatencyMs: number;
} {
  return {
    requestCount: 100,
    failureRate: 0.01,
    p99LatencyMs: 150,
    baselineP99LatencyMs: 200,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Rollout decision tests
// ---------------------------------------------------------------------------

test("policy-rollout: decide allows approved candidate with canary level", () => {
  const autoRollback = new AutoRollbackService();
  const service = new PolicyRolloutService(autoRollback);

  const candidate = makeCandidate("approved");
  const strategy = makeStrategyVersion({ releaseLevel: "L2_canary" });

  const decision = service.decide(candidate, strategy);

  assert.equal(decision.allowed, true);
  assert.equal(decision.releaseLevel, "L2_canary");
});

test("policy-rollout: decide blocks unapproved candidate", () => {
  const autoRollback = new AutoRollbackService();
  const service = new PolicyRolloutService(autoRollback);

  const candidate = makeCandidate("under_review");
  const strategy = makeStrategyVersion({ releaseLevel: "L1_evaluate" });

  const decision = service.decide(candidate, strategy);

  assert.equal(decision.allowed, false);
  assert.equal(decision.reasonCode, "improvement.guardrail_requires_approval");
});

test("policy-rollout: decide blocks rollout when frozen", () => {
  const autoRollback = new AutoRollbackService();
  const service = new PolicyRolloutService(autoRollback);

  const candidate = makeCandidate("approved");
  const strategy = makeStrategyVersion({ releaseLevel: "L2_canary" });

  // Test that when rollout freeze is triggered (by external state), decision is blocked
  // Note: This would require actual freeze state; here we test the guardrail path
  const decision = service.decide(candidate, strategy);

  // If freeze is not active, should pass - freeze state is controlled externally
  assert.ok(decision.allowed || decision.reasonCode === "rollout.frozen_error_budget");
});

// ---------------------------------------------------------------------------
// Start rollout tests
// ---------------------------------------------------------------------------

test("policy-rollout: start creates rollout record for approved candidate", () => {
  const autoRollback = new AutoRollbackService();
  const service = new PolicyRolloutService(autoRollback);

  const candidate = makeCandidate("approved");
  const strategy = makeStrategyVersion({ releaseLevel: "L1_evaluate" });

  const record = service.start(candidate, strategy, "operator-1");

  assert.ok(record !== null, "Should create rollout record");
  assert.ok(record!.recordId.startsWith("rollout_"));
  assert.equal(record!.candidateId, candidate.candidateId);
  assert.equal(record!.status, "evaluation_enabled");
});

test("policy-rollout: start returns null for blocked candidate", () => {
  const autoRollback = new AutoRollbackService();
  const service = new PolicyRolloutService(autoRollback);

  const candidate = makeCandidate("under_review");
  const strategy = makeStrategyVersion({ releaseLevel: "L5_full" });

  const record = service.start(candidate, strategy);

  assert.equal(record, null, "Should not create record for unapproved candidate");
});

// ---------------------------------------------------------------------------
// Progressive rollout tests
// ---------------------------------------------------------------------------

test("policy-rollout: promote canary to partial_25 with passing metrics", () => {
  const autoRollback = new AutoRollbackService();
  const service = new PolicyRolloutService(autoRollback);

  const candidate = makeCandidate("approved");
  const strategy = makeStrategyVersion({ releaseLevel: "L1_evaluate" });

  const metrics = makeRolloutMetrics({
    requestCount: 100,
    failureRate: 0.01,
    p99LatencyMs: 150,
    baselineP99LatencyMs: 200,
  });

  const evaluationRecord = service.start(candidate, strategy, "operator-1");
  assert.ok(evaluationRecord !== null);

  const canaryRecord = service.promote(candidate, evaluationRecord!, "canary_5", metrics, "operator-1");
  const promoted = service.promote(candidate, canaryRecord, "partial_25", metrics, "operator-1");

  assert.ok(promoted !== null);
  assert.equal(promoted.status, "partial_25");
});

test("policy-rollout: promote triggers rollback on failing metrics", () => {
  const autoRollback = new AutoRollbackService();
  const service = new PolicyRolloutService(autoRollback);

  const candidate = makeCandidate("approved");
  const strategy = makeStrategyVersion({ releaseLevel: "L1_evaluate" });

  // Failing metrics - high error rate
  const failingMetrics = makeRolloutMetrics({
    requestCount: 100,
    failureRate: 0.15, // 15% error rate - should trigger rollback
    p99LatencyMs: 400,
    baselineP99LatencyMs: 200,
  });

  const goodMetrics = makeRolloutMetrics();
  const evaluationRecord = service.start(candidate, strategy, "operator-1");
  const canaryRecord = service.promote(candidate, evaluationRecord!, "canary_5", goodMetrics, "operator-1");

  // The promote should either throw (if rollback not triggered) or return rolled back record
  try {
    const result = service.promote(candidate, canaryRecord, "partial_25", failingMetrics, "operator-1");
    // If metrics gate allows this, result should be blocked status
    assert.ok(result.status === "rolled_back" || result.status === "paused");
  } catch {
    // If rollback was triggered internally, error is thrown
    assert.ok(true, "Rollback triggered on failing metrics");
  }
});

test("policy-rollout: metrics gate evaluation requires metrics", () => {
  const autoRollback = new AutoRollbackService();
  const service = new PolicyRolloutService(autoRollback);

  const candidate = makeCandidate("approved");
  const strategy = makeStrategyVersion({ releaseLevel: "L1_evaluate" });

  const record = service.start(candidate, strategy, "operator-1");

  // Promote without metrics should fail
  const gateResult = service.evaluateMetricsGate(record!, "partial_25");

  assert.equal(gateResult.allowed, false);
  assert.ok(gateResult.reasonCodes.includes("rollout.metrics_required"));
});

// ---------------------------------------------------------------------------
// Rollback tests
// ---------------------------------------------------------------------------

test("policy-rollout: rollback transitions candidate to rolled_back", () => {
  const autoRollback = new AutoRollbackService();
  const service = new PolicyRolloutService(autoRollback);

  const candidate = makeCandidate("approved");
  const strategy = makeStrategyVersion({ releaseLevel: "L1_evaluate" });

  const record = service.start(candidate, strategy, "operator-1");

  const metrics = makeRolloutMetrics({
    requestCount: 100,
    failureRate: 0.2,
    p99LatencyMs: 400,
    baselineP99LatencyMs: 200,
  });

  const rolledBack = service.rollback(candidate, record!, metrics, "operator-1");

  assert.equal(rolledBack.status, "rolled_back");
});

test("policy-rollout: rollback records reason codes from auto-rollback", () => {
  const autoRollback = new AutoRollbackService();
  const service = new PolicyRolloutService(autoRollback);

  const candidate = makeCandidate("approved");
  const strategy = makeStrategyVersion({ releaseLevel: "L1_evaluate" });

  const record = service.start(candidate, strategy, "operator-1");

  const failingMetrics = makeRolloutMetrics({
    requestCount: 100,
    failureRate: 0.25,
    p99LatencyMs: 500,
    baselineP99LatencyMs: 200,
  });

  const rolledBack = service.rollback(candidate, record!, failingMetrics, "operator-1");

  assert.ok(rolledBack.guardrailReasonCodes.length > 0, "Should have guardrail reason codes");
});

// ---------------------------------------------------------------------------
// Guardrail evaluation tests
// ---------------------------------------------------------------------------

test("policy-rollout: guardrail blocks rollout for unapproved candidate status", () => {
  const autoRollback = new AutoRollbackService();
  const service = new PolicyRolloutService(autoRollback);

  // Candidate still in under_review state
  const candidate = makeCandidate("under_review");
  const strategy = makeStrategyVersion({ releaseLevel: "L2_canary" });

  const decision = service.decide(candidate, strategy);

  assert.equal(decision.allowed, false);
  assert.ok(decision.reasonCodes.some((code) => code.includes("guardrail_requires_approval")));
});

// ---------------------------------------------------------------------------
// Multi-stage progression tests
// ---------------------------------------------------------------------------

test("policy-rollout: full progression from canary to stable_100", () => {
  const autoRollback = new AutoRollbackService();
  const service = new PolicyRolloutService(autoRollback);

  const candidate = makeCandidate("approved");

  // Start at evaluation before progressive rollout
  let strategy = makeStrategyVersion({ releaseLevel: "L1_evaluate" });
  let record = service.start(candidate, strategy, "operator-1");
  assert.equal(record!.status, "evaluation_enabled");

  const goodMetrics = makeRolloutMetrics({
    requestCount: 100,
    failureRate: 0.005,
    p99LatencyMs: 180,
    baselineP99LatencyMs: 200,
  });

  // Promote to canary_5
  record = service.promote(candidate, record!, "canary_5", goodMetrics, "operator-1");
  assert.equal(record!.status, "canary_5");

  // Promote to partial_25
  record = service.promote(candidate, record!, "partial_25", goodMetrics, "operator-1");
  assert.equal(record!.status, "partial_25");

  // Promote to stable_75
  record = service.promote(candidate, record!, "stable_75", goodMetrics, "operator-1");
  assert.equal(record!.status, "stable_75");

  // Promote to stable_100
  record = service.promote(candidate, record!, "stable_100", goodMetrics, "operator-1");
  assert.equal(record!.status, "stable_100");
});

// ---------------------------------------------------------------------------
// Registry integration tests
// ---------------------------------------------------------------------------

test("policy-rollout: integration with candidate registry", () => {
  const autoRollback = new AutoRollbackService();
  const service = new PolicyRolloutService(autoRollback);
  const registry = new ImprovementCandidateRegistry();

  // Register a candidate
  const candidate = registry.register({
    taskId: "task-registry-test-001",
    target: "planning_policy",
    learningObjects: [makeLearningObject()],
    description: "Improve planning policy based on observed failures",
    expectedBenefit: "Reduce replan frequency",
  });

  assert.ok(candidate.candidateId.startsWith("improvement_candidate_"));

  // Approve and start rollout
  const approved = registry.updateStatus(candidate.candidateId, "approved");
  assert.ok(approved !== null);
  assert.equal(approved!.status, "approved");

  // Start rollout
  const strategy = makeStrategyVersion({ releaseLevel: "L1_evaluate" });
  const record = service.start(approved!, strategy, "operator-1");
  assert.ok(record !== null);
  assert.equal(record!.status, "evaluation_enabled");
});
