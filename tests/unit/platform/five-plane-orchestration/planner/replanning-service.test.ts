import assert from "node:assert/strict";
import test from "node:test";

import { ReplanningService } from "../../../../../src/platform/five-plane-orchestration/planner/replanning-service.js";
import type { FeedbackBatch } from "../../../../../src/scale-ecosystem/feedback-loop/collector/feedback-model.js";
import type { Plan } from "../../../../../src/platform/five-plane-orchestration/oapeflir/types/plan.js";

function makePlan(overrides: Partial<Plan> = {}): Plan {
  return {
    planId: overrides.planId ?? "plan-1",
    taskId: overrides.taskId ?? "task-1",
    version: overrides.version ?? 3,
    assessmentRef: overrides.assessmentRef ?? "assessment-1",
    strategy: overrides.strategy ?? "linear",
    steps: overrides.steps ?? [{
      stepId: "step-1",
      action: "execute",
      inputs: {},
      dependencies: [],
      status: "pending",
      timeout: 1_000,
      retryPolicy: { maxRetries: 0, backoffMs: 0 },
    }],
    createdAt: overrides.createdAt ?? 1_717_000_000_000,
  };
}

function makeFeedbackBatch(overrides: Partial<FeedbackBatch> = {}): FeedbackBatch {
  return {
    feedbackId: overrides.feedbackId ?? "feedback-1",
    taskId: overrides.taskId ?? "task-1",
    executionId: overrides.executionId ?? null,
    planId: overrides.planId ?? "plan-1",
    outcome: overrides.outcome ?? "completed",
    signals: overrides.signals ?? [],
    emittedAt: overrides.emittedAt ?? 1_717_000_000_000,
  };
}

test("ReplanningService creates triggers with stable metadata", () => {
  const service = new ReplanningService();

  const trigger = service.createTrigger("task-1", "planning.execution_deviation", "feedback", "execution drifted");

  assert.equal(trigger.taskId, "task-1");
  assert.equal(trigger.reasonCode, "planning.execution_deviation");
  assert.equal(trigger.source, "feedback");
});

test("ReplanningService keeps stable plans when no failure or correction is present", () => {
  const service = new ReplanningService();

  const decision = service.decide(makePlan(), makeFeedbackBatch({ outcome: "completed" }));

  assert.equal(decision.shouldReplan, false);
  assert.equal(decision.nextPlanVersion, null);
  assert.equal(decision.strategy, null);
});

test("ReplanningService triggers replans for failed, repairable, and correction feedback", () => {
  const service = new ReplanningService();
  const plan = makePlan();

  const failed = service.decide(plan, makeFeedbackBatch({ outcome: "failed" }));
  const repairable = service.decide(plan, makeFeedbackBatch({ outcome: "repairable" }));
  const correction = service.decide(plan, makeFeedbackBatch({
    signals: [{
      signalId: "signal-1",
      taskId: "task-1",
      source: "user",
      category: "correction",
      severity: "warning",
      payload: {},
      stepOutputRefs: [],
      timestamp: 1,
      trustFactors: {
        sourceReliability: 1,
        historicalAccuracy: 1,
        authenticatedSource: true,
        attackSurfaceExposure: 0,
        holdoutOverlap: 0,
      },
      feedbackTrustScore: 1,
    }],
  }));

  assert.equal(failed.shouldReplan, true);
  assert.equal(failed.nextPlanVersion, 4);
  assert.equal(repairable.reasonCode, "planning.execution_deviation");
  assert.equal(correction.reasonCode, "planning.downgrade_mode");
});

test("ReplanningService suppresses repeated correction loops after a replan", () => {
  const service = new ReplanningService();

  const decision = service.decide(
    { harnessRunId: "hrun-1", graphVersion: 7 },
    makeFeedbackBatch({
      signals: [{
        signalId: "signal-1",
        taskId: "task-1",
        source: "user",
        category: "correction",
        severity: "warning",
        payload: { reasonCode: "scope_too_broad" },
        stepOutputRefs: [],
        timestamp: 1,
        trustFactors: {
          sourceReliability: 1,
          historicalAccuracy: 1,
          authenticatedSource: true,
          attackSurfaceExposure: 0,
          holdoutOverlap: 0,
        },
        feedbackTrustScore: 1,
      }],
    }),
    null,
    true,
  );

  assert.equal(decision.shouldReplan, false);
  assert.equal(decision.taskId, "hrun-1");
});
