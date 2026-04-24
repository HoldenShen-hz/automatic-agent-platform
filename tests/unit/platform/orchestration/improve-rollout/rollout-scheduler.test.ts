import assert from "node:assert/strict";
import test from "node:test";

import { RolloutScheduler } from "../../../../../src/platform/orchestration/improve-rollout/rollout/rollout-scheduler.js";
import type { RolloutRecord } from "../../../../../src/platform/orchestration/oapeflir/types/rollout-record.js";
import type { RolloutMetrics } from "../../../../../src/platform/orchestration/improve-rollout/auto-rollback-service.js";
import type { ImprovementCandidate } from "../../../../../src/platform/orchestration/improve-rollout/improvement-candidate-registry.js";
import type { PolicyRolloutService } from "../../../../../src/platform/orchestration/improve-rollout/policy-rollout-service.js";

function createMockCandidate(overrides: Partial<ImprovementCandidate> = {}): ImprovementCandidate {
  return {
    candidateId: "candidate-1",
    taskId: "task-1",
    sourceSignalRefs: ["signal-1"],
    sourceLearningObjectIds: ["lo-1"],
    changeScope: "policy",
    description: "Test improvement",
    expectedBenefit: "Test benefit",
    status: "approved",
    createdAt: Date.now(),
    ...overrides,
  };
}

function createMockRolloutRecord(overrides: Partial<RolloutRecord> = {}): RolloutRecord {
  return {
    recordId: "rollout-1",
    candidateId: "candidate-1",
    level: "shadow",
    previousLevel: "suggest",
    strategyVersionId: "strategy-v1",
    status: "shadow",
    transitionedAt: Date.now() - 600_000,
    approvedBy: "approver-1",
    guardrailReasonCodes: [],
    evidence: [],
    ...overrides,
  };
}

function createMockMetrics(overrides: Partial<RolloutMetrics> = {}): RolloutMetrics {
  return {
    requestCount: 100,
    failureRate: 0.01,
    p99LatencyMs: 200,
    baselineP99LatencyMs: 150,
    observationWindowMs: 120_000,
    ...overrides,
  };
}

test("RolloutScheduler advance returns wait when no further progression available", async () => {
  const scheduler = new RolloutScheduler();
  const candidate = createMockCandidate();
  const record = createMockRolloutRecord({ status: "stable" });

  const decision = await scheduler.advance({ candidate, record });

  assert.equal(decision.action, "wait");
  assert.equal(decision.nextStatus, null);
  assert.ok(decision.reasonCodes.includes("rollout.no_further_progression"));
});

test("RolloutScheduler advance returns wait when stage dwell time not met", async () => {
  const scheduler = new RolloutScheduler({ minimumStageDwellMs: { canary_5: 600_000 } });
  const candidate = createMockCandidate();
  const record = createMockRolloutRecord({
    status: "canary_5",
    transitionedAt: Date.now() - 300_000,
  });

  const decision = await scheduler.advance({ candidate, record });

  assert.equal(decision.action, "wait");
  assert.ok(decision.reasonCodes.includes("rollout.stage_dwell_required"));
});

test("RolloutScheduler advance returns blocked when metrics required for progressive status", async () => {
  const mockRolloutService = {
    evaluateMetricsGate: (_current: unknown, _target: unknown, _metrics?: unknown) => ({
      allowed: false,
      rollback: false,
      reasonCodes: ["rollout.metrics_required"],
    }),
    promote: () => createMockRolloutRecord(),
    rollback: () => createMockRolloutRecord({ status: "rolled_back" }),
  } as unknown as PolicyRolloutService;

  const scheduler = new RolloutScheduler({
    rolloutService: mockRolloutService,
    minimumStageDwellMs: { canary_5: 0 },
  });
  const candidate = createMockCandidate();
  const record = createMockRolloutRecord({ status: "canary_5" });

  const decision = await scheduler.advance({ candidate, record });

  assert.equal(decision.action, "blocked");
  assert.ok(decision.reasonCodes.includes("rollout.metrics_required"));
});

test("RolloutScheduler advance returns rollback when metrics gate triggers rollback", async () => {
  const metrics = createMockMetrics({ failureRate: 0.10 });
  const mockRolloutService = {
    evaluateMetricsGate: (_current: unknown, _target: unknown, receivedMetrics?: unknown) => {
      assert.equal(receivedMetrics, metrics);
      return {
      allowed: false,
      rollback: true,
      reasonCodes: ["rollout.failure_rate_exceeded"],
      };
    },
    promote: () => createMockRolloutRecord(),
    rollback: () => createMockRolloutRecord({ status: "rolled_back" }),
  } as unknown as PolicyRolloutService;

  const scheduler = new RolloutScheduler({
    rolloutService: mockRolloutService,
    metricsProvider: {
      readMetrics: () => metrics,
    },
    minimumStageDwellMs: { canary_5: 0 },
  });
  const candidate = createMockCandidate();
  const record = createMockRolloutRecord({ status: "canary_5" });

  const decision = await scheduler.advance({ candidate, record });

  assert.equal(decision.action, "rollback");
  assert.equal(decision.nextStatus, "rolled_back");
});

