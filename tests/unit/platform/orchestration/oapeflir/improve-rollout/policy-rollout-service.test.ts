import test from "node:test";
import assert from "node:assert/strict";

import { AutoRollbackService } from "../../../../../../src/platform/five-plane-orchestration/oapeflir/improve-rollout/auto-rollback-service.js";
import { PolicyRolloutService } from "../../../../../../src/platform/five-plane-orchestration/oapeflir/improve-rollout/policy-rollout-service.js";
import type { RolloutRecord, RolloutStatus } from "../../../../../../src/platform/five-plane-orchestration/oapeflir/types/rollout-record.js";
import type { RolloutMetrics } from "../../../../../../src/platform/five-plane-orchestration/oapeflir/improve-rollout/auto-rollback-service.js";
import type { ImprovementCandidate } from "../../../../../../src/platform/five-plane-orchestration/oapeflir/improve-rollout/improvement-candidate-registry.js";
import type { StrategyVersion } from "../../../../../../src/platform/five-plane-orchestration/oapeflir/improve-rollout/strategy-versioning.js";
import { rolloutFreezeManager } from "../../../../../../src/platform/shared/observability/rollout-freeze-manager.js";

// Helper to run test with frozen rollout state
function withFrozenRollouts(fn: () => void): void {
  rolloutFreezeManager.freeze("test_slo");
  try {
    fn();
  } finally {
    rolloutFreezeManager.unfreeze();
  }
}

function createMinimalCandidate(overrides: Partial<ImprovementCandidate> = {}): ImprovementCandidate {
  return {
    candidateId: "candidate_test",
    taskId: "task_test",
    sourceSignalRefs: ["signal_1"],
    sourceLearningObjectIds: ["lo_1"],
    changeScope: "policy",
    description: "Test candidate",
    expectedBenefit: "Test benefit",
    status: "approved",
    createdAt: Date.now(),
    ...overrides,
  };
}

function createStrategyVersion(overrides: Partial<StrategyVersion> = {}): StrategyVersion {
  return {
    strategyVersionId: "strategy_test",
    title: "Test Strategy",
    sourceLearningObjectIds: ["lo_1"],
    releaseLevel: "stable",
    createdAt: Date.now(),
    ...overrides,
  };
}

function createRolloutRecord(overrides: Partial<RolloutRecord> = {}): RolloutRecord {
  return {
    recordId: "rollout_test",
    candidateId: "candidate_test",
    level: "stable",
    previousLevel: "off",
    strategyVersionId: "strategy_test",
    status: "stable",
    transitionedAt: Date.now(),
    guardrailReasonCodes: [],
    evidence: [],
    ...overrides,
  };
}

function createHealthyMetrics(): RolloutMetrics {
  return {
    requestCount: 100,
    failureRate: 0.01,
    p99LatencyMs: 55,
    baselineP99LatencyMs: 50,
    observationWindowMs: 120_000,
  };
}

function createFailingMetrics(): RolloutMetrics {
  return {
    requestCount: 100,
    failureRate: 0.1, // 10% failure rate exceeds 5% threshold
    p99LatencyMs: 200,
    baselineP99LatencyMs: 50,
    observationWindowMs: 120_000,
  };
}

// =============================================================================
// evaluateMetricsGate tests
// =============================================================================

test("evaluateMetricsGate rejects non-evaluation targets when metrics are missing", () => {
  const service = new PolicyRolloutService();
  const record = createRolloutRecord({ status: "rejected" });

  const result = service.evaluateMetricsGate(record, "rejected");

  assert.equal(result.allowed, false);
  assert.equal(result.rollback, false);
  assert.deepEqual(result.reasonCodes, ["rollout.metrics_required"]);
});

test("evaluateMetricsGate allows when current status is shadow", () => {
  const service = new PolicyRolloutService();
  const record = createRolloutRecord({ status: "shadow" });

  // shadow status always allows progression regardless of metrics
  const result = service.evaluateMetricsGate(record, "canary_5", createHealthyMetrics());

  assert.equal(result.allowed, true);
  assert.equal(result.rollback, false);
});

test("evaluateMetricsGate blocks when metrics missing for progressive status", () => {
  const service = new PolicyRolloutService();
  const record = createRolloutRecord({ status: "canary_5" });

  // progressive promotion requires metrics
  const result = service.evaluateMetricsGate(record, "partial_25");

  assert.equal(result.allowed, false);
  assert.equal(result.rollback, false);
  assert.ok(result.reasonCodes.includes("rollout.metrics_required"));
});

