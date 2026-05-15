/**
 * E2E Rollback Scenario Tests
 *
 * End-to-end tests covering rollback scenarios:
 * - Rollout state machine transitions
 * - Auto-rollback evaluation based on metrics
 * - Policy rollback workflow
 * - Manual rollback triggers
 */

import assert from "node:assert/strict";
import test from "node:test";

import { RolloutStateMachine } from "../../src/platform/five-plane-orchestration/oapeflir/improve-rollout/rollout/rollout-state-machine.js";
import { AutoRollbackService } from "../../src/platform/five-plane-orchestration/oapeflir/improve-rollout/auto-rollback-service.js";
import { parseImprovementCandidate } from "../../src/platform/five-plane-orchestration/oapeflir/types/improvement-candidate.js";
import type { ImprovementCandidate } from "../../src/platform/five-plane-orchestration/oapeflir/types/improvement-candidate.js";
import type { RolloutMetrics } from "../../src/platform/five-plane-orchestration/oapeflir/improve-rollout/auto-rollback-service.js";
import type { RolloutRecord } from "../../src/platform/five-plane-orchestration/oapeflir/types/rollout-record.js";

// ─────────────────────────────────────────────────────────────────────────────
// Test Fixtures
// ─────────────────────────────────────────────────────────────────────────────

