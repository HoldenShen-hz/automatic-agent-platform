import assert from "node:assert/strict";
import test from "node:test";

import { parseRolloutRecord } from "../../../../../../src/platform/orchestration/oapeflir/types/rollout-record.js";
import { RolloutScheduler } from "../../../../../../src/platform/orchestration/oapeflir/improve-rollout/rollout/rollout-scheduler.js";

function createCandidate() {
  return {
    candidateId: "candidate_1",
    taskId: "task_1",
    sourceSignalRefs: ["artifact:1"],
    sourceLearningObjectIds: ["learning_1"],
    changeScope: "policy" as const,
    description: "Improve planner",
    expectedBenefit: "Fewer retries",
    status: "approved" as const,
    createdAt: Date.now(),
  };
}

function createRecord(status: "shadow" | "canary_5" | "partial_25" | "stable", transitionedAt: number) {
  return parseRolloutRecord({
    recordId: `rollout_${status}`,
    candidateId: "candidate_1",
    level: status === "shadow" ? "shadow" : status,
    previousLevel: "suggest",
    strategyVersionId: "strategy_1",
    status,
    transitionedAt,
    approvedBy: "operator",
    guardrailReasonCodes: [],
    evidence: ["artifact:1"],
  });
}

test("RolloutScheduler promotes shadow rollout after dwell window", async () => {
  const scheduler = new RolloutScheduler({
    now: () => 1_000_000,
    minimumStageDwellMs: { shadow: 1_000 },
    metricsProvider: {
      readMetrics: () => ({
        requestCount: 100,
        failureRate: 0.01,
        p99LatencyMs: 120,
        baselineP99LatencyMs: 100,
        observationWindowMs: 120_000,
      }),
    },
  });

  const decision = await scheduler.advance({
    candidate: createCandidate(),
    record: createRecord("shadow", 998_000),
    approvedBy: "operator",
  });

  assert.equal(decision.action, "promote");
  assert.equal(decision.record.status, "canary_5");
  assert.equal(decision.nextStatus, "canary_5");
});

test("RolloutScheduler waits when minimum dwell time has not elapsed", async () => {
  const scheduler = new RolloutScheduler({
    now: () => 1_000_000,
    minimumStageDwellMs: { shadow: 10_000 },
  });

  const decision = await scheduler.advance({
    candidate: createCandidate(),
    record: createRecord("shadow", 995_500),
  });

  assert.equal(decision.action, "wait");
  assert.equal(decision.record.status, "shadow");
  assert.deepEqual(decision.reasonCodes, ["rollout.stage_dwell_required"]);
});

test("RolloutScheduler blocks progressive promotion when metrics are missing", async () => {
  const scheduler = new RolloutScheduler({
    now: () => 1_000_000,
    minimumStageDwellMs: { canary_5: 1_000 },
  });

  const decision = await scheduler.advance({
    candidate: createCandidate(),
    record: createRecord("canary_5", 995_000),
  });

  assert.equal(decision.action, "blocked");
  assert.equal(decision.record.status, "canary_5");
  assert.deepEqual(decision.reasonCodes, ["rollout.metrics_required"]);
});

test("RolloutScheduler rolls back when metrics gate fails", async () => {
  const scheduler = new RolloutScheduler({
    now: () => 1_000_000,
    minimumStageDwellMs: { canary_5: 1_000 },
    metricsProvider: {
      readMetrics: () => ({
        requestCount: 100,
        failureRate: 0.25,
        p99LatencyMs: 500,
        baselineP99LatencyMs: 100,
        observationWindowMs: 120_000,
      }),
    },
  });

  const decision = await scheduler.advance({
    candidate: createCandidate(),
    record: createRecord("canary_5", 995_000),
    approvedBy: "operator",
  });

  assert.equal(decision.action, "rollback");
  assert.equal(decision.record.status, "rolled_back");
  assert.ok(decision.reasonCodes.includes("rollout.failure_rate_exceeded"));
});

test("RolloutScheduler leaves stable rollouts untouched", async () => {
  const scheduler = new RolloutScheduler();
  const decision = await scheduler.advance({
    candidate: createCandidate(),
    record: createRecord("stable", 900_000),
  });

  assert.equal(decision.action, "wait");
  assert.equal(decision.nextStatus, null);
  assert.deepEqual(decision.reasonCodes, ["rollout.no_further_progression"]);
});

test("RolloutScheduler.advanceMany processes multiple rollouts", async () => {
  const scheduler = new RolloutScheduler({
    now: () => 1_000_000,
    minimumStageDwellMs: { shadow: 1_000, canary_5: 1_000 },
    metricsProvider: {
      readMetrics: (record) => record.status === "shadow"
        ? {
            requestCount: 100,
            failureRate: 0.01,
            p99LatencyMs: 120,
            baselineP99LatencyMs: 100,
            observationWindowMs: 120_000,
          }
        : null,
    },
  });

  const inputs = [
    {
      candidate: createCandidate(),
      record: createRecord("shadow", 998_000),
      approvedBy: "operator",
    },
    {
      candidate: createCandidate(),
      record: createRecord("canary_5", 998_000),
      approvedBy: "operator",
    },
  ];

  const decisions = await scheduler.advanceMany(inputs);

  assert.equal(decisions.length, 2);
  assert.equal(decisions[0]!.action, "promote");
  assert.equal(decisions[0]!.record.status, "canary_5");
  // canary_5 with no metrics returns "blocked" action
  assert.equal(decisions[1]!.action, "blocked");
  assert.equal(decisions[1]!.record.status, "canary_5");
});

test("RolloutScheduler.advanceMany handles empty array", async () => {
  const scheduler = new RolloutScheduler();
  const decisions = await scheduler.advanceMany([]);
  assert.equal(decisions.length, 0);
});

test("RolloutScheduler handles metricsProvider returning null", async () => {
  const scheduler = new RolloutScheduler({
    now: () => 1_000_000,
    minimumStageDwellMs: { canary_5: 1_000 },
    metricsProvider: {
      readMetrics: () => null, // Explicitly return null
    },
  });

  const decision = await scheduler.advance({
    candidate: createCandidate(),
    record: createRecord("canary_5", 995_000),
    approvedBy: "operator",
  });

  // With null metrics, gate evaluation may be affected
  assert.equal(decision.action, "blocked" as const);
  assert.equal(decision.record.status, "canary_5");
});