test("evaluateMetricsGate triggers rollback when metrics indicate failure", () => {
  const service = new PolicyRolloutService();
  const record = createRolloutRecord({ status: "canary_5" });
  const failingMetrics = createFailingMetrics();

  const result = service.evaluateMetricsGate(record, "partial_25", failingMetrics);

  assert.equal(result.allowed, false);
  assert.equal(result.rollback, true);
  assert.ok(result.reasonCodes.some(code => code.includes("failure_rate")));
});

test("evaluateMetricsGate allows when metrics are healthy", () => {
  const service = new PolicyRolloutService();
  const record = createRolloutRecord({ status: "canary_5" });
  const healthyMetrics = createHealthyMetrics();

  const result = service.evaluateMetricsGate(record, "partial_25", healthyMetrics);

  assert.equal(result.allowed, true);
  assert.equal(result.rollback, false);
  assert.ok(result.reasonCodes.includes("rollout.metrics_gate_passed"));
});

// =============================================================================
// promote tests
// =============================================================================

test("promote throws when metrics gate blocks without rollback", () => {
  const service = new PolicyRolloutService();
  const candidate = createMinimalCandidate();
  const record = createRolloutRecord({ status: "canary_5" });

  // partial_25 requires metrics, but none provided → should throw
  assert.throws(
    () => service.promote(candidate, record, "partial_25"),
    /rollout.metrics_required/
  );
});

test("promote triggers rollback when metrics gate rejects with rollback flag", () => {
  const autoRollback = new AutoRollbackService({ maxFailureRate: 0.05 });
  const service = new PolicyRolloutService(autoRollback);
  const candidate = createMinimalCandidate();
  const record = createRolloutRecord({ status: "canary_5" });
  const failingMetrics = createFailingMetrics();

  const result = service.promote(candidate, record, "partial_25", failingMetrics);

  assert.equal(result.status, "rolled_back");
});

test("promote succeeds when metrics gate allows", () => {
  const service = new PolicyRolloutService();
  const candidate = createMinimalCandidate();
  const record = createRolloutRecord({ status: "canary_5" });
  const healthyMetrics = createHealthyMetrics();

  const result = service.promote(candidate, record, "partial_25", healthyMetrics);

  assert.equal(result.status, "partial_25");
  assert.equal(result.level, "partial_25");
});

// =============================================================================
// rollback tests
// =============================================================================

test("rollback transitions to rolled_back status", () => {
  const service = new PolicyRolloutService();
  const candidate = createMinimalCandidate();
  const record = createRolloutRecord({ status: "canary_5" });
  const metrics = createHealthyMetrics();

  const result = service.rollback(candidate, record, metrics);

  assert.equal(result.status, "rolled_back");
  assert.equal(result.level, "off");
});

test("rollback uses provided approvedBy", () => {
  const service = new PolicyRolloutService();
  const candidate = createMinimalCandidate();
  const record = createRolloutRecord({ status: "canary_5" });
  const metrics = createHealthyMetrics();

  const result = service.rollback(candidate, record, metrics, "admin_user");

  assert.equal(result.approvedBy, "admin_user");
});

// =============================================================================
// decide tests - additional branches
// =============================================================================

test("decide allows when guardrails pass and candidate approved", () => {
  const service = new PolicyRolloutService();
  const candidate = createMinimalCandidate({
    sourceSignalRefs: ["signal_1"],
    sourceLearningObjectIds: ["lo_1"],
  });
  const strategy = createStrategyVersion({
    sourceLearningObjectIds: ["lo_1"],
    releaseLevel: "canary_5",
  });

  const result = service.decide(candidate, strategy);

  assert.equal(result.allowed, true);
  assert.equal(result.releaseLevel, "canary_5");
});

test("decide blocks when candidate not approved but strategy is shadow", () => {
  const service = new PolicyRolloutService();
  // Set status to something that passes guardrail (not missing evidence)
  // but is not "approved" and not "shadow_running"
  const candidate = createMinimalCandidate({
    status: "proposed",
    sourceSignalRefs: ["signal_1"],
    sourceLearningObjectIds: ["lo_1"],
  });
  const strategy = createStrategyVersion({
    sourceLearningObjectIds: ["lo_1"],
    releaseLevel: "shadow",
  });

  const result = service.decide(candidate, strategy);

  // When shadow release with non-approved status, guardrail adds this reason
  assert.equal(result.allowed, false);
  assert.ok(result.reasonCodes.some(code => code.includes("shadow_requires_approval") || code.includes("candidate_not_approved")));
});

