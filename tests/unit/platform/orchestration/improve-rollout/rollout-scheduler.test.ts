import assert from "node:assert/strict";
import test from "node:test";

import {
  RolloutScheduler,
  type ScheduledRollout,
  type RolloutMetrics,
} from "../../../../../src/platform/orchestration/improve-rollout/rollout/rollout-scheduler.js";
import type { ImprovementCandidate } from "../../../../../src/platform/orchestration/improve-rollout/improvement-candidate-registry.js";
import type { RolloutRecord } from "../../../../../src/platform/orchestration/oapeflir/types/rollout-record.js";

function makeCandidate(overrides: Partial<ImprovementCandidate> = {}): ImprovementCandidate {
  return {
    candidateId: "candidate-1",
    taskId: "task-1",
    sourceSignalRefs: ["signal-1"],
    sourceLearningObjectIds: ["lo-1"],
    changeScope: "policy",
    description: "Test",
    expectedBenefit: "Test benefit",
    status: "approved",
    createdAt: Date.now(),
    ...overrides,
  };
}

function makeRecord(overrides: Partial<RolloutRecord> = {}): RolloutRecord {
  return {
    recordId: "record-1",
    candidateId: "candidate-1",
    level: "shadow",
    previousLevel: "suggest",
    strategyVersionId: "sv-1",
    status: "shadow",
    transitionedAt: Date.now(),
    guardrailReasonCodes: [],
    evidence: [],
    ...overrides,
  };
}

function makeMetrics(overrides: Partial<RolloutMetrics> = {}): RolloutMetrics {
  return {
    requestCount: 100,
    failureRate: 0.01,
    p99LatencyMs: 200,
    baselineP99LatencyMs: 100,
    observationWindowMs: 120_000,
    ...overrides,
  };
}

function makeScheduledRollout(overrides: Partial<ScheduledRollout> = {}): ScheduledRollout {
  return {
    candidate: makeCandidate(),
    record: makeRecord(),
    ...overrides,
  };
}

test("RolloutScheduler.advance returns wait action when no further progression", async () => {
  const scheduler = new RolloutScheduler();
  const rollout = makeScheduledRollout({ record: makeRecord({ status: "stable" }) });

  const decision = await scheduler.advance(rollout);

  assert.equal(decision.action, "wait");
  assert.equal(decision.nextStatus, null);
  assert.ok(decision.reasonCodes.includes("rollout.no_further_progression"));
});

test("RolloutScheduler.advance returns wait action when stage dwell not met", async () => {
  const scheduler = new RolloutScheduler({
    now: () => 1000,
    minimumStageDwellMs: { shadow: 5000 },
  });
  const rollout = makeScheduledRollout({
    record: makeRecord({ status: "shadow", transitionedAt: 100 }),
  });

  const decision = await scheduler.advance(rollout);

  assert.equal(decision.action, "wait");
  assert.equal(decision.nextStatus, "canary_5");
  assert.ok(decision.reasonCodes.includes("rollout.stage_dwell_required"));
});

test("RolloutScheduler.advance returns blocked action when metrics gate fails without rollback", async () => {
  const scheduler = new RolloutScheduler({
    metricsProvider: {
      readMetrics: () => makeMetrics({ failureRate: 0.10 }),
    },
  });
  const rollout = makeScheduledRollout({
    record: makeRecord({ status: "shadow", transitionedAt: Date.now() - 10000 }),
  });

  const decision = await scheduler.advance(rollout);

  assert.equal(decision.action, "blocked");
  assert.equal(decision.nextStatus, "canary_5");
});

test("RolloutScheduler.advance returns rollback action when metrics gate triggers rollback", async () => {
  const scheduler = new RolloutScheduler({
    metricsProvider: {
      readMetrics: () => makeMetrics({ failureRate: 0.50 }),
    },
  });
  const rollout = makeScheduledRollout({
    record: makeRecord({ status: "canary_5", transitionedAt: Date.now() - 10000 }),
  });

  const decision = await scheduler.advance(rollout);

  assert.equal(decision.action, "rollback");
  assert.equal(decision.nextStatus, "rolled_back");
});

