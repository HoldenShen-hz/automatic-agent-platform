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

import { RolloutStateMachine } from "../../src/platform/orchestration/oapeflir/improve-rollout/rollout/rollout-state-machine.js";
import { AutoRollbackService } from "../../src/platform/orchestration/oapeflir/improve-rollout/auto-rollback-service.js";
import { parseImprovementCandidate } from "../../src/platform/orchestration/oapeflir/types/improvement-candidate.js";
import type { ImprovementCandidate } from "../../src/platform/orchestration/oapeflir/types/improvement-candidate.js";
import type { RolloutMetrics } from "../../src/platform/orchestration/oapeflir/improve-rollout/auto-rollback-service.js";
import type { RolloutRecord } from "../../src/platform/orchestration/oapeflir/types/rollout-record.js";

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
    status: "proposed",
    createdAt: Date.now(),
    ...overrides,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// E2E Rollback Scenario Tests
// ─────────────────────────────────────────────────────────────────────────────

test("E2E: rollout state machine transitions from shadow to canary_5", () => {
  const machine = new RolloutStateMachine();
  const candidate = createCandidate({ status: "approved" });

  const record = machine.transition(candidate, "canary_5");

  assert.equal(record.level, "canary_5", "Should transition to canary_5 level");
  assert.equal(record.previousLevel, "shadow", "Previous level should be shadow");
  assert.equal(record.status, "canary_5", "Status should match level");
  assert.ok(record.recordId, "Should have record ID");
  assert.ok(record.transitionedAt, "Should have transition timestamp");
});

test("E2E: rollout state machine allows rollback from canary to shadow", () => {
  const machine = new RolloutStateMachine();
  const candidate = createCandidate({ status: "shadow_running" });

  // Canary running but needs rollback
  const record = machine.transition(candidate, "shadow", {
    guardrailReasonCodes: ["rollout.failure_rate_exceeded"],
  });

  assert.equal(record.level, "shadow", "Should rollback to shadow");
  assert.equal(record.status, "rolled_back", "Should be marked as rolled_back");
  assert.ok(record.guardrailReasonCodes.includes("rollout.failure_rate_exceeded"), "Should record reason");
});

test("E2E: rollout state machine rejects invalid transition", () => {
  const machine = new RolloutStateMachine();
  const candidate = createCandidate({ status: "rejected" });

  assert.throws(
    () => machine.transition(candidate, "canary_5"),
    /invalid transition/i,
    "Should reject invalid transition from rejected status",
  );
});

test("E2E: rollout state machine advances through all phases", () => {
  const machine = new RolloutStateMachine();

  // Draft -> Shadow
  let candidate = createCandidate({ status: "proposed" });
  let record = machine.transition(candidate, "shadow", { approvedBy: "admin-1" });
  assert.equal(record.status, "shadow");

  // Shadow -> Canary 5
  candidate = createCandidate({ status: "shadow_running" });
  record = machine.transition(candidate, "canary_5");
  assert.equal(record.status, "canary_5");

  // Canary 5 -> Partial 25
  candidate = createCandidate({ status: "approved" });
  record = machine.transition(candidate, "partial_25");
  assert.equal(record.status, "partial_25");

  // Partial 25 -> Partial 50
  candidate = createCandidate({ status: "approved" });
  record = machine.transition(candidate, "partial_50");
  assert.equal(record.status, "partial_50");

  // Partial 50 -> Partial 75
  candidate = createCandidate({ status: "approved" });
  record = machine.transition(candidate, "partial_75");
  assert.equal(record.status, "partial_75");

  // Partial 75 -> Stable
  candidate = createCandidate({ status: "approved" });
  record = machine.transition(candidate, "stable");
  assert.equal(record.status, "stable");
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

  // Pause at canary_5
  let record = machine.transition(candidate, "canary_5");
  assert.equal(record.status, "canary_5");

  // Pause it
  record = machine.transition(candidate, "canary_5", { targetStatus: "paused" });
  assert.equal(record.status, "paused");

  // Resume from paused - can go to many states
  const resumeRecord = machine.transition(candidate, "partial_25", { currentStatus: "paused" });
  assert.equal(resumeRecord.status, "partial_25");
});

test("E2E: rollout state machine records approval in transition", () => {
  const machine = new RolloutStateMachine();
  const candidate = createCandidate({ status: "proposed" });

  const record = machine.transition(candidate, "shadow", {
    approvedBy: "senior-ops-42",
    strategyVersionId: "strategy-v2",
  });

  assert.equal(record.approvedBy, "senior-ops-42", "Should record approver");
  assert.equal(record.strategyVersionId, "strategy-v2", "Should record strategy version");
});

test("E2E: rollout state machine preserves evidence from candidate", () => {
  const machine = new RolloutStateMachine();
  const candidate = createCandidate({
    sourceSignalRefs: ["signal:perf-degradation", "signal:error-spike"],
  });

  const record = machine.transition(candidate, "canary_5");

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