test("decide allows shadow with approved candidate", () => {
  const service = new PolicyRolloutService();
  const candidate = createMinimalCandidate({
    status: "approved",
    sourceSignalRefs: ["signal_1"],
    sourceLearningObjectIds: ["lo_1"],
  });
  const strategy = createStrategyVersion({
    sourceLearningObjectIds: ["lo_1"],
    releaseLevel: "shadow",
  });

  const result = service.decide(candidate, strategy);

  assert.equal(result.allowed, true);
  assert.equal(result.releaseLevel, "shadow");
});

test("decide forces non-approved shadow candidates fully off", () => {
  // This test exercises lines 48-55: when candidate.status !== "approved" && releaseLevel === "shadow"
  // shadow_running passes the guardrail (line 22) but fails the direct check at line 48
  const service = new PolicyRolloutService();
  const candidate = createMinimalCandidate({
    status: "shadow_running",
    sourceSignalRefs: ["signal_1"],
    sourceLearningObjectIds: ["lo_1"],
  });
  const strategy = createStrategyVersion({
    sourceLearningObjectIds: ["lo_1"],
    releaseLevel: "shadow",
  });

  const result = service.decide(candidate, strategy);

  assert.equal(result.allowed, false);
  assert.equal(result.releaseLevel, "off");
  assert.ok(result.reasonCodes.includes("improvement.candidate_not_approved"));
});

test("decide blocks when rollouts are frozen due to error budget exhaustion", () => {
  withFrozenRollouts(() => {
    const service = new PolicyRolloutService();
    const candidate = createMinimalCandidate({
      status: "approved",
      sourceSignalRefs: ["signal_1"],
      sourceLearningObjectIds: ["lo_1"],
    });
    const strategy = createStrategyVersion({
      sourceLearningObjectIds: ["lo_1"],
      releaseLevel: "canary_5",
    });

    const result = service.decide(candidate, strategy);

    assert.equal(result.allowed, false);
    assert.ok(result.reasonCodes.some(code => code.includes("frozen_error_budget")));
  });
});

test("decide returns rollout.frozen_error_budget reason code when frozen", () => {
  withFrozenRollouts(() => {
    const service = new PolicyRolloutService();
    const candidate = createMinimalCandidate({
      status: "approved",
      sourceSignalRefs: ["signal_1"],
      sourceLearningObjectIds: ["lo_1"],
    });
    const strategy = createStrategyVersion({
      sourceLearningObjectIds: ["lo_1"],
      releaseLevel: "partial_25",
    });

    const result = service.decide(candidate, strategy);

    assert.equal(result.allowed, false);
    assert.ok(result.reasonCodes.some(code => code.includes("frozen_error_budget")));
  });
});

// =============================================================================
// start tests
// =============================================================================

test("start returns null when decide returns not allowed", () => {
  const service = new PolicyRolloutService();
  const candidate = createMinimalCandidate({
    status: "proposed",
  });
  const strategy = createStrategyVersion({
    sourceLearningObjectIds: [],
    releaseLevel: "shadow",
  });

  const result = service.start(candidate, strategy, "operator");

  assert.equal(result, null);
});

test("start creates rollout record when decide allows", () => {
  const service = new PolicyRolloutService();
  const candidate = createMinimalCandidate({
    status: "approved",
    sourceSignalRefs: ["signal_1"],
    sourceLearningObjectIds: ["lo_1"],
  });
  const strategy = createStrategyVersion({
    sourceLearningObjectIds: ["lo_1"],
    releaseLevel: "shadow",
  });

  const result = service.start(candidate, strategy, "operator");

  assert.ok(result !== null);
  assert.equal(result!.status, "shadow");
  assert.equal(result!.approvedBy, "operator");
});

// =============================================================================
// inferLevelFromStatus coverage - all statuses
// =============================================================================

test("evaluateMetricsGate blocks metric-free non-evaluation targets", () => {
  const service = new PolicyRolloutService();
  const record = createRolloutRecord({ status: "draft" });
  assert.deepEqual(service.evaluateMetricsGate(record, "rejected"), {
    allowed: false,
    rollback: false,
    reasonCodes: ["rollout.metrics_required"],
  });
});