test("RolloutScheduler advance returns promote when conditions are met", async () => {
  const promotedRecord = createMockRolloutRecord({ status: "partial_25" });
  const metrics = createMockMetrics();
  const mockRolloutService = {
    evaluateMetricsGate: (_current: unknown, _target: unknown, receivedMetrics?: unknown) => {
      assert.equal(receivedMetrics, metrics);
      return {
      allowed: true,
      rollback: false,
      reasonCodes: ["rollout.metrics_gate_passed"],
      };
    },
    promote: () => promotedRecord,
    rollback: () => createMockRolloutRecord({ status: "rolled_back" }),
  } as unknown as PolicyRolloutService;

  const scheduler = new RolloutScheduler({
    rolloutService: mockRolloutService,
    metricsProvider: {
      readMetrics: () => metrics,
    },
    minimumStageDwellMs: { canary_5: 0 },
  });
  const candidate = createMockCandidate();
  const record = createMockRolloutRecord({ status: "canary_5" });

  const decision = await scheduler.advance({ candidate, record });

  assert.equal(decision.action, "promote");
  assert.equal(decision.nextStatus, "partial_25");
});

test("RolloutScheduler advanceMany processes multiple rollouts", async () => {
  const mockRolloutService = {
    evaluateMetricsGate: (_current: unknown, _target: unknown, _metrics?: unknown) => ({
      allowed: true,
      rollback: false,
      reasonCodes: [],
    }),
    promote: () => createMockRolloutRecord({ status: "canary_5" }),
    rollback: () => createMockRolloutRecord({ status: "rolled_back" }),
  } as unknown as PolicyRolloutService;

  const scheduler = new RolloutScheduler({
    rolloutService: mockRolloutService,
    minimumStageDwellMs: { canary_5: 0 },
  });
  const candidate1 = createMockCandidate({ candidateId: "candidate-1" });
  const candidate2 = createMockCandidate({ candidateId: "candidate-2" });
  const record1 = createMockRolloutRecord({ candidateId: "candidate-1", status: "canary_5" });
  const record2 = createMockRolloutRecord({ candidateId: "candidate-2", status: "canary_5" });

  const decisions = await scheduler.advanceMany([
    { candidate: candidate1, record: record1 },
    { candidate: candidate2, record: record2 },
  ]);

  assert.equal(decisions.length, 2);
});

test("RolloutScheduler advance handles missing metricsProvider with canary_5 status", async () => {
  const mockRolloutService = {
    evaluateMetricsGate: (_current: unknown, _target: unknown, _metrics?: unknown) => ({
      allowed: true,
      rollback: false,
      reasonCodes: [],
    }),
    promote: () => createMockRolloutRecord({ status: "canary_5" }),
    rollback: () => createMockRolloutRecord({ status: "rolled_back" }),
  } as unknown as PolicyRolloutService;

  const scheduler = new RolloutScheduler({
    rolloutService: mockRolloutService,
    minimumStageDwellMs: { canary_5: 0 },
  });
  const candidate = createMockCandidate();
  const record = createMockRolloutRecord({ status: "canary_5" });

  const decision = await scheduler.advance({ candidate, record });

  assert.equal(decision.action, "promote");
  assert.equal(decision.metrics, null);
});

test("RolloutScheduler advance uses custom now function", async () => {
  let callCount = 0;
  const customNow = () => {
    callCount++;
    return 1000;
  };

  const mockRolloutService = {
    evaluateMetricsGate: (_current: unknown, _target: unknown, _metrics?: unknown) => ({
      allowed: true,
      rollback: false,
      reasonCodes: [],
    }),
    promote: () => createMockRolloutRecord({ status: "canary_5" }),
    rollback: () => createMockRolloutRecord({ status: "rolled_back" }),
  } as unknown as PolicyRolloutService;

  const scheduler = new RolloutScheduler({
    rolloutService: mockRolloutService,
    now: customNow,
    minimumStageDwellMs: { canary_5: 200 },
  });
  const candidate = createMockCandidate();
  const record = createMockRolloutRecord({ status: "canary_5", transitionedAt: 900 });

  const decision = await scheduler.advance({ candidate, record });

  assert.equal(decision.action, "wait");
  assert.ok(callCount > 0);
});

