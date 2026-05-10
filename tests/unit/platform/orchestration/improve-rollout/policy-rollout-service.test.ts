import assert from "node:assert/strict";
import test from "node:test";

import {
  PolicyRolloutService,
  type RolloutDecision,
  type MetricsGateDecision,
} from "../../../../../src/platform/orchestration/improve-rollout/policy-rollout-service.js";
import { AutoRollbackService, type RolloutMetrics } from "../../../../../src/platform/orchestration/improve-rollout/auto-rollback-service.js";
import type { ImprovementCandidate } from "../../../../../src/platform/orchestration/improve-rollout/improvement-candidate-registry.js";
import type { StrategyVersion } from "../../../../../src/platform/orchestration/improve-rollout/strategy-versioning.js";
import type { RolloutRecord } from "../../../../../src/platform/orchestration/oapeflir/types/rollout-record.js";

function makeCandidate(overrides: Partial<ImprovementCandidate> = {}): ImprovementCandidate {
  return {
    candidateId: "candidate-1",
    taskId: "task-1",
    sourceSignalRefs: ["signal-1"],
    sourceLearningObjectIds: ["lo-1"],
    learningObjectId: "lo-primary-1",
    guardrails: [],
    changeScope: "policy",
    description: "Test",
    expectedBenefit: "Test benefit",
    status: "approved",
    createdAt: Date.now(),
    ...overrides,
  };
}

function makeStrategyVersion(overrides: Partial<StrategyVersion> = {}): StrategyVersion {
  return {
    strategyVersionId: "sv-1",
    title: "Test Strategy",
    sourceLearningObjectIds: ["lo-1"],
    releaseLevel: "L1_evaluate",
    createdAt: Date.now(),
    ...overrides,
  };
}