test("evaluateMetricsGate only defers metrics for evaluation_enabled", () => {
  const service = new PolicyRolloutService();
  const record = createRolloutRecord({ status: "pending_approval" });
  assert.deepEqual(service.evaluateMetricsGate(record, "evaluation_enabled"), {
    allowed: true,
    rollback: false,
    reasonCodes: ["rollout.metrics_deferred_for_evaluation"],
  });
  assert.deepEqual(service.evaluateMetricsGate(record, "pending_approval"), {
    allowed: false,
    rollback: false,
    reasonCodes: ["rollout.metrics_required"],
  });
});

test("inferLevelFromStatus maps progressive statuses correctly", () => {
  const service = new PolicyRolloutService();
  const candidate = createMinimalCandidate();
  const healthyMetrics = createHealthyMetrics();

  // These are valid promote targets (excludes draft, rejected, rolled_back, paused)
  type PromoteTarget = "pending_approval" | "shadow" | "canary_5" | "partial_25" | "partial_50" | "partial_75" | "stable";

  const progressiveTransitions: Array<{ from: RolloutStatus; to: PromoteTarget; expectedLevel: string }> = [
    { from: "shadow", to: "canary_5", expectedLevel: "canary_5" },
    { from: "canary_5", to: "partial_25", expectedLevel: "partial_25" },
    { from: "partial_25", to: "partial_50", expectedLevel: "partial_50" },
    { from: "partial_50", to: "partial_75", expectedLevel: "partial_75" },
    { from: "partial_75", to: "stable", expectedLevel: "stable" },
  ];

  for (const transition of progressiveTransitions) {
    const record = createRolloutRecord({ status: transition.from });
    const result = service.promote(candidate, record, transition.to, healthyMetrics);
    assert.equal(
      result.level,
      transition.expectedLevel,
      `${transition.from} -> ${transition.to} should yield level ${transition.expectedLevel}`
    );
  }
});

test("promote to pending_approval requires explicit metrics", () => {
  const service = new PolicyRolloutService();
  const candidate = createMinimalCandidate();
  const record = createRolloutRecord({ status: "draft" });

  assert.throws(() => service.promote(candidate, record, "pending_approval", undefined), /rollout.metrics_required/);
});

test("promote to shadow requires explicit metrics", () => {
  const service = new PolicyRolloutService();
  const candidate = createMinimalCandidate();
  const record = createRolloutRecord({ status: "draft" });

  assert.throws(() => service.promote(candidate, record, "shadow", undefined), /rollout.metrics_required/);
});

// =============================================================================
// inferStatusFromLevel coverage - all levels
// =============================================================================

test("inferStatusFromLevel maps suggest to pending_approval when metrics are present", () => {
  const service = new PolicyRolloutService();
  const candidate = createMinimalCandidate();
  const record = createRolloutRecord({ status: "draft" });
  const metrics = createHealthyMetrics();

  const result = service.promote(candidate, record, "pending_approval", metrics);
  assert.equal(result.level, "suggest");
  assert.equal(result.status, "pending_approval");
});

test("inferStatusFromLevel maps canary_5, partial_25, partial_50, partial_75, stable via valid transitions", () => {
  const service = new PolicyRolloutService();
  const candidate = createMinimalCandidate();
  const healthyMetrics = createHealthyMetrics();

  // shadow -> canary_5 is valid
  const r1 = createRolloutRecord({ status: "shadow" });
  const result1 = service.promote(candidate, r1, "canary_5", healthyMetrics);
  assert.equal(result1.level, "canary_5");

  // canary_5 -> partial_25 is valid
  const r2 = createRolloutRecord({ status: "canary_5" });
  const result2 = service.promote(candidate, r2, "partial_25", healthyMetrics);
  assert.equal(result2.level, "partial_25");

  // partial_25 -> partial_50 is valid
  const r3 = createRolloutRecord({ status: "partial_25" });
  const result3 = service.promote(candidate, r3, "partial_50", healthyMetrics);
  assert.equal(result3.level, "partial_50");

  // partial_50 -> partial_75 is valid
  const r4 = createRolloutRecord({ status: "partial_50" });
  const result4 = service.promote(candidate, r4, "partial_75", healthyMetrics);
  assert.equal(result4.level, "partial_75");

  // partial_75 -> stable is valid
  const r5 = createRolloutRecord({ status: "partial_75" });
  const result5 = service.promote(candidate, r5, "stable", healthyMetrics);
  assert.equal(result5.level, "stable");
});

