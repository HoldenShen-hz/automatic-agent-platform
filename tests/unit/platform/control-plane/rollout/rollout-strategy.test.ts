/**
 * Unit Tests: Rollout Strategy
 *
 * Tests strategy versioning, creation, and release level management
 * for progressive rollout of improvements.
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { createStrategyVersion, type StrategyReleaseLevel, type StrategyVersion } from "../../../../../src/platform/five-plane-orchestration/improve-rollout/strategy-versioning.js";
import { PolicyRolloutService } from "../../../../../src/platform/five-plane-orchestration/improve-rollout/policy-rollout-service.js";
import { AutoRollbackService } from "../../../../../src/platform/five-plane-orchestration/improve-rollout/auto-rollback-service.js";
import type { ImprovementCandidate } from "../../../../../src/platform/five-plane-orchestration/improve-rollout/improvement-candidate-registry.js";
import type { LearningObject } from "../../../../../src/platform/five-plane-orchestration/learn/learning-object-model.js";

function createMockLearningObject(overrides: Partial<LearningObject> = {}): LearningObject {
  return {
    learningObjectId: "lo_test_1",
    objectId: "obj_test_1",
    learningType: "failure_pattern",
    kind: "failure_pattern",
    title: "Test Learning Object",
    summary: "Test summary",
    content: {
      title: "Test Learning Object",
      summary: "Test summary",
      evidenceRefs: [],
      sourceSignalIds: [],
      recommendation: "Apply fix",
    },
    confidence: 0.9,
    evidenceRefs: [],
    sourceSignalIds: [],
    recommendation: "Apply fix",
    validatedBy: "evidence",
    promotionStatus: "validated",
    status: "validated",
    createdAt: new Date().toISOString(),
    ...overrides,
  } as unknown as LearningObject;
}

function createMockCandidate(overrides: Partial<ImprovementCandidate> = {}): ImprovementCandidate {
  return {
    candidateId: "candidate_test_1",
    taskId: "task_test_1",
    learningObjectId: "lo_test_1",
    source: "failure_pattern",
    targetScope: "domain",
    priority: "high",
    rolloutLevel: "L0_off",
    metrics: { errorRate: 0, latencyP99: 0, successRate: 1, sampleCount: 0 },
    guardrails: [],
    sourceSignalRefs: ["signal_1"],
    sourceLearningObjectIds: ["lo_test_1"],
    changeScope: "policy",
    description: "Test candidate",
    expectedBenefit: "Test benefit",
    status: "approved",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  } as unknown as ImprovementCandidate;
}

describe("StrategyVersioning", () => {
  describe("createStrategyVersion", () => {
    test("creates a strategy version with suggest release level by default", () => {
      const learningObjects = [createMockLearningObject()];
      const strategy = createStrategyVersion("Test Strategy", learningObjects);

      assert.equal(strategy.title, "Test Strategy");
      assert.equal(strategy.releaseLevel, "suggest");
      assert.deepEqual(strategy.sourceLearningObjectIds, ["lo_test_1"]);
      assert.ok(strategy.strategyVersionId.startsWith("strategy_version_"));
    });

    test("creates a strategy version with shadow release level", () => {
      const learningObjects = [createMockLearningObject()];
      const strategy = createStrategyVersion("Shadow Strategy", learningObjects, "shadow");

      assert.equal(strategy.releaseLevel, "shadow");
    });

    test("creates a strategy version with canary_5 release level", () => {
      const learningObjects = [createMockLearningObject()];
      const strategy = createStrategyVersion("Canary Strategy", learningObjects, "canary_5");

      assert.equal(strategy.releaseLevel, "canary_5");
    });

    test("maps multiple learning objects to sourceLearningObjectIds", () => {
      const learningObjects = [
        createMockLearningObject({ learningObjectId: "lo_1" }),
        createMockLearningObject({ learningObjectId: "lo_2" }),
        createMockLearningObject({ learningObjectId: "lo_3" }),
      ];
      const strategy = createStrategyVersion("Multi-LO Strategy", learningObjects);

      assert.deepEqual(strategy.sourceLearningObjectIds, ["lo_1", "lo_2", "lo_3"]);
    });

    test("sets createdAt to current timestamp", () => {
      const before = Date.now();
      const learningObjects = [createMockLearningObject()];
      const strategy = createStrategyVersion("Timestamp Test", learningObjects);
      const after = Date.now();

      assert.ok(strategy.createdAt >= before);
      assert.ok(strategy.createdAt <= after);
    });
  });

  describe("StrategyReleaseLevel types", () => {
    test("accepts valid release level values", () => {
      const levels: StrategyReleaseLevel[] = [
        "L0_off", "L1_evaluate", "L2_canary", "L3_partial", "L4_stable", "L5_full",
        "off", "suggest", "shadow", "canary_5", "partial_25", "partial_50", "partial_75", "stable",
      ];

      for (const level of levels) {
        const learningObjects = [createMockLearningObject()];
        const strategy = createStrategyVersion("Test", learningObjects, level);
        assert.equal(strategy.releaseLevel, level, `Level ${level} should be accepted`);
      }
    });
  });
});

describe("PolicyRolloutService", () => {
  describe("decide", () => {
    test("allows rollout when candidate is approved and guardrails pass", () => {
      const autoRollback = new AutoRollbackService();
      const service = new PolicyRolloutService(autoRollback);
      const candidate = createMockCandidate({ status: "approved" });
      const strategy = createStrategyVersion("Test", [createMockLearningObject()], "canary_5");

      const decision = service.decide(candidate, strategy);

      assert.equal(decision.allowed, true);
      assert.equal(decision.releaseLevel, "canary_5");
    });

    test("blocks rollout when candidate is not approved", () => {
      const autoRollback = new AutoRollbackService();
      const service = new PolicyRolloutService(autoRollback);
      const candidate = createMockCandidate({ status: "candidate_created" });
      const strategy = createStrategyVersion("Test", [createMockLearningObject()], "canary_5");

      const decision = service.decide(candidate, strategy);

      assert.equal(decision.allowed, false);
      assert.ok(decision.reasonCodes.includes("improvement.candidate_not_approved"));
    });

    test("provides reason code for blocked rollout", () => {
      const autoRollback = new AutoRollbackService();
      const service = new PolicyRolloutService(autoRollback);
      const candidate = createMockCandidate({ status: "candidate_created" });
      const strategy = createStrategyVersion("Test", [createMockLearningObject()], "shadow");

      const decision = service.decide(candidate, strategy);

      assert.ok(decision.reasonCode.includes("improvement"));
    });
  });

  describe("start", () => {
    test("returns rollout record when decision allows rollout", () => {
      const autoRollback = new AutoRollbackService();
      const service = new PolicyRolloutService(autoRollback);
      const candidate = createMockCandidate({ status: "approved" });
      const strategy = createStrategyVersion("Test", [createMockLearningObject()], "shadow");

      const record = service.start(candidate, strategy, "admin_user");

      assert.ok(record != null);
      assert.equal(record.candidateId, candidate.candidateId);
    });

    test("returns null when candidate not approved", () => {
      const autoRollback = new AutoRollbackService();
      const service = new PolicyRolloutService(autoRollback);
      const candidate = createMockCandidate({ status: "candidate_created" });
      const strategy = createStrategyVersion("Test", [createMockLearningObject()], "shadow");

      const record = service.start(candidate, strategy);

      assert.equal(record, null);
    });

    test("uses approvedBy for human trigger when provided", () => {
      const autoRollback = new AutoRollbackService();
      const service = new PolicyRolloutService(autoRollback);
      const candidate = createMockCandidate({ status: "approved" });
      const strategy = createStrategyVersion("Test", [createMockLearningObject()], "shadow");

      const record = service.start(candidate, strategy, "admin_user");

      assert.ok(record != null);
      assert.equal(record.approvedBy, "admin_user");
      assert.equal(record.triggeredBy, "human");
    });

    test("uses scheduler trigger when approvedBy is not provided", () => {
      const autoRollback = new AutoRollbackService();
      const service = new PolicyRolloutService(autoRollback);
      const candidate = createMockCandidate({ status: "approved" });
      const strategy = createStrategyVersion("Test", [createMockLearningObject()], "shadow");

      const record = service.start(candidate, strategy);

      assert.ok(record != null);
      assert.equal(record.triggeredBy, "scheduler");
    });
  });

  describe("promote", () => {
    test("promotes rollout to next status with metrics", () => {
      const autoRollback = new AutoRollbackService();
      const service = new PolicyRolloutService(autoRollback);
      const candidate = createMockCandidate({ status: "approved" });
      const strategy = createStrategyVersion("Test", [createMockLearningObject()], "canary_5");
      const initialRecord = service.start(candidate, strategy)!;

      const metrics = {
        requestCount: 100,
        failureRate: 0.01,
        p99LatencyMs: 120,
        baselineP99LatencyMs: 100,
      };

      const promoted = service.promote(candidate, initialRecord, "canary_5", metrics);

      assert.ok(promoted != null);
      assert.equal(promoted.strategyVersionId, strategy.strategyVersionId);
    });

    test("promotes from canary_5 to partial_25", () => {
      const autoRollback = new AutoRollbackService();
      const service = new PolicyRolloutService(autoRollback);
      const candidate = createMockCandidate({ status: "canary_5" });
      const currentRecord = {
        recordId: "record_1",
        candidateId: candidate.candidateId,
        level: "L2_canary",
        previousLevel: "L1_evaluate",
        fromLevel: "L1_evaluate",
        toLevel: "L2_canary",
        strategyVersionId: "sv_1",
        status: "canary_5" as const,
        transitionedAt: Date.now(),
        guardrailReasonCodes: [],
        evidence: [],
      };

      const promoted = service.promote(candidate, currentRecord, "partial_25", {
        requestCount: 100,
        failureRate: 0.01,
        p99LatencyMs: 120,
        baselineP99LatencyMs: 100,
      });

      assert.ok(promoted != null);
    });
  });

  describe("evaluateMetricsGate", () => {
    test("requires metrics for progressive statuses", () => {
      const autoRollback = new AutoRollbackService();
      const service = new PolicyRolloutService(autoRollback);
      const record = {
        recordId: "record_1",
        candidateId: "cand_1",
        level: "L2_canary",
        previousLevel: "L1_evaluate",
        fromLevel: "L1_evaluate",
        toLevel: "L2_canary",
        strategyVersionId: "sv_1",
        status: "canary_5" as const,
        transitionedAt: Date.now(),
        guardrailReasonCodes: [],
        evidence: [],
      };

      const gate = service.evaluateMetricsGate(record, "partial_25");

      assert.equal(gate.allowed, false);
      assert.ok(gate.reasonCodes.includes("rollout.metrics_required"));
    });

    test("allows promotion when metrics pass", () => {
      const autoRollback = new AutoRollbackService();
      const service = new PolicyRolloutService(autoRollback);
      const record = {
        recordId: "record_1",
        candidateId: "cand_1",
        level: "L2_canary",
        previousLevel: "L1_evaluate",
        fromLevel: "L1_evaluate",
        toLevel: "L2_canary",
        strategyVersionId: "sv_1",
        status: "canary_5" as const,
        transitionedAt: Date.now(),
        guardrailReasonCodes: [],
        evidence: [],
      };
      const metrics = {
        requestCount: 100,
        failureRate: 0.01,
        p99LatencyMs: 120,
        baselineP99LatencyMs: 100,
        observationWindowMs: 120_000,
      };

      const gate = service.evaluateMetricsGate(record, "partial_25", metrics);

      assert.equal(gate.allowed, true);
      assert.ok(gate.reasonCodes.includes("rollout.metrics_gate_passed"));
    });
  });
});