import assert from "node:assert/strict";
import test from "node:test";

import { parseRolloutRecord } from "../../../../src/platform/five-plane-orchestration/oapeflir/types/rollout-record.js";
import { parseImprovementCandidate } from "../../../../src/platform/five-plane-orchestration/oapeflir/types/improvement-candidate.js";
import { RolloutStateMachine } from "../../../../src/platform/five-plane-orchestration/improve-rollout/rollout/rollout-state-machine.js";
import { ImprovementCandidateRegistry } from "../../../../src/platform/five-plane-orchestration/improve-rollout/improvement-candidate-registry.js";
import { PolicyRolloutService } from "../../../../src/platform/five-plane-orchestration/improve-rollout/policy-rollout-service.js";
import { CanaryTrafficRouter } from "../../../../src/platform/five-plane-orchestration/improve-rollout/canary-traffic-router.js";

test("parseRolloutRecord normalizes canonical rollout fields and aliases", () => {
  const record = parseRolloutRecord({
    recordId: "rollout_1",
    candidateId: "candidate_1",
    level: "stable_75",
    previousLevel: "partial_25",
    status: "stable_75",
    transitionedAt: Date.now(),
    approvedBy: "ops_lead",
    guardrailReasonCodes: ["rollout.metrics_gate_passed"],
    evidence: ["artifact_1"],
    triggeredBy: "human",
    metrics: {
      errorRate: 0.01,
      latencyP99: 320,
      successRate: 0.99,
      sampleCount: 120,
    },
  });

  assert.equal(record.fromLevel, "partial_25");
  assert.equal(record.toLevel, "stable_75");
  assert.equal(record.level, "stable_75");
  assert.equal(record.auditContext.approvedBy, "ops_lead");
  assert.deepEqual(record.auditContext.reasonCodes, ["rollout.metrics_gate_passed"]);
});

test("parseImprovementCandidate requires canonical learning object and rollout metadata", () => {
  const candidate = parseImprovementCandidate({
    candidateId: "candidate_1",
    taskId: "task_1",
    learningObjectId: "learning_1",
    source: "failure_pattern",
    targetScope: "platform",
    priority: "critical",
    rolloutLevel: "evaluate_0",
    metrics: {
      errorRate: 0,
      latencyP99: 0,
      successRate: 1,
      sampleCount: 0,
    },
    guardrails: [{
      guardrailId: "guardrail_1",
      description: "Needs approval",
      requiredLevel: "evaluate_0",
    }],
    sourceSignalRefs: ["signal_1"],
    sourceLearningObjectIds: ["learning_1"],
    changeScope: "policy",
    description: "Tighten planner policy",
    expectedBenefit: "Reduce repeated failure",
    status: "candidate_created",
    createdAt: "2026-05-09T00:00:00.000Z",
    updatedAt: "2026-05-09T00:00:00.000Z",
  });

  assert.equal(candidate.learningObjectId, "learning_1");
  assert.equal(candidate.targetScope, "platform");
  assert.equal(candidate.guardrails.length, 1);
});

test("ImprovementCandidateRegistry emits canonical candidate fields and LRU eviction", () => {
  const registry = new ImprovementCandidateRegistry(1);
  const learningObjects = [{
    learningObjectId: "learning_a",
    learningType: "failure_pattern",
    title: "Failure",
    summary: "Repeated failure",
    confidence: 0.9,
    evidenceRefs: ["artifact_1"],
    sourceSignalIds: ["signal_1"],
    recommendation: "Tighten policy",
    validatedBy: "evidence",
    promotionStatus: "validated",
    createdAt: "2026-05-09T00:00:00.000Z",
  }] as any;

  const first = registry.register({
    taskId: "task_1",
    target: "sandbox_policy",
    learningObjects,
    description: "first",
  });
  registry.register({
    taskId: "task_2",
    target: "routing_policy",
    learningObjects,
    description: "second",
  });

  assert.equal(first.targetScope, "platform");
  assert.equal(first.guardrails.length, 1);
  assert.equal(registry.list().length, 1);
});

test("RolloutStateMachine transitions approved candidate into evaluation_enabled and stable rollout levels", () => {
  const machine = new RolloutStateMachine();
  const candidate = parseImprovementCandidate({
    candidateId: "candidate_rollout",
    taskId: "task_rollout",
    learningObjectId: "learning_rollout",
    source: "failure_pattern",
    targetScope: "domain",
    priority: "high",
    rolloutLevel: "off",
    metrics: {
      errorRate: 0,
      latencyP99: 0,
      successRate: 1,
      sampleCount: 0,
    },
    guardrails: [],
    sourceSignalRefs: ["artifact_rollout"],
    sourceLearningObjectIds: ["learning_rollout"],
    changeScope: "policy",
    description: "rollout",
    expectedBenefit: "benefit",
    status: "approved",
    createdAt: "2026-05-09T00:00:00.000Z",
    updatedAt: "2026-05-09T00:00:00.000Z",
  });

  const evaluationRecord = machine.transition(candidate, "evaluate_0", {
    triggeredBy: "human",
  });
  const releasedRecord = machine.transition({
    ...candidate,
    status: "stable_100",
  }, "stable_100", {
    currentStatus: "stable_100",
  });

  assert.equal(evaluationRecord.status, "evaluation_enabled");
  assert.equal(evaluationRecord.toLevel, "evaluate_0");
  assert.equal(releasedRecord.status, "released");
  assert.equal(releasedRecord.toLevel, "stable_100");
});

test("PolicyRolloutService starts approved candidates at evaluate_0 and rejects unapproved promotion", () => {
  const service = new PolicyRolloutService();
  const strategyVersion = {
    strategyVersionId: "strategy_1",
    title: "Evaluate",
    sourceLearningObjectIds: ["learning_1"],
    releaseLevel: "evaluate_0" as const,
    createdAt: Date.now(),
  };
  const approvedCandidate = parseImprovementCandidate({
    candidateId: "candidate_policy",
    taskId: "task_policy",
    learningObjectId: "learning_1",
    source: "failure_pattern",
    targetScope: "domain",
    priority: "high",
    rolloutLevel: "off",
    metrics: { errorRate: 0, latencyP99: 0, successRate: 1, sampleCount: 0 },
    guardrails: [],
    sourceSignalRefs: ["artifact_1"],
    sourceLearningObjectIds: ["learning_1"],
    changeScope: "policy",
    description: "Approved candidate",
    expectedBenefit: "benefit",
    status: "approved",
    createdAt: "2026-05-09T00:00:00.000Z",
    updatedAt: "2026-05-09T00:00:00.000Z",
  });

  const started = service.start(approvedCandidate, strategyVersion, "reviewer_1");
  const blocked = service.decide({ ...approvedCandidate, status: "under_review" }, strategyVersion);

  assert.equal(started?.status, "evaluation_enabled");
  assert.equal(started?.triggeredBy, "human");
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.releaseLevel, "off");
});

test("CanaryTrafficRouter uses canonical rollout percentages", () => {
  const router = new CanaryTrafficRouter();

  assert.equal(router.getTrafficPercentage("evaluation_enabled"), 0);
  assert.equal(router.getTrafficPercentage("canary_5"), 5);
  assert.equal(router.getTrafficPercentage("stable_75"), 75);
  assert.equal(router.computeCanaryAllocation("released").stablePercentage, 100);
});