function createCandidate(overrides: Partial<ImprovementCandidate> = {}): ImprovementCandidate {
  return parseImprovementCandidate({
    candidateId: "candidate-e2e",
    taskId: "task-e2e-rollback",
    sourceSignalRefs: ["signal:1", "signal:2"],
    sourceLearningObjectIds: [],
    changeScope: "prompt",
    description: "E2E test candidate",
    expectedBenefit: "Test improvement",
    status: "candidate_created",
    createdAt: Date.now(),
    ...overrides,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// E2E Rollback Scenario Tests
// ─────────────────────────────────────────────────────────────────────────────

test("E2E: rollout state machine transitions from L1_evaluate to L2_canary", () => {
  const machine = new RolloutStateMachine();
  // First get to L1_evaluate state, then transition to L2_canary
  const candidate = createCandidate({ status: "approved" });

  // Transition from L1_evaluate (evaluation_enabled) to L2_canary
  const record = machine.transition(candidate, "L2_canary", { currentStatus: "evaluation_enabled" });

  assert.equal(record.level, "L2_canary", "Should transition to L2_canary level");
  assert.equal(record.previousLevel, "L1_evaluate", "Previous level should be L1_evaluate");
  assert.equal(record.status, "canary_5", "Status should be canary_5");
  assert.ok(record.recordId, "Should have record ID");
  assert.ok(record.transitionedAt, "Should have transition timestamp");
});

test("E2E: rollout state machine allows rollback from canary to shadow", () => {
  const machine = new RolloutStateMachine();
  const candidate = createCandidate({ status: "canary_5" });

  // Canary running but needs rollback - use targetStatus to get rolled_back
  const record = machine.transition(candidate, "L0_off", {
    targetStatus: "rolled_back",
    guardrailReasonCodes: ["rollout.failure_rate_exceeded"],
  });

  assert.equal(record.level, "L0_off", "Should rollback to L0_off");
  assert.equal(record.status, "rolled_back", "Should be marked as rolled_back");
  assert.ok(record.guardrailReasonCodes.includes("rollout.failure_rate_exceeded"), "Should record reason");
});

test("E2E: rollout state machine rejects invalid transition", () => {
  const machine = new RolloutStateMachine();
  const candidate = createCandidate({ status: "rejected" });

  // rejected can only transition to rejected, so this should throw
  try {
    machine.transition(candidate, "L2_canary");
    assert.fail("Should have thrown for invalid transition");
  } catch (error) {
    assert.ok(error instanceof Error, "Should throw an Error");
    const msg = (error as Error).message;
    assert.ok(msg.includes("Invalid rollout transition"), `Error message should mention invalid transition, got: ${msg}`);
  }
});

test("E2E: rollout state machine advances through all phases", () => {
  const machine = new RolloutStateMachine();

  // Draft -> L1_evaluate (proposed can go to L1_evaluate directly)
  let candidate = createCandidate({ status: "candidate_created" });
  let record = machine.transition(candidate, "L1_evaluate", { approvedBy: "admin-1" });
  assert.equal(record.status, "evaluation_enabled");

  // L1_evaluate -> L2_canary (L1_evaluate can go to L2_canary)
  // Note: need to use currentStatus since candidate object doesn't update
  record = machine.transition(candidate, "L2_canary", { currentStatus: "evaluation_enabled" });
  assert.equal(record.status, "canary_5");

  // L2_canary -> L3_partial (canary_5 can go to partial_25)
  record = machine.transition(candidate, "L3_partial", { currentStatus: "canary_5" });
  assert.equal(record.status, "partial_25");

  // L3_partial -> L4_stable (partial_25 can go to stable_75)
  record = machine.transition(candidate, "L4_stable", { currentStatus: "partial_25" });
  assert.equal(record.status, "stable_75");

  // L4_stable -> L5_full (stable_75 can go to stable_100)
  record = machine.transition(candidate, "L5_full", { currentStatus: "stable_75" });
  assert.equal(record.status, "stable_100");
});

test("E2E: auto-rollback triggers on high failure rate", () => {
  const service = new AutoRollbackService({
    maxFailureRate: 0.05,
    maxLatencyMultiplier: 2,
    minimumRequestCount: 20,
    minimumObservationWindowMs: 60000,
  });

  const metrics: RolloutMetrics = {
    requestCount: 100,
    failureRate: 0.10, // 10% - exceeds 5% threshold
    p99LatencyMs: 100,
    baselineP99LatencyMs: 100,
    observationWindowMs: 120000,
  };

  const decision = service.evaluate({} as RolloutRecord, metrics);

  assert.equal(decision.rollback, true, "Should trigger rollback");
  assert.ok(decision.reasonCodes.includes("rollout.failure_rate_exceeded"));
});

test("E2E: auto-rollback triggers on latency spike", () => {
  const service = new AutoRollbackService({
    maxFailureRate: 0.05,
    maxLatencyMultiplier: 2,
    minimumRequestCount: 20,
    minimumObservationWindowMs: 60000,
  });

  const metrics: RolloutMetrics = {
    requestCount: 100,
    failureRate: 0.01, // 1% - below threshold
    p99LatencyMs: 300, // 3x baseline
    baselineP99LatencyMs: 100,
    observationWindowMs: 120000,
  };

  const decision = service.evaluate({} as RolloutRecord, metrics);

  assert.equal(decision.rollback, true, "Should trigger rollback for latency");
  assert.ok(decision.reasonCodes.includes("rollout.latency_multiplier_exceeded"));
});

test("E2E: auto-rollback does not trigger with insufficient samples", () => {
  const service = new AutoRollbackService({
    maxFailureRate: 0.05,
    maxLatencyMultiplier: 2,
    minimumRequestCount: 20,
    minimumObservationWindowMs: 60000,
  });

  const metrics: RolloutMetrics = {
    requestCount: 10, // Below minimum
    failureRate: 0.5, // Would exceed threshold
    p99LatencyMs: 500,
    baselineP99LatencyMs: 100,
    observationWindowMs: 120000,
  };

  const decision = service.evaluate({} as RolloutRecord, metrics);

  assert.equal(decision.rollback, false, "Should not rollback with insufficient samples");
  assert.ok(decision.reasonCodes.includes("rollout.metrics_insufficient_sample"));
});

test("E2E: auto-rollback does not trigger with insufficient observation window", () => {
  const service = new AutoRollbackService({
    maxFailureRate: 0.05,
    maxLatencyMultiplier: 2,
    minimumRequestCount: 20,
    minimumObservationWindowMs: 60000,
  });

  const metrics: RolloutMetrics = {
    requestCount: 100,
    failureRate: 0.10, // Would trigger
    p99LatencyMs: 300,
    baselineP99LatencyMs: 100,
    observationWindowMs: 30000, // Below minimum
  };

  const decision = service.evaluate({} as RolloutRecord, metrics);

  assert.equal(decision.rollback, false, "Should not rollback with short observation window");
  assert.ok(decision.reasonCodes.includes("rollout.metrics_insufficient_window"));
});

test("E2E: auto-rollback does not trigger when metrics are healthy", () => {
  const service = new AutoRollbackService({
    maxFailureRate: 0.05,
    maxLatencyMultiplier: 2,
    minimumRequestCount: 20,
    minimumObservationWindowMs: 60000,
  });

  const metrics: RolloutMetrics = {
    requestCount: 100,
    failureRate: 0.01, // 1% - well below threshold
    p99LatencyMs: 110, // Only 1.1x baseline
    baselineP99LatencyMs: 100,
    observationWindowMs: 120000,
  };

  const decision = service.evaluate({} as RolloutRecord, metrics);

  assert.equal(decision.rollback, false, "Should not rollback healthy rollout");
  assert.equal(decision.reasonCodes.length, 0, "Should have no reason codes");
});

test("E2E: auto-rollback accumulates multiple failure reasons", () => {
  const service = new AutoRollbackService({
    maxFailureRate: 0.05,
    maxLatencyMultiplier: 2,
    minimumRequestCount: 20,
    minimumObservationWindowMs: 60000,
  });

  const metrics: RolloutMetrics = {
    requestCount: 100,
    failureRate: 0.10, // 10% - exceeds
    p99LatencyMs: 300, // 3x - exceeds
    baselineP99LatencyMs: 100,
    observationWindowMs: 120000,
  };

  const decision = service.evaluate({} as RolloutRecord, metrics);

  assert.equal(decision.rollback, true, "Should rollback");
  assert.equal(decision.reasonCodes.length, 2, "Should have both reasons");
  assert.ok(decision.reasonCodes.includes("rollout.failure_rate_exceeded"));
  assert.ok(decision.reasonCodes.includes("rollout.latency_multiplier_exceeded"));
});

test("E2E: rollout state machine allows resume from paused state", () => {
  const machine = new RolloutStateMachine();
  const candidate = createCandidate({ status: "approved" });

  // Transition to L1_evaluate (approved -> evaluation_enabled)
  let record = machine.transition(candidate, "L1_evaluate");
  assert.equal(record.status, "evaluation_enabled");

  // Transition to L2_canary (L1_evaluate can go to L2_canary)
  record = machine.transition(candidate, "L2_canary", { currentStatus: "evaluation_enabled" });
  assert.equal(record.status, "canary_5");

  // Now transition to paused state
  record = machine.transition(candidate, "L2_canary", { currentStatus: "canary_5", targetStatus: "paused" });
  assert.equal(record.status, "paused");

  // Resume from paused - can go to many states including L2_canary
  const resumeRecord = machine.transition(candidate, "L2_canary", { currentStatus: "paused" });
  assert.equal(resumeRecord.status, "canary_5");
});

test("E2E: rollout state machine records approval in transition", () => {
  const machine = new RolloutStateMachine();
  const candidate = createCandidate({ status: "candidate_created" });

  const record = machine.transition(candidate, "L1_evaluate", {
    approvedBy: "senior-ops-42",
    strategyVersionId: "strategy-v2",
  });

  assert.equal(record.approvedBy, "senior-ops-42", "Should record approver");
  assert.equal(record.strategyVersionId, "strategy-v2", "Should record strategy version");
});

test("E2E: rollout state machine preserves evidence from candidate", () => {
  const machine = new RolloutStateMachine();
  const candidate = createCandidate({
    status: "canary_5",
    sourceSignalRefs: ["signal:perf-degradation", "signal:error-spike"],
  });

  const record = machine.transition(candidate, "L2_canary");

  assert.deepEqual(record.evidence, ["signal:perf-degradation", "signal:error-spike"], "Should preserve evidence");
});

test("E2E: auto-rollback uses custom configuration", () => {
  const service = new AutoRollbackService({
    maxFailureRate: 0.02, // Stricter threshold
    maxLatencyMultiplier: 1.5, // Stricter multiplier
    minimumRequestCount: 50,
    minimumObservationWindowMs: 120000,
  });

  // This would not trigger with defaults but should trigger with stricter config
  const metrics: RolloutMetrics = {
    requestCount: 50,
    failureRate: 0.03, // 3% - exceeds 2%
    p99LatencyMs: 200, // 2x baseline - exceeds 1.5x
    baselineP99LatencyMs: 100,
    observationWindowMs: 120000,
  };

  const decision = service.evaluate({} as RolloutRecord, metrics);

  assert.equal(decision.rollback, true, "Should trigger with stricter config");
});