test("RolloutScheduler.advance returns promote action when gate passes", async () => {
  const scheduler = new RolloutScheduler({
    metricsProvider: {
      readMetrics: () => makeMetrics({ failureRate: 0.01 }),
    },
  });
  const rollout = makeScheduledRollout({
    record: makeRecord({ status: "shadow", transitionedAt: Date.now() - 10000 }),
  });

  const decision = await scheduler.advance(rollout);

  assert.equal(decision.action, "promote");
  assert.equal(decision.nextStatus, "canary_5");
});

test("RolloutScheduler.advance handles null metricsProvider", async () => {
  const scheduler = new RolloutScheduler({
    metricsProvider: null,
    minimumStageDwellMs: { shadow: 0 },
  });
  const rollout = makeScheduledRollout({
    record: makeRecord({ status: "shadow", transitionedAt: Date.now() }),
  });

  const decision = await scheduler.advance(rollout);

  assert.equal(decision.action, "blocked");
  assert.equal(decision.nextStatus, "canary_5");
  assert.ok(decision.reasonCodes.includes("rollout.metrics_required"));
});

test("RolloutScheduler.advance handles paused status has no further progression", async () => {
  const scheduler = new RolloutScheduler();
  const rollout = makeScheduledRollout({
    record: makeRecord({ status: "paused" }),
  });

  const decision = await scheduler.advance(rollout);

  assert.equal(decision.action, "wait");
  assert.equal(decision.nextStatus, null);
});

test("RolloutScheduler.advance handles rejected status has no further progression", async () => {
  const scheduler = new RolloutScheduler();
  const rollout = makeScheduledRollout({
    record: makeRecord({ status: "rejected" }),
  });

  const decision = await scheduler.advance(rollout);

  assert.equal(decision.action, "wait");
  assert.equal(decision.nextStatus, null);
});

test("RolloutScheduler uses custom minimum stage dwell times", async () => {
  const scheduler = new RolloutScheduler({
    now: () => 5000,
    minimumStageDwellMs: {
      shadow: 10000,
      canary_5: 5000,
    },
  });
  const rollout = makeScheduledRollout({
    record: makeRecord({ status: "shadow", transitionedAt: 4000 }),
  });

  const decision = await scheduler.advance(rollout);

  assert.equal(decision.action, "wait");
  assert.ok(decision.reasonCodes.includes("rollout.stage_dwell_required"));
});

test("RolloutScheduler handles partial null from metricsProvider", async () => {
  const scheduler = new RolloutScheduler({
    metricsProvider: {
      readMetrics: () => null,
    },
    minimumStageDwellMs: { shadow: 0 },
  });
  const rollout = makeScheduledRollout({
    record: makeRecord({ status: "shadow", transitionedAt: Date.now() }),
  });

  const decision = await scheduler.advance(rollout);

  assert.equal(decision.action, "blocked");
  assert.ok(decision.reasonCodes.includes("rollout.metrics_required"));
});

test("RolloutScheduler records metrics in decision", async () => {
  const metrics = makeMetrics({ failureRate: 0.01 });
  const scheduler = new RolloutScheduler({
    metricsProvider: { readMetrics: () => metrics },
    minimumStageDwellMs: { shadow: 0 },
  });
  const rollout = makeScheduledRollout({
    record: makeRecord({ status: "shadow", transitionedAt: Date.now() - 10000 }),
  });

  const decision = await scheduler.advance(rollout);

  assert.deepEqual(decision.metrics, metrics);
});

test("RolloutScheduler.advanceMany processes multiple rollouts", async () => {
  const scheduler = new RolloutScheduler({
    metricsProvider: null,
    minimumStageDwellMs: { shadow: 0 },
  });
  const rollouts: ScheduledRollout[] = [
    makeScheduledRollout({ record: makeRecord({ status: "shadow", recordId: "r1" }) }),
    makeScheduledRollout({ record: makeRecord({ status: "shadow", recordId: "r2" }) }),
    makeScheduledRollout({ record: makeRecord({ status: "stable", recordId: "r3" }) }),
  ];

  const decisions = await scheduler.advanceMany(rollouts);

  assert.equal(decisions.length, 3);
  // First two should be blocked (shadow needs metrics), third should be wait (stable has no progression)
  assert.ok(decisions[2]!.action === "wait");
});

test("RolloutScheduler.advanceMany handles empty array", async () => {
  const scheduler = new RolloutScheduler();

  const decisions = await scheduler.advanceMany([]);

  assert.equal(decisions.length, 0);
});
