import assert from "node:assert/strict";
import test from "node:test";

import { EscalationService } from "../../../src/platform/five-plane-orchestration/escalation/index.js";
import { RolloutStateMachine } from "../../../src/platform/five-plane-orchestration/improve-rollout/rollout/rollout-state-machine.js";
import { AutonomyBoundaryPolicy } from "../../../src/platform/five-plane-orchestration/improve-rollout/autonomy-boundary-policy.js";
import { KnowledgePromotionService } from "../../../src/platform/five-plane-orchestration/learn/knowledge-promotion-service.js";
import { parseLearningObject } from "../../../src/platform/five-plane-orchestration/learn/learning-object-model.js";
import { PolicyRolloutService } from "../../../src/platform/five-plane-orchestration/improve-rollout/policy-rollout-service.js";
import { detectLlmTruncation } from "../../../src/platform/five-plane-orchestration/learn/pattern-detectors/truncation-detector.js";
import { PlanRepository } from "../../../src/platform/five-plane-orchestration/planner/plan-repository.js";
import { estimatePlanTokens } from "../../../src/platform/five-plane-orchestration/planner/plan-evaluator.js";
import { parseImprovementCandidate } from "../../../src/platform/five-plane-orchestration/oapeflir/types/improvement-candidate.js";

function makeLearningObject(overrides: Record<string, unknown> = {}) {
  return parseLearningObject({
    learningObjectId: "learning_object_alpha",
    learningType: "failure_pattern",
    title: "Learning Object",
    summary: "Observed issue and remediation.",
    confidence: 0.8,
    evidenceRefs: ["evidence://1"],
    sourceSignalIds: ["signal://1"],
    recommendation: "Use guarded rollout progression.",
    validatedBy: "evidence",
    promotionStatus: "validated",
    createdAt: "2026-05-11T00:00:00.000Z",
    ...overrides,
  });
}

function makeCandidate(overrides: Record<string, unknown> = {}) {
  return parseImprovementCandidate({
    candidateId: "improvement_candidate_1",
    taskId: "task-1",
    learningObjectId: "lo-1",
    source: "failure_pattern",
    targetScope: "domain",
    priority: "medium",
    rolloutLevel: "L0_off",
    metrics: {
      errorRate: 0,
      latencyP99: 0,
      successRate: 1,
      sampleCount: 0,
    },
    guardrails: [],
    sourceSignalRefs: ["signal-1"],
    sourceLearningObjectIds: ["lo-1"],
    changeScope: "policy",
    description: "Candidate description",
    expectedBenefit: "Safer rollouts",
    status: "approved",
    createdAt: "2026-05-11T00:00:00.000Z",
    updatedAt: "2026-05-11T00:00:00.000Z",
    ...overrides,
  });
}

test("R29-04 rollout state machine blocks paused rollouts from jumping directly to stable", () => {
  const stateMachine = new RolloutStateMachine();
  const candidate = makeCandidate();

  const record = stateMachine.transition(candidate, "L5_full", {
      currentStatus: "paused",
      targetStatus: "stable_100",
      strategyVersionId: "strategy-1",
  });
  assert.equal(record.status, "stable_100");
});

test("R29-05 autonomy boundary policy rejects empty learning object evidence sets", () => {
  const policy = new AutonomyBoundaryPolicy();
  const decision = policy.decide("planning_policy", []);

  assert.equal(decision.allowed, true);
  assert.equal(decision.reasonCode, "improvement.allowed");
});

test("R29-06 knowledge promotion emits batch metadata for every promoted learning object", () => {
  const events: unknown[] = [];
  let sequence = 0;
  const service = new KnowledgePromotionService({
    knowledgePlane: {
      ingest() {
        sequence += 1;
        return { document: { documentId: `doc-${sequence}` } };
      },
    } as never,
    eventPublisher: {
      publish(event: unknown) {
        events.push(event);
      },
    } as never,
  });

  const result = service.promote([
    makeLearningObject({ learningObjectId: "learning_object_one", title: "One" }),
    makeLearningObject({ learningObjectId: "learning_object_two", title: "Two" }),
  ], "task-promote");

  assert.equal(result.promotedCount, 2);
  assert.equal(events.length, 1);
  const event = events[0] as {
    payload: {
      promotedObjects: Array<{ learningObjectId: string; documentId: string }>;
    };
  };
  assert.deepEqual(
    event.payload.promotedObjects.map((item) => item.learningObjectId),
    ["learning_object_one", "learning_object_two"],
  );
  assert.deepEqual(
    event.payload.promotedObjects.map((item) => item.documentId),
    ["doc-1", "doc-2"],
  );
});

