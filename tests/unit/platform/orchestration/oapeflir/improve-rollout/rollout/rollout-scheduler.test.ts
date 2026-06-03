import assert from "node:assert/strict";
import test from "node:test";

// RolloutScheduler tests
import { RolloutScheduler } from "../../../../../../../src/platform/five-plane-orchestration/oapeflir/improve-rollout/rollout/rollout-scheduler.js";
import { parseImprovementCandidate } from "../../../../../../../src/platform/five-plane-orchestration/oapeflir/types/improvement-candidate.js";
import { parseRolloutRecord } from "../../../../../../../src/platform/five-plane-orchestration/oapeflir/types/rollout-record.js";

test("RolloutScheduler can be instantiated", () => {
  const scheduler = new RolloutScheduler();
  assert.ok(scheduler !== undefined);
});

test("RolloutScheduler has required scheduling methods", () => {
  const scheduler = new RolloutScheduler();
  assert.equal(typeof scheduler.advance, "function");
  assert.equal(typeof scheduler.advanceMany, "function");
});

test("RolloutScheduler.advance is callable", () => {
  const scheduler = new RolloutScheduler();
  assert.doesNotThrow(async () => {
    await scheduler.advance({
      candidate: parseImprovementCandidate({
        candidateId: "candidate_1",
        taskId: "task_1",
        learningObjectId: "learning_1",
        source: "failure_pattern",
        targetScope: "platform",
        priority: "medium",
        rolloutLevel: "L1_evaluate",
        metrics: {
          errorRate: 0,
          latencyP99: 0,
          successRate: 1,
          sampleCount: 0,
        },
        guardrails: [],
        sourceSignalRefs: ["artifact:1"],
        sourceLearningObjectIds: ["learning_1"],
        changeScope: "policy",
        description: "Scheduler smoke candidate",
        expectedBenefit: "Ensure scheduler accepts current rollout shape",
        status: "approved",
        createdAt: new Date().toISOString(),
      }),
      record: parseRolloutRecord({
        recordId: "test_rollout_1",
        candidateId: "candidate_1",
        level: "shadow",
        previousLevel: "L0_off",
        strategyVersionId: "strategy_1",
        status: "shadow",
        transitionedAt: Date.now() - 120_000,
        guardrailReasonCodes: [],
        evidence: [],
      }),
    });
  });
});

test("RolloutScheduler.advanceMany is callable", () => {
  const scheduler = new RolloutScheduler();
  assert.doesNotThrow(async () => {
    await scheduler.advanceMany([]);
  });
});