function makeRecord(overrides: Partial<RolloutRecord> = {}): RolloutRecord {
  return {
    recordId: "record-1",
    candidateId: "candidate-1",
    level: "L1_evaluate",
    previousLevel: "L0_off",
    strategyVersionId: "sv-1",
    status: "evaluation_enabled",
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

test("PolicyRolloutService.decide allows when all checks pass", () => {
  const service = new PolicyRolloutService();
  const candidate = makeCandidate({
    status: "approved",
    sourceSignalRefs: ["signal-1"],
    sourceLearningObjectIds: ["lo-1"],
  });
  const strategyVersion = makeStrategyVersion({ releaseLevel: "L1_evaluate" });

  const decision = service.decide(candidate, strategyVersion);

  assert.equal(decision.allowed, true);
  assert.equal(decision.releaseLevel, "L1_evaluate");
});

test("PolicyRolloutService.decide blocks when candidate not approved for non-off level", () => {
  const service = new PolicyRolloutService();
  const candidate = makeCandidate({
    status: "proposed",
    sourceSignalRefs: ["signal-1"],
    sourceLearningObjectIds: ["lo-1"],
  });
  // Use a valid non-off release level - approval is now required for ALL non-off levels
  const strategyVersion = makeStrategyVersion({ releaseLevel: "L1_evaluate" });

  const decision = service.decide(candidate, strategyVersion);

  assert.equal(decision.allowed, false);
  // Approval check applies to all non-off levels (not just shadow)
  assert.equal(decision.reasonCode, "improvement.guardrail_requires_approval");
});

test("PolicyRolloutService.decide allows approved candidate for L1_evaluate", () => {
  const service = new PolicyRolloutService();
  const candidate = makeCandidate({
    status: "approved",
    sourceSignalRefs: ["signal-1"],
    sourceLearningObjectIds: ["lo-1"],
  });
  const strategyVersion = makeStrategyVersion({ releaseLevel: "L1_evaluate" });

  const decision = service.decide(candidate, strategyVersion);

  assert.equal(decision.allowed, true);
  assert.equal(decision.releaseLevel, "L1_evaluate");
});

test("PolicyRolloutService.decide returns guardrail blocked reason", () => {
  const service = new PolicyRolloutService();
  const candidate = makeCandidate({
    status: "approved",
    sourceSignalRefs: [],
  });
  const strategyVersion = makeStrategyVersion();

  const decision = service.decide(candidate, strategyVersion);

  assert.equal(decision.allowed, false);
  assert.equal(decision.reasonCode, "improvement.guardrail_missing_evidence");
});

test("PolicyRolloutService.start returns null when decide returns not allowed", () => {
  const service = new PolicyRolloutService();
  const candidate = makeCandidate({ status: "proposed" });
  const strategyVersion = makeStrategyVersion({ releaseLevel: "L1_evaluate" });

  const record = service.start(candidate, strategyVersion);

  assert.equal(record, null);
});

test("PolicyRolloutService.start creates rollout record when allowed", () => {
  const service = new PolicyRolloutService();
  const candidate = makeCandidate({ status: "approved" });
  const strategyVersion = makeStrategyVersion({ releaseLevel: "L1_evaluate" });

  const record = service.start(candidate, strategyVersion);

  assert.ok(record !== null);
  assert.equal(record.candidateId, "candidate-1");
  assert.equal(record.status, "evaluation_enabled");
});

test("PolicyRolloutService.start passes approvedBy to state machine", () => {
  const service = new PolicyRolloutService();
  const candidate = makeCandidate({ status: "approved" });
  const strategyVersion = makeStrategyVersion({ releaseLevel: "L1_evaluate" });

  const record = service.start(candidate, strategyVersion, "approver-1");

  assert.ok(record !== null);
  assert.equal(record.approvedBy, "approver-1");
});

test("PolicyRolloutService.promote throws when metrics gate blocks", () => {
  const service = new PolicyRolloutService();
  const candidate = makeCandidate();
  const current = makeRecord({ status: "canary_5" });

  // promote from canary_5 to partial_25 requires metrics, and without metrics it throws
  assert.throws(
    () => service.promote(candidate, current, "partial_25"),
    /rollout.metrics_required/,
  );
});

test("PolicyRolloutService.promote returns record when gate passes", () => {
  const service = new PolicyRolloutService();
  const candidate = makeCandidate();
  const current = makeRecord({ status: "evaluation_enabled", transitionedAt: Date.now() - 10000 });
  const metrics = makeMetrics({ failureRate: 0.01 });

  const record = service.promote(candidate, current, "canary_5", metrics);

  assert.equal(record.status, "canary_5");
});

test("PolicyRolloutService.promote triggers rollback when metrics trigger rollback", () => {
  const service = new PolicyRolloutService();
  const candidate = makeCandidate();
  const current = makeRecord({ status: "canary_5", transitionedAt: Date.now() - 10000 });
  const metrics = makeMetrics({ failureRate: 0.50 });

  const record = service.promote(candidate, current, "partial_25", metrics);

  assert.equal(record.status, "rolled_back");
});

test("PolicyRolloutService.rollback creates rolled_back record", () => {
  const service = new PolicyRolloutService();
  const candidate = makeCandidate();
  const current = makeRecord({ status: "canary_5" });
  const metrics = makeMetrics({ failureRate: 0.50 });

  const record = service.rollback(candidate, current, metrics);

  assert.equal(record.status, "rolled_back");
});

test("PolicyRolloutService.evaluateMetricsGate returns allowed for non-progressive statuses", () => {
  const service = new PolicyRolloutService();
  const current = makeRecord({ status: "evaluation_enabled" });

  const gate = service.evaluateMetricsGate(current, "rejected");

  assert.equal(gate.allowed, true);
});

test("PolicyRolloutService.evaluateMetricsGate returns allowed for evaluation_enabled current status", () => {
  const service = new PolicyRolloutService();
  const current = makeRecord({ status: "evaluation_enabled" });

  const gate = service.evaluateMetricsGate(current, "canary_5", makeMetrics());

  assert.equal(gate.allowed, true);
});

test("PolicyRolloutService.evaluateMetricsGate requires metrics for progressive statuses", () => {
  const service = new PolicyRolloutService();
  const current = makeRecord({ status: "canary_5" });

  const gate = service.evaluateMetricsGate(current, "partial_25");

  assert.equal(gate.allowed, false);
  assert.ok(gate.reasonCodes.includes("rollout.metrics_required"));
});

test("PolicyRolloutService.evaluateMetricsGate triggers rollback on bad metrics", () => {
  const service = new PolicyRolloutService();
  const current = makeRecord({ status: "canary_5" });
  const metrics = makeMetrics({ failureRate: 0.50 });

  const gate = service.evaluateMetricsGate(current, "partial_25", metrics);

  assert.equal(gate.allowed, false);
  assert.equal(gate.rollback, true);
});

test("PolicyRolloutService.evaluateMetricsGate passes when metrics good", () => {
  const service = new PolicyRolloutService();
  const current = makeRecord({ status: "canary_5" });
  const metrics = makeMetrics({ failureRate: 0.01 });

  const gate = service.evaluateMetricsGate(current, "partial_25", metrics);

  assert.equal(gate.allowed, true);
  assert.equal(gate.rollback, false);
});

test("PolicyRolloutService can progress through all rollout stages", () => {
  const service = new PolicyRolloutService();
  let candidate = makeCandidate({ status: "approved" });
  let record = service.start(candidate, makeStrategyVersion({ releaseLevel: "L1_evaluate" }));

  assert.ok(record);
  assert.equal(record.status, "evaluation_enabled");

  const stages: Array<{ target: RolloutRecord["status"]; level: StrategyVersion["releaseLevel"] }> = [
    { target: "canary_5", level: "L2_canary" },
    { target: "partial_25", level: "L3_partial" },
    { target: "stable_75", level: "L4_stable" },
    { target: "stable_100", level: "L5_full" },
    { target: "released", level: "L5_full" },
  ];

  for (const { target, level } of stages) {
    const metrics = makeMetrics();
    record = service.promote(candidate, record, target, metrics);
    assert.equal(record.status, target, `Failed at ${target}`);
  }
});

test("PolicyRolloutService.evaluateMetricsGate with stable_75 status", () => {
  const service = new PolicyRolloutService();
  const current = makeRecord({ status: "stable_75" });
  const metrics = makeMetrics();

  // stable_75->stable_100 still requires metrics since stable_75 is a progressive status
  const gate = service.evaluateMetricsGate(current, "stable_100", metrics);

  assert.equal(gate.allowed, true);
});

test("PolicyRolloutService.inferLevelFromStatus handles all statuses correctly", () => {
  const service = new PolicyRolloutService();
  const candidate = makeCandidate();
  const current = makeRecord({ status: "partial_50" });

  // Test that promote to draft (which is invalid) throws from state machine
  assert.throws(
    () => service.promote(candidate, current, "draft", makeMetrics()),
    /Invalid rollout transition/,
  );
});