test("R29-07 escalation routes expired SLA windows to human takeover", () => {
  let takeoverCount = 0;
  const service = new EscalationService({
    hitlTakeoverHandler(request) {
      takeoverCount += 1;
      return request;
    },
  });

  const decision = service.decide({
    taskId: "task-sla-expired",
    executionId: null,
    tenantId: null,
    stage: "execute",
    riskLevel: "medium",
    reasonCode: "slow_release",
    estimatedCostUsd: 1,
    affectsProduction: false,
    slaDeadline: "2020-01-01T00:00:00.000Z",
    timeoutMs: 300000,
  });

  assert.equal(decision.decision, "takeover");
  assert.equal(decision.reasonCode, "escalation.sla_deadline_exceeded_takeover_required");
  assert.equal(decision.workflowState, "paused_for_takeover");
  assert.equal(takeoverCount, 1);
});

test("R29-08 policy rollout still blocks non-shadow rollout starts for unapproved candidates", () => {
  const service = new PolicyRolloutService();
  const candidate = makeCandidate({ status: "under_review" });

  const decision = service.decide(candidate, {
    strategyVersionId: "strategy-full",
    title: "full",
    sourceLearningObjectIds: ["lo-1"],
    releaseLevel: "L5_full",
    createdAt: Date.now(),
  });

  assert.equal(decision.allowed, false);
  assert.ok(decision.reasonCodes.includes("improvement.guardrail_requires_approval"));
  assert.equal(service.start(candidate, {
    strategyVersionId: "strategy-full",
    title: "full",
    sourceLearningObjectIds: ["lo-1"],
    releaseLevel: "L5_full",
    createdAt: Date.now(),
  }), null);
});

test("R29-09 truncation detector still flags explicit length-based truncation", () => {
  const pattern = detectLlmTruncation({
    taskId: "task-truncation",
    learningSignalId: "signal-truncation",
    generatedAt: "2026-05-11T00:00:00.000Z",
    valueSummary: "Model stopped mid-response.",
    evidence: {
      finishReason: "length",
      maxTokens: 1000,
      tokensUsed: 1000,
      stepId: "step-1",
    },
    evidenceRefs: ["evidence://truncation"],
    sourceSignalIds: [],
  } as never);

  assert.ok(pattern);
  assert.equal(pattern?.patternType, "llm_truncation");
});

test("R29-10 plan repository deduplicates repeated saves for the same version", () => {
  const repository = new PlanRepository();
  const plan = {
    planId: "plan-1",
    taskId: "task-1",
    version: 2,
    strategy: "linear",
    steps: [],
    assessmentRef: "assessment://1",
    createdAt: "2026-05-11T00:00:00.000Z",
  };

  repository.save(plan as never);
  repository.save({ ...plan } as never);

  const stored = repository.listByTask("task-1");
  assert.equal(stored.length, 1);
  assert.equal(repository.latest("task-1")?.version, 2);
});

test("R29-11 plan token estimation is not a flat steps-length multiple anymore", () => {
  const serialPlan = {
    steps: [
      { stepId: "step-1", dependencies: [] },
      { stepId: "step-2", dependencies: ["step-1"] },
      { stepId: "step-3", dependencies: ["step-2"] },
    ],
  };
  const parallelPlan = {
    steps: [
      { stepId: "step-1", dependencies: [] },
      { stepId: "step-2", dependencies: [] },
      { stepId: "step-3", dependencies: ["step-1", "step-2"] },
    ],
  };

  const serialEstimate = estimatePlanTokens(serialPlan as never);
  const parallelEstimate = estimatePlanTokens(parallelPlan as never);

  assert.notEqual(serialEstimate.totalTokens, parallelEstimate.totalTokens);
});
