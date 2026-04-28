import assert from "node:assert/strict";
import test from "node:test";

import { RolloutScheduler } from "../../../../../../src/platform/orchestration/improve-rollout/rollout/rollout-scheduler.js";
import type { RolloutRecord, RolloutStatus } from "../../../../../../src/platform/orchestration/oapeflir/types/rollout-record.js";
import type { ImprovementCandidate } from "../../../../../../src/platform/orchestration/improve-rollout/improvement-candidate-registry.js";

function createMockCandidate(overrides: Partial<ImprovementCandidate> = {}): ImprovementCandidate {
  return {
    candidateId: "candidate-1",
    taskId: "task-1",
    domainId: "domain-1",
    changeScope: "feature",
    status: "approved",
    createdAt: Date.now(),
    sourceSignalRefs: [],
    ...overrides,
  } as unknown as ImprovementCandidate;
}

function createMockRecord(overrides: Partial<RolloutRecord> = {}): RolloutRecord {
  return {
    recordId: "record-1",
    candidateId: "candidate-1",
    level: "shadow",
    previousLevel: "off",
    strategyVersionId: null,
    status: "shadow",
    transitionedAt: Date.now() - 600_000, // 10 minutes ago
    approvedBy: null,
    guardrailReasonCodes: [],
    evidence: [],
    ...overrides,
  };
}

test("RolloutScheduler.advance returns wait when no further progression available for stable", async () => {
  const scheduler = new RolloutScheduler();
  const candidate = createMockCandidate();
  const record = createMockRecord({ status: "stable", level: "stable" });

  const decision = await scheduler.advance({ candidate, record });

  assert.equal(decision.action, "wait");
  assert.equal(decision.reasonCodes[0], "rollout.no_further_progression");
});

test("RolloutScheduler.advance returns wait when stage dwell time not met", async () => {
  const scheduler = new RolloutScheduler({
    now: () => Date.now(),
    minimumStageDwellMs: { shadow: 5_000 },
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
  const candidate = createMockCandidate();
  // Record just transitioned (1 second ago)
  const record = createMockRecord({ status: "shadow", transitionedAt: Date.now() - 1_000 });

  const decision = await scheduler.advance({ candidate, record });

  assert.equal(decision.action, "wait");
  assert.equal(decision.reasonCodes[0], "rollout.stage_dwell_required");
});

test("RolloutScheduler.advance allows promotion when stage dwell time is met", async () => {
  const scheduler = new RolloutScheduler({
    now: () => Date.now(),
    minimumStageDwellMs: { shadow: 1_000 }, // 1 second minimum
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
  const candidate = createMockCandidate();
  // Record transitioned 2 seconds ago
  const record = createMockRecord({ status: "shadow", transitionedAt: Date.now() - 2_000 });

  const decision = await scheduler.advance({ candidate, record });

  assert.equal(decision.action, "promote");
  assert.ok(decision.nextStatus === "canary_5" || decision.reasonCodes.includes("rollout.no_further_progression") === false);
});

test("RolloutScheduler.advanceMany processes multiple rollouts", async () => {
  const scheduler = new RolloutScheduler({
    now: () => Date.now(),
    minimumStageDwellMs: { shadow: 1_000 },
  });
  const candidate1 = createMockCandidate({ candidateId: "candidate-1" });
  const candidate2 = createMockCandidate({ candidateId: "candidate-2" });
  const record1 = createMockRecord({ candidateId: "candidate-1", transitionedAt: Date.now() - 2_000 });
  const record2 = createMockRecord({ candidateId: "candidate-2", transitionedAt: Date.now() - 2_000 });

  const decisions = await scheduler.advanceMany([
    { candidate: candidate1, record: record1 },
    { candidate: candidate2, record: record2 },
  ]);

  assert.equal(decisions.length, 2);
  assert.ok(decisions[0] != null);
  assert.ok(decisions[1] != null);
});

test("RolloutScheduler allows custom minimum stage dwell times", async () => {
  const scheduler = new RolloutScheduler({
    now: () => Date.now(),
    minimumStageDwellMs: { shadow: 600_000 }, // 10 minutes
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
  const candidate = createMockCandidate();
  const record = createMockRecord({ status: "shadow", transitionedAt: Date.now() - 300_000 }); // 5 minutes ago

  const decision = await scheduler.advance({ candidate, record });

  assert.equal(decision.action, "wait");
});

test("RolloutScheduler handles custom now function", async () => {
  const fixedTime = 1_000_000_000;
  const scheduler = new RolloutScheduler({
    now: () => fixedTime,
    minimumStageDwellMs: { shadow: 5000 }, // 5 seconds
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
  const candidate = createMockCandidate();
  // Record transitioned 2 seconds ago, but minimum dwell is 5 seconds - should still wait
  const record = createMockRecord({ status: "shadow", transitionedAt: fixedTime - 2000 });

  const decision = await scheduler.advance({ candidate, record });

  assert.equal(decision.action, "wait"); // Still waiting since dwell time not met
});

test("RolloutScheduler advance handles all rollout statuses gracefully", async () => {
  const scheduler = new RolloutScheduler({
    now: () => Date.now(),
    minimumStageDwellMs: { shadow: 0, canary_5: 0, partial_25: 0 },
  });
  const candidate = createMockCandidate();

  // Test shadow -> canary_5
  let record = createMockRecord({ status: "shadow", level: "shadow", transitionedAt: 0 });
  let decision = await scheduler.advance({ candidate, record });
  assert.ok(["promote", "wait", "blocked"].includes(decision.action), `Unexpected action for shadow: ${decision.action}`);

  // Test canary_5 -> partial_25
  record = createMockRecord({ status: "canary_5", level: "canary_5", transitionedAt: 0 });
  decision = await scheduler.advance({ candidate, record });
  assert.ok(["promote", "wait", "blocked"].includes(decision.action), `Unexpected action for canary_5: ${decision.action}`);
});

test("RolloutScheduler constructor uses default values", () => {
  const scheduler = new RolloutScheduler();

  assert.ok(scheduler != null);
});

test("RolloutScheduler accepts partial options", () => {
  const scheduler = new RolloutScheduler({
    minimumStageDwellMs: { shadow: 5000 },
  });

  assert.ok(scheduler != null);
});

test("RolloutScheduler handles custom minimumStageDwellMs override", async () => {
  const scheduler = new RolloutScheduler({
    minimumStageDwellMs: { shadow: 999_999_999 }, // Very long dwell time
    now: () => Date.now(),
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
  const candidate = createMockCandidate();
  const record = createMockRecord({ status: "shadow", transitionedAt: Date.now() - 100_000 });

  const decision = await scheduler.advance({ candidate, record });

  assert.equal(decision.action, "wait");
});
