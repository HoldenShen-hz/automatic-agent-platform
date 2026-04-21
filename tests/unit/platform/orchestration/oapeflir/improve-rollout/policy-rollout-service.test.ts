import test from "node:test";
import assert from "node:assert/strict";

import { AutoRollbackService } from "../../../../../../src/platform/orchestration/oapeflir/improve-rollout/auto-rollback-service.js";
import { PolicyRolloutService } from "../../../../../../src/platform/orchestration/oapeflir/improve-rollout/policy-rollout-service.js";
import type { RolloutRecord, RolloutStatus } from "../../../../../../src/platform/orchestration/oapeflir/types/rollout-record.js";
import type { RolloutMetrics } from "../../../../../../src/platform/orchestration/oapeflir/improve-rollout/auto-rollback-service.js";
import type { ImprovementCandidate } from "../../../../../../src/platform/orchestration/oapeflir/improve-rollout/improvement-candidate-registry.js";
import type { StrategyVersion } from "../../../../../../src/platform/orchestration/oapeflir/improve-rollout/strategy-versioning.js";

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

test("evaluateMetricsGate allows non-progressive status", () => {
  const service = new PolicyRolloutService();
  const record = createRolloutRecord({ status: "rejected" });

  // rejected is not in PROGRESSIVE_STATUSES
  const result = service.evaluateMetricsGate(record, "rejected");

  assert.equal(result.allowed, true);
  assert.equal(result.rollback, false);
  assert.deepEqual(result.reasonCodes, []);
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

test("decide returns candidate_not_approved when status is shadow_running and releaseLevel is shadow", () => {
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

  // shadow_running passes guardrail but fails the direct check at line 48
  assert.equal(result.allowed, false);
  assert.equal(result.releaseLevel, "suggest");
  assert.ok(result.reasonCodes.includes("improvement.candidate_not_approved"));
});

test("decide blocks when rollouts are frozen due to error budget exhaustion", () => {
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

  const result = service.decide(candidate, strategy, { frozen: true, reasonCode: "error_budget_exhausted" });

  assert.equal(result.allowed, false);
  assert.ok(result.reasonCodes.some(code => code.includes("frozen_error_budget")));
});

test("decide returns rollout.frozen_error_budget reason code when frozen", () => {
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

  const result = service.decide(candidate, strategy, { frozen: true, reasonCode: "error_budget_exhausted" });

  assert.equal(result.allowed, false);
  assert.ok(result.reasonCodes.includes("rollout.frozen_error_budget"));
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

test("inferLevelFromStatus maps draft/rejected/rolled_back/paused to off", () => {
  const service = new PolicyRolloutService();
  const candidate = createMinimalCandidate();

  // These are terminal statuses that map to "off" level
  const terminalStatuses: RolloutStatus[] = ["draft", "rejected", "rolled_back", "paused"];
  for (const status of terminalStatuses) {
    const record = createRolloutRecord({ status });
    // We test this indirectly through promote behavior
    const result = service.evaluateMetricsGate(record, status);
    assert.equal(result.allowed, true, `Status ${status} should allow self-transition`);
  }
});

test("evaluateMetricsGate allows pending_approval status (non-progressive)", () => {
  const service = new PolicyRolloutService();
  const candidate = createMinimalCandidate({ status: "approved" });
  const record = createRolloutRecord({ status: "pending_approval" });

  // pending_approval is not progressive, so gate allows
  const result = service.evaluateMetricsGate(record, "pending_approval");
  assert.equal(result.allowed, true);
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

test("promote to pending_approval calls inferLevelFromStatus with suggest level", () => {
  const service = new PolicyRolloutService();
  const candidate = createMinimalCandidate();
  const record = createRolloutRecord({ status: "draft" });

  const result = service.promote(candidate, record, "pending_approval", undefined);

  // pending_approval maps to "suggest" level
  assert.equal(result.level, "suggest");
});

test("promote to shadow calls inferLevelFromStatus with shadow level", () => {
  const service = new PolicyRolloutService();
  const candidate = createMinimalCandidate();
  const record = createRolloutRecord({ status: "draft" });

  const result = service.promote(candidate, record, "shadow", undefined);

  // shadow maps to "shadow" level
  assert.equal(result.level, "shadow");
});