test("RolloutScheduler advance uses default minimum stage dwell times", async () => {
  const mockRolloutService = {
    evaluateMetricsGate: (_current: unknown, _target: unknown, _metrics?: unknown) => ({
      allowed: true,
      rollback: false,
      reasonCodes: [],
    }),
    promote: () => createMockRolloutRecord({ status: "canary_5" }),
    rollback: () => createMockRolloutRecord({ status: "rolled_back" }),
  } as unknown as PolicyRolloutService;

  const scheduler = new RolloutScheduler({ rolloutService: mockRolloutService });
  const candidate = createMockCandidate();
  const record = createMockRolloutRecord({
    status: "canary_5",
    transitionedAt: Date.now() - 600_000,
  });

  const decision = await scheduler.advance({ candidate, record });

  assert.equal(decision.action, "wait");
  assert.ok(decision.reasonCodes.includes("rollout.stage_dwell_required"));
});

test("RolloutScheduler advance handles rejected status gracefully", async () => {
  const scheduler = new RolloutScheduler();
  const candidate = createMockCandidate({ status: "rejected" });
  const record = createMockRolloutRecord({ status: "rejected" });

  const decision = await scheduler.advance({ candidate, record });

  assert.equal(decision.action, "wait");
  assert.equal(decision.nextStatus, null);
});

test("RolloutScheduler advance handles rolled_back status gracefully", async () => {
  const scheduler = new RolloutScheduler();
  const candidate = createMockCandidate({ status: "rolled_back" });
  const record = createMockRolloutRecord({ status: "rolled_back" });

  const decision = await scheduler.advance({ candidate, record });

  assert.equal(decision.action, "wait");
  assert.equal(decision.nextStatus, null);
});

test("RolloutScheduler advance with partial_25 status advances to partial_50", async () => {
  const promotedRecord = createMockRolloutRecord({ status: "partial_50" });
  const mockRolloutService = {
    evaluateMetricsGate: (_current: unknown, _target: unknown, _metrics?: unknown) => ({
      allowed: true,
      rollback: false,
      reasonCodes: [],
    }),
    promote: () => promotedRecord,
    rollback: () => createMockRolloutRecord({ status: "rolled_back" }),
  } as unknown as PolicyRolloutService;

  const scheduler = new RolloutScheduler({
    rolloutService: mockRolloutService,
    minimumStageDwellMs: { partial_25: 0 },
  });
  const candidate = createMockCandidate();
  const record = createMockRolloutRecord({ status: "partial_25" });

  const decision = await scheduler.advance({ candidate, record });

  assert.equal(decision.action, "promote");
  assert.equal(decision.nextStatus, "partial_50");
});

test("RolloutScheduler advance with partial_75 status advances to stable", async () => {
  const promotedRecord = createMockRolloutRecord({ status: "stable" });
  const mockRolloutService = {
    evaluateMetricsGate: (_current: unknown, _target: unknown, _metrics?: unknown) => ({
      allowed: true,
      rollback: false,
      reasonCodes: [],
    }),
    promote: () => promotedRecord,
    rollback: () => createMockRolloutRecord({ status: "rolled_back" }),
  } as unknown as PolicyRolloutService;

  const scheduler = new RolloutScheduler({
    rolloutService: mockRolloutService,
    minimumStageDwellMs: { partial_75: 0 },
  });
  const candidate = createMockCandidate();
  const record = createMockRolloutRecord({ status: "partial_75" });

  const decision = await scheduler.advance({ candidate, record });

  assert.equal(decision.action, "promote");
  assert.equal(decision.nextStatus, "stable");
});

test("RolloutScheduler advance passes approvedBy to promote", async () => {
  let promoteCalledWith: { approvedBy: string | undefined } = { approvedBy: undefined };
  const mockRolloutService = {
    evaluateMetricsGate: (_current: unknown, _target: unknown, _metrics?: unknown) => ({
      allowed: true,
      rollback: false,
      reasonCodes: [],
    }),
    promote: (_cand: unknown, _rec: unknown, _status: unknown, _metrics: unknown, approvedBy?: string) => {
      promoteCalledWith.approvedBy = approvedBy;
      return createMockRolloutRecord({ status: "canary_5" });
    },
    rollback: () => createMockRolloutRecord({ status: "rolled_back" }),
  } as unknown as PolicyRolloutService;

  const scheduler = new RolloutScheduler({
    rolloutService: mockRolloutService,
    minimumStageDwellMs: { canary_5: 0 },
  });
  const candidate = createMockCandidate();
  const record = createMockRolloutRecord({ status: "canary_5" });

  await scheduler.advance({ candidate, record, approvedBy: "test-approver" });

  assert.equal(promoteCalledWith.approvedBy, "test-approver");
});
