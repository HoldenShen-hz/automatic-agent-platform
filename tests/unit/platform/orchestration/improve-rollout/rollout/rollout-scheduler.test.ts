import assert from "node:assert/strict";
import test from "node:test";

import { RolloutScheduler } from "../../../../../../src/platform/five-plane-orchestration/improve-rollout/rollout/rollout-scheduler.js";
import type { RolloutRecord } from "../../../../../../src/platform/five-plane-orchestration/oapeflir/types/rollout-record.js";
import type { ImprovementCandidate } from "../../../../../../src/platform/five-plane-orchestration/improve-rollout/improvement-candidate-registry.js";

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
    level: "L1_evaluate",
    previousLevel: "L0_off",
    strategyVersionId: null,
    status: "evaluation_enabled",
    transitionedAt: Date.now() - 600_000,
    approvedBy: null,
    guardrailReasonCodes: [],
    evidence: [],
    ...overrides,
  };
}

function createMetrics() {
  return {
    requestCount: 100,
    failureRate: 0.01,
    p99LatencyMs: 120,
    baselineP99LatencyMs: 100,
    observationWindowMs: 120_000,
  };
}

test("RolloutScheduler.advance returns wait when no further progression available", async () => {
  const scheduler = new RolloutScheduler();
  const candidate = createMockCandidate();
  const record = createMockRecord({ status: "released", level: "L5_full" });

  const decision = await scheduler.advance({ candidate, record });

  assert.equal(decision.action, "wait");
  assert.equal(decision.reasonCodes[0], "rollout.no_further_progression");
});

test("RolloutScheduler.advance returns wait when stage dwell time not met", async () => {
  const scheduler = new RolloutScheduler({
    now: () => Date.now(),
    minimumStageDwellMs: { evaluation_enabled: 5_000 },
    metricsProvider: {
      readMetrics: () => createMetrics(),
    },
  });
  const candidate = createMockCandidate();
  const record = createMockRecord({ status: "evaluation_enabled", transitionedAt: Date.now() - 1_000 });

  const decision = await scheduler.advance({ candidate, record });

  assert.equal(decision.action, "wait");
  assert.equal(decision.reasonCodes[0], "rollout.stage_dwell_required");
});

test("RolloutScheduler.advance allows promotion when stage dwell time is met", async () => {
  const scheduler = new RolloutScheduler({
    now: () => Date.now(),
    minimumStageDwellMs: { evaluation_enabled: 1_000 },
    metricsProvider: {
      readMetrics: () => createMetrics(),
    },
  });
  const candidate = createMockCandidate();
  const record = createMockRecord({ status: "evaluation_enabled", transitionedAt: Date.now() - 2_000 });

  const decision = await scheduler.advance({ candidate, record });

  assert.equal(decision.action, "promote");
  assert.equal(decision.nextStatus, "canary_5");
});

test("RolloutScheduler.advanceMany processes multiple rollouts", async () => {
  const scheduler = new RolloutScheduler({
    now: () => Date.now(),
    minimumStageDwellMs: { evaluation_enabled: 1_000 },
  });
  const candidate1 = createMockCandidate({ candidateId: "candidate-1" });
  const candidate2 = createMockCandidate({ candidateId: "candidate-2" });
  const record1 = createMockRecord({ candidateId: "candidate-1", status: "evaluation_enabled", transitionedAt: Date.now() - 2_000 });
  const record2 = createMockRecord({ candidateId: "candidate-2", status: "evaluation_enabled", transitionedAt: Date.now() - 2_000 });

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
    minimumStageDwellMs: { evaluation_enabled: 600_000 },
    metricsProvider: {
      readMetrics: () => createMetrics(),
    },
  });
  const candidate = createMockCandidate();
  const record = createMockRecord({ status: "evaluation_enabled", transitionedAt: Date.now() - 300_000 });

  const decision = await scheduler.advance({ candidate, record });

  assert.equal(decision.action, "wait");
});

test("RolloutScheduler handles custom now function", async () => {
  const fixedTime = 1_000_000_000;
  const scheduler = new RolloutScheduler({
    now: () => fixedTime,
    minimumStageDwellMs: { evaluation_enabled: 5000 },
    metricsProvider: {
      readMetrics: () => createMetrics(),
    },
  });
  const candidate = createMockCandidate();
  const record = createMockRecord({ status: "evaluation_enabled", transitionedAt: fixedTime - 2000 });

  const decision = await scheduler.advance({ candidate, record });

  assert.equal(decision.action, "wait");
});

test("RolloutScheduler advance handles active rollout statuses gracefully", async () => {
  const scheduler = new RolloutScheduler({
    now: () => Date.now(),
    minimumStageDwellMs: { evaluation_enabled: 0, canary_5: 0, partial_25: 0 },
  });
  const candidate = createMockCandidate();

  let record = createMockRecord({ status: "evaluation_enabled", level: "L1_evaluate", transitionedAt: 0 });
  let decision = await scheduler.advance({ candidate, record });
  assert.ok(["promote", "wait", "blocked"].includes(decision.action));

  record = createMockRecord({ status: "canary_5", level: "L2_canary", transitionedAt: 0 });
  decision = await scheduler.advance({ candidate, record });
  assert.ok(["promote", "wait", "blocked"].includes(decision.action));
});

test("RolloutScheduler constructor uses default values", () => {
  const scheduler = new RolloutScheduler();

  assert.ok(scheduler != null);
});

test("RolloutScheduler accepts partial options", () => {
  const scheduler = new RolloutScheduler({
    minimumStageDwellMs: { evaluation_enabled: 5000 },
  });

  assert.ok(scheduler != null);
});

test("RolloutScheduler handles custom minimumStageDwellMs override", async () => {
  const scheduler = new RolloutScheduler({
    minimumStageDwellMs: { evaluation_enabled: 999_999_999 },
    now: () => Date.now(),
    metricsProvider: {
      readMetrics: () => createMetrics(),
    },
  });
  const candidate = createMockCandidate();
  const record = createMockRecord({ status: "evaluation_enabled", transitionedAt: Date.now() - 100_000 });

  const decision = await scheduler.advance({ candidate, record });

  assert.equal(decision.action, "wait");
});