// =============================================================================
// inferLevelFromStatus coverage - all statuses including terminal and progressive
// =============================================================================

test("evaluateMetricsGate allows terminal self-transitions when metrics are present", () => {
  const service = new PolicyRolloutService();
  const metrics = createHealthyMetrics();

  const terminalStatuses: RolloutStatus[] = ["rejected", "rolled_back", "paused"];
  for (const status of terminalStatuses) {
    const record = createRolloutRecord({ status });
    const result = service.evaluateMetricsGate(record, status, metrics);
    assert.equal(result.allowed, true, `Status ${status} should allow self-transition`);
  }
});

test("inferLevelFromStatus maps pending_approval to suggest", () => {
  const service = new PolicyRolloutService();
  const candidate = createMinimalCandidate();
  const record = createRolloutRecord({ status: "draft" });
  const metrics = createHealthyMetrics();

  const result = service.promote(candidate, record, "pending_approval", metrics);
  assert.equal(result.level, "suggest");
});

test("inferLevelFromStatus maps all progressive statuses", () => {
  const service = new PolicyRolloutService();
  const candidate = createMinimalCandidate();
  const healthyMetrics = createHealthyMetrics();

  const progressiveStatuses: Array<{ from: RolloutStatus; to: Exclude<RolloutStatus, "draft" | "rejected" | "rolled_back" | "paused">; expectedLevel: string }> = [
    { from: "shadow", to: "canary_5", expectedLevel: "canary_5" },
    { from: "canary_5", to: "partial_25", expectedLevel: "partial_25" },
    { from: "partial_25", to: "partial_50", expectedLevel: "partial_50" },
    { from: "partial_50", to: "partial_75", expectedLevel: "partial_75" },
    { from: "partial_75", to: "stable", expectedLevel: "stable" },
  ];

  for (const { from, to, expectedLevel } of progressiveStatuses) {
    const record = createRolloutRecord({ status: from });
    const result = service.promote(candidate, record, to, healthyMetrics);
    assert.equal(result.level, expectedLevel, `${from} -> ${to} should yield ${expectedLevel}`);
  }
});

// =============================================================================
// evaluateMetricsGate additional branches
// =============================================================================

test("evaluateMetricsGate still blocks metric-free non-progressive targets", () => {
  const service = new PolicyRolloutService();
  const record = createRolloutRecord({ status: "stable" });
  const result = service.evaluateMetricsGate(record, "rejected");

  assert.equal(result.allowed, false);
  assert.equal(result.rollback, false);
  assert.ok(result.reasonCodes.includes("rollout.metrics_required"));
});

test("evaluateMetricsGate returns early when current status is shadow", () => {
  const service = new PolicyRolloutService();
  const record = createRolloutRecord({ status: "shadow" });

  // shadow always allows progression
  const result = service.evaluateMetricsGate(record, "canary_5", createHealthyMetrics());

  assert.equal(result.allowed, true);
  assert.equal(result.rollback, false);
});

test("evaluateMetricsGate blocks pending_approval without metrics", () => {
  const service = new PolicyRolloutService();
  const record = createRolloutRecord({ status: "stable" });
  const result = service.evaluateMetricsGate(record, "pending_approval");

  assert.equal(result.allowed, false);
  assert.ok(result.reasonCodes.includes("rollout.metrics_required"));
});

test("evaluateMetricsGate returns rollback=false when autoRollback returns rollback=false", () => {
  const autoRollback = new AutoRollbackService({
    maxFailureRate: 0.05,
    maxLatencyMultiplier: 2,
    minimumRequestCount: 20,
    minimumObservationWindowMs: 60_000,
  });
  const service = new PolicyRolloutService(autoRollback);
  const record = createRolloutRecord({ status: "canary_5" });
  const healthyMetrics = createHealthyMetrics();

  const result = service.evaluateMetricsGate(record, "partial_25", healthyMetrics);

  assert.equal(result.allowed, true);
  assert.equal(result.rollback, false);
  assert.ok(result.reasonCodes.includes("rollout.metrics_gate_passed"));
});
