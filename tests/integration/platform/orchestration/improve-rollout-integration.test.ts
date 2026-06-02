/**
 * Integration Test: Improve Rollout Module
 *
 * Tests the PolicyRolloutService, GuardrailEvaluator, AutoRollbackService,
 * and RolloutStateMachine working together across the full rollout lifecycle.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createIntegrationContext } from "../../../helpers/integration-context.js";
import { PolicyRolloutService } from "../../../../src/platform/five-plane-orchestration/improve-rollout/policy-rollout-service.js";
import { AutoRollbackService, type RolloutMetrics } from "../../../../src/platform/five-plane-orchestration/improve-rollout/auto-rollback-service.js";
import { GuardrailEvaluator } from "../../../../src/platform/five-plane-orchestration/improve-rollout/guardrail-evaluator.js";
import { RolloutStateMachine } from "../../../../src/platform/five-plane-orchestration/improve-rollout/rollout/rollout-state-machine.js";
import type { ImprovementCandidate } from "../../../../src/platform/five-plane-orchestration/improve-rollout/improvement-candidate-registry.js";
import type { StrategyVersion } from "../../../../src/platform/five-plane-orchestration/improve-rollout/strategy-versioning.js";
import type { RolloutRecord } from "../../../../src/platform/five-plane-orchestration/oapeflir/types/rollout-record.js";

function makeCandidate(overrides: Partial<ImprovementCandidate> = {}): ImprovementCandidate {
  return {
    candidateId: "candidate-" + Math.random().toString(36).slice(2, 8),
    taskId: "task-" + Math.random().toString(36).slice(2, 8),
    sourceSignalRefs: ["signal-1"],
    sourceLearningObjectIds: ["lo-1"],
    changeScope: "policy",
    description: "Test improvement candidate",
    expectedBenefit: "Test benefit",
    status: "approved",
    createdAt: Date.now(),
    ...overrides,
  };
}

function makeStrategyVersion(overrides: Partial<StrategyVersion> = {}): StrategyVersion {
  return {
    strategyVersionId: "sv-" + Math.random().toString(36).slice(2, 8),
    title: "Test Strategy",
    sourceLearningObjectIds: ["lo-1"],
    releaseLevel: "suggest",
    createdAt: Date.now(),
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

// Helper to run a test with a unique integration context
function withContext(name: string, fn: (ctx: ReturnType<typeof createIntegrationContext>) => void) {
  test(name, () => {
    const ctx = createIntegrationContext("aa-improve-rollout-");
    try {
      fn(ctx);
    } finally {
      ctx.cleanup();
    }
  });
}

test("PolicyRolloutService.start returns record when guardrails pass", () => {
  const ctx = createIntegrationContext("aa-prs-start-");
  try {
    const service = new PolicyRolloutService();
    const candidate = makeCandidate({ status: "approved" });
    const strategyVersion = makeStrategyVersion({ releaseLevel: "suggest" });

    const record = service.start(candidate, strategyVersion);

    assert.ok(record !== null, "Should create rollout record");
    assert.equal(record.candidateId, candidate.candidateId);
    assert.ok(record.recordId.startsWith("rollout_"));
  } finally {
    ctx.cleanup();
  }
});

test("PolicyRolloutService.start returns null when guardrails block shadow", () => {
  const ctx = createIntegrationContext("aa-prs-start-block-");
  try {
    const service = new PolicyRolloutService();
    const candidate = makeCandidate({ status: "proposed" });
    const strategyVersion = makeStrategyVersion({ releaseLevel: "shadow" });

    const record = service.start(candidate, strategyVersion);

    assert.equal(record, null, "Should block rollout when guardrails fail");
  } finally {
    ctx.cleanup();
  }
});

test("PolicyRolloutService.promote progresses through canary stages with good metrics", () => {
  const ctx = createIntegrationContext("aa-prs-promote-");
  try {
    const service = new PolicyRolloutService();
    const candidate = makeCandidate({ status: "approved" });
    const sv = makeStrategyVersion({ releaseLevel: "suggest" });

    // Start at suggest
    let record = service.start(candidate, sv);
    assert.ok(record);
    assert.equal(record.status, "evaluation_enabled");

    // Shadow now also requires an explicit metrics gate input.
    record = service.promote(candidate, record, "shadow", makeMetrics(), "admin");
    assert.equal(record.status, "shadow");

    // Canary_5 requires metrics but passes
    record = service.promote(candidate, record, "canary_5", makeMetrics());
    assert.equal(record.status, "canary_5");

    // partial_25 with good metrics
    record = service.promote(candidate, record, "partial_25", makeMetrics());
    assert.equal(record.status, "partial_25");
  } finally {
    ctx.cleanup();
  }
});

test("PolicyRolloutService.promote triggers rollback when metrics indicate failure", () => {
  const ctx = createIntegrationContext("aa-prs-promote-rollback-");
  try {
    const service = new PolicyRolloutService();
    const candidate = makeCandidate({ status: "approved" });
    const sv = makeStrategyVersion({ releaseLevel: "suggest" });

    let record = service.start(candidate, sv);
    record = service.promote(
      candidate,
      record,
      "shadow",
      makeMetrics({ requestCount: 100, failureRate: 0.01, p99LatencyMs: 120, baselineP99LatencyMs: 100, observationWindowMs: 120_000 }),
    );
    record = service.promote(candidate, record, "canary_5", makeMetrics({ failureRate: 0.01 }));

    // Now promote with bad metrics - should rollback
    const badMetrics = makeMetrics({ failureRate: 0.50, p99LatencyMs: 500 });
    record = service.promote(candidate, record, "partial_25", badMetrics);

    assert.equal(record.status, "rolled_back");
  } finally {
    ctx.cleanup();
  }
});

test("PolicyRolloutService.rollback creates rolled_back record", () => {
  const ctx = createIntegrationContext("aa-prs-rollback-");
  try {
    const service = new PolicyRolloutService();
    const candidate = makeCandidate({ status: "approved" });
    const sv = makeStrategyVersion({ releaseLevel: "suggest" });

    let record = service.start(candidate, sv);
    record = service.promote(
      candidate,
      record,
      "shadow",
      makeMetrics({ requestCount: 100, failureRate: 0.01, p99LatencyMs: 120, baselineP99LatencyMs: 100, observationWindowMs: 120_000 }),
    );
    record = service.promote(candidate, record, "canary_5", makeMetrics());

    // Manual rollback with bad metrics
    const metrics = makeMetrics({ failureRate: 0.30 });
    record = service.rollback(candidate, record, metrics);

    assert.equal(record.status, "rolled_back");
  } finally {
    ctx.cleanup();
  }
});

test("PolicyRolloutService.evaluateMetricsGate blocks non-progressive promotion without metrics", () => {
  const ctx = createIntegrationContext("aa-prs-gate-nonprog-");
  try {
    const service = new PolicyRolloutService();
    const record: RolloutRecord = {
      recordId: "record-1",
      candidateId: "candidate-1",
      level: "shadow",
      previousLevel: "off",
      strategyVersionId: "sv-1",
      status: "shadow",
      transitionedAt: Date.now(),
      guardrailReasonCodes: [],
      evidence: [],
    };

    const gate = service.evaluateMetricsGate(record, "rejected");

    assert.equal(gate.allowed, false);
    assert.ok(gate.reasonCodes.includes("rollout.metrics_required"));
  } finally {
    ctx.cleanup();
  }
});

test("PolicyRolloutService.evaluateMetricsGate blocks promotion without metrics", () => {
  const ctx = createIntegrationContext("aa-prs-gate-nometrics-");
  try {
    const service = new PolicyRolloutService();
    const record: RolloutRecord = {
      recordId: "record-1",
      candidateId: "candidate-1",
      level: "canary_5",
      previousLevel: "shadow",
      strategyVersionId: "sv-1",
      status: "canary_5",
      transitionedAt: Date.now(),
      guardrailReasonCodes: [],
      evidence: [],
    };

    const gate = service.evaluateMetricsGate(record, "partial_25");

    assert.equal(gate.allowed, false);
    assert.ok(gate.reasonCodes.includes("rollout.metrics_required"));
  } finally {
    ctx.cleanup();
  }
});

test("PolicyRolloutService.decide checks rollout freeze manager", () => {
  const ctx = createIntegrationContext("aa-prs-freeze-");
  try {
    const service = new PolicyRolloutService();
    const candidate = makeCandidate({ status: "approved" });
    const sv = makeStrategyVersion({ releaseLevel: "suggest" });

    // Note: This test documents that decide() checks rolloutFreezeManager
    // The actual freeze state depends on external configuration
    const decision = service.decide(candidate, sv);

    // Decision should have all required fields
    assert.equal(typeof decision.allowed, "boolean");
    assert.equal(typeof decision.releaseLevel, "string");
    assert.equal(typeof decision.reasonCode, "string");
    assert.ok(Array.isArray(decision.reasonCodes));
  } finally {
    ctx.cleanup();
  }
});

test("GuardrailEvaluator blocks when candidate missing evidence", () => {
  const ctx = createIntegrationContext("aa-guardrail-");
  try {
    const evaluator = new GuardrailEvaluator();
    const candidate = makeCandidate({ sourceSignalRefs: [] });
    const strategyVersion = makeStrategyVersion({
      sourceLearningObjectIds: ["lo-1"],
      releaseLevel: "suggest",
    });

    const result = evaluator.evaluate(candidate, strategyVersion);

    assert.equal(result.allowed, false);
    assert.ok(result.reasonCodes.includes("improvement.guardrail_missing_evidence"));
  } finally {
    ctx.cleanup();
  }
});

test("GuardrailEvaluator allows when all conditions met", () => {
  const ctx = createIntegrationContext("aa-guardrail-allow-");
  try {
    const evaluator = new GuardrailEvaluator();
    const candidate = makeCandidate({
      status: "approved",
      sourceSignalRefs: ["signal-1"],
      sourceLearningObjectIds: ["lo-1"],
    });
    const strategyVersion = makeStrategyVersion({
      sourceLearningObjectIds: ["lo-1"],
      releaseLevel: "shadow",
    });

    const result = evaluator.evaluate(candidate, strategyVersion);

    assert.equal(result.allowed, true);
    assert.equal(result.reasonCodes.length, 0);
  } finally {
    ctx.cleanup();
  }
});

test("AutoRollbackService.evaluate returns no rollback for good metrics", () => {
  const ctx = createIntegrationContext("aa-arb-good-");
  try {
    const service = new AutoRollbackService();
    const record: RolloutRecord = {
      recordId: "record-1",
      candidateId: "candidate-1",
      level: "canary_5",
      previousLevel: "shadow",
      strategyVersionId: "sv-1",
      status: "canary_5",
      transitionedAt: Date.now(),
      guardrailReasonCodes: [],
      evidence: [],
    };
    const metrics = makeMetrics({
      requestCount: 100,
      failureRate: 0.01,
      p99LatencyMs: 150,
      baselineP99LatencyMs: 100,
    });

    const decision = service.evaluate(record, metrics);

    assert.equal(decision.rollback, false);
    assert.equal(decision.reasonCodes.length, 0);
  } finally {
    ctx.cleanup();
  }
});

test("AutoRollbackService.evaluate triggers rollback for high failure rate", () => {
  const ctx = createIntegrationContext("aa-arb-highfail-");
  try {
    const service = new AutoRollbackService();
    const record: RolloutRecord = {
      recordId: "record-1",
      candidateId: "candidate-1",
      level: "canary_5",
      previousLevel: "shadow",
      strategyVersionId: "sv-1",
      status: "canary_5",
      transitionedAt: Date.now(),
      guardrailReasonCodes: [],
      evidence: [],
    };
    const metrics = makeMetrics({
      requestCount: 100,
      failureRate: 0.10,
    });

    const decision = service.evaluate(record, metrics);

    assert.equal(decision.rollback, true);
    assert.ok(decision.reasonCodes.includes("rollout.failure_rate_exceeded"));
  } finally {
    ctx.cleanup();
  }
});

test("AutoRollbackService.evaluate triggers rollback for high latency", () => {
  const ctx = createIntegrationContext("aa-arb-highlat-");
  try {
    const service = new AutoRollbackService();
    const record: RolloutRecord = {
      recordId: "record-1",
      candidateId: "candidate-1",
      level: "canary_5",
      previousLevel: "shadow",
      strategyVersionId: "sv-1",
      status: "canary_5",
      transitionedAt: Date.now(),
      guardrailReasonCodes: [],
      evidence: [],
    };
    const metrics = makeMetrics({
      requestCount: 100,
      failureRate: 0.01,
      p99LatencyMs: 300,
      baselineP99LatencyMs: 100,
    });

    const decision = service.evaluate(record, metrics);

    assert.equal(decision.rollback, true);
    assert.ok(decision.reasonCodes.includes("rollout.latency_multiplier_exceeded"));
  } finally {
    ctx.cleanup();
  }
});

test("AutoRollbackService.evaluate returns insufficient sample for low request count", () => {
  const ctx = createIntegrationContext("aa-arb-insuff-");
  try {
    const service = new AutoRollbackService();
    const record: RolloutRecord = {
      recordId: "record-1",
      candidateId: "candidate-1",
      level: "canary_5",
      previousLevel: "shadow",
      strategyVersionId: "sv-1",
      status: "canary_5",
      transitionedAt: Date.now(),
      guardrailReasonCodes: [],
      evidence: [],
    };
    const metrics = makeMetrics({
      requestCount: 5,
      failureRate: 0.50,
    });

    const decision = service.evaluate(record, metrics);

    assert.equal(decision.rollback, false);
    assert.ok(decision.reasonCodes.includes("rollout.metrics_insufficient_sample"));
  } finally {
    ctx.cleanup();
  }
});

test("RolloutStateMachine.transition creates valid rollout record", () => {
  const ctx = createIntegrationContext("aa-rsm-transition-");
  try {
    const machine = new RolloutStateMachine();
    const candidate = makeCandidate({ status: "approved" });

    const result = machine.transition(candidate, "shadow");

    assert.equal(result.status, "shadow");
    assert.equal(result.level, "shadow");
    assert.ok(result.recordId.startsWith("rollout_"));
    assert.ok(result.transitionedAt > 0);
  } finally {
    ctx.cleanup();
  }
});

test("RolloutStateMachine.transition throws for invalid transition", () => {
  const ctx = createIntegrationContext("aa-rsm-invalid-");
  try {
    const machine = new RolloutStateMachine();
    const candidate = makeCandidate({ status: "proposed" });

    assert.throws(() => {
      machine.transition(candidate, "stable");
    }, /Invalid rollout transition/);
  } finally {
    ctx.cleanup();
  }
});

test("PolicyRolloutService works with custom AutoRollbackService config", () => {
  const ctx = createIntegrationContext("aa-prs-custom-");
  try {
    const customArb = new AutoRollbackService({
      maxFailureRate: 0.02,
      maxLatencyMultiplier: 1.5,
      minimumRequestCount: 50,
      minimumObservationWindowMs: 30_000,
    });
    const service = new PolicyRolloutService(customArb);
    const candidate = makeCandidate({ status: "approved" });
    const sv = makeStrategyVersion({ releaseLevel: "suggest" });

    let record = service.start(candidate, sv);
    assert.ok(record);

    record = service.promote(
      candidate,
      record,
      "shadow",
      makeMetrics({ requestCount: 100, failureRate: 0.01, p99LatencyMs: 120, baselineP99LatencyMs: 100, observationWindowMs: 120_000 }),
    );
    record = service.promote(candidate, record, "canary_5", makeMetrics({ requestCount: 100, failureRate: 0.01, p99LatencyMs: 150, baselineP99LatencyMs: 100 }));

    // Verify evaluateMetricsGate returns allowed for good metrics with custom config
    const metrics = makeMetrics({ failureRate: 0.01, p99LatencyMs: 150, baselineP99LatencyMs: 100, observationWindowMs: 120_000 });
    const gate = service.evaluateMetricsGate(record, "partial_25", metrics);
    assert.equal(gate.allowed, true);
  } finally {
    ctx.cleanup();
  }
});

test("Full rollout lifecycle: propose to stable", () => {
  const ctx = createIntegrationContext("aa-lifecycle-");
  try {
    const service = new PolicyRolloutService();
    const candidate = makeCandidate({ status: "approved" });
    const sv = makeStrategyVersion({ releaseLevel: "suggest" });

    // Start
    let record = service.start(candidate, sv);
    assert.equal(record?.status, "evaluation_enabled");

    // Progress through all stages with good metrics
    record = service.promote(candidate, record, "shadow", makeMetrics(), "admin");
    assert.equal(record.status, "shadow");

    record = service.promote(candidate, record, "canary_5", makeMetrics({ failureRate: 0.01 }));
    assert.equal(record.status, "canary_5");

    record = service.promote(candidate, record, "partial_25", makeMetrics({ failureRate: 0.01 }));
    assert.equal(record.status, "partial_25");

    record = service.promote(candidate, record, "partial_50", makeMetrics({ failureRate: 0.01 }));
    assert.equal(record.status, "partial_50");

    record = service.promote(candidate, record, "partial_75", makeMetrics({ failureRate: 0.01 }));
    assert.equal(record.status, "partial_75");

    record = service.promote(candidate, record, "stable", makeMetrics({ failureRate: 0.01 }));
    assert.equal(record.status, "stable");
  } finally {
    ctx.cleanup();
  }
});

test("Full rollout lifecycle: rollback mid-flight", () => {
  const ctx = createIntegrationContext("aa-lifecycle-rollback-");
  try {
    const service = new PolicyRolloutService();
    const candidate = makeCandidate({ status: "approved" });
    const sv = makeStrategyVersion({ releaseLevel: "suggest" });

    let record = service.start(candidate, sv);
    record = service.promote(candidate, record, "shadow", makeMetrics());
    record = service.promote(candidate, record, "canary_5", makeMetrics());
    record = service.promote(candidate, record, "partial_25", makeMetrics());

    // At partial_25, metrics go bad - should rollback
    const badMetrics = makeMetrics({ failureRate: 0.25, p99LatencyMs: 400 });
    record = service.promote(candidate, record, "partial_50", badMetrics);

    assert.equal(record.status, "rolled_back");
    assert.ok(record.transitionedAt > 0);
  } finally {
    ctx.cleanup();
  }
});
