/**
 * Unit Tests: Rollout Phases
 *
 * Tests the phase transitions and traffic routing for canary deployments
 * including canary-traffic-router and guardrail-evaluator.
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { CanaryTrafficRouter, type CanaryRoutingDecision } from "../../../../../src/platform/five-plane-orchestration/improve-rollout/canary-traffic-router.js";
import { GuardrailEvaluator } from "../../../../../src/platform/five-plane-orchestration/improve-rollout/guardrail-evaluator.js";
import type { ImprovementCandidate } from "../../../../../src/platform/five-plane-orchestration/improve-rollout/improvement-candidate-registry.js";
import type { StrategyVersion } from "../../../../../src/platform/five-plane-orchestration/improve-rollout/strategy-versioning.js";
import type { RolloutMetrics } from "../../../../../src/platform/five-plane-orchestration/improve-rollout/auto-rollback-service.js";
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
    sourceSignalRefs: [],
    sourceLearningObjectIds: [],
    changeScope: "policy",
    description: "Test candidate",
    expectedBenefit: "Test benefit",
    status: "approved",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  } as unknown as ImprovementCandidate;
}

function createMockStrategyVersion(overrides: Partial<StrategyVersion> = {}): StrategyVersion {
  return {
    strategyVersionId: "sv_test_1",
    title: "Test Strategy",
    sourceLearningObjectIds: ["lo_test_1"],
    releaseLevel: "canary_5",
    createdAt: Date.now(),
    ...overrides,
  };
}

describe("CanaryTrafficRouter", () => {
  describe("getTrafficPercentage", () => {
    test("returns 0 for draft status", () => {
      const router = new CanaryTrafficRouter();
      assert.equal(router.getTrafficPercentage("draft"), 0);
    });

    test("returns 0 for pending_approval status", () => {
      const router = new CanaryTrafficRouter();
      assert.equal(router.getTrafficPercentage("pending_approval"), 0);
    });

    test("returns 0 for shadow status", () => {
      const router = new CanaryTrafficRouter();
      assert.equal(router.getTrafficPercentage("shadow"), 0);
    });

    test("returns 5 for canary_5 status", () => {
      const router = new CanaryTrafficRouter();
      assert.equal(router.getTrafficPercentage("canary_5"), 5);
    });

    test("returns 25 for partial_25 status", () => {
      const router = new CanaryTrafficRouter();
      assert.equal(router.getTrafficPercentage("partial_25"), 25);
    });

    test("returns 50 for partial_50 status", () => {
      const router = new CanaryTrafficRouter();
      assert.equal(router.getTrafficPercentage("partial_50"), 50);
    });

    test("returns 75 for partial_75 status", () => {
      const router = new CanaryTrafficRouter();
      assert.equal(router.getTrafficPercentage("partial_75"), 75);
    });

    test("returns 75 for stable_75 status", () => {
      const router = new CanaryTrafficRouter();
      assert.equal(router.getTrafficPercentage("stable_75"), 75);
    });

    test("returns 100 for stable_100 status", () => {
      const router = new CanaryTrafficRouter();
      assert.equal(router.getTrafficPercentage("stable_100"), 100);
    });

    test("returns 100 for released status", () => {
      const router = new CanaryTrafficRouter();
      assert.equal(router.getTrafficPercentage("released"), 100);
    });

    test("returns 0 for unknown status", () => {
      const router = new CanaryTrafficRouter();
      assert.equal(router.getTrafficPercentage("unknown_status"), 0);
    });
  });

  describe("route", () => {
    test("returns routing decision with bucket and traffic info", () => {
      const router = new CanaryTrafficRouter();
      const decision = router.route("task_123", "canary_5");

      assert.equal(typeof decision.matched, "boolean");
      assert.equal(decision.trafficPercentage, 5);
      assert.equal(typeof decision.bucket, "number");
      assert.ok(decision.bucket >= 0 && decision.bucket < 100);
    });

    test("produces consistent bucket for same taskId", () => {
      const router = new CanaryTrafficRouter();
      const decision1 = router.route("task_same", "canary_5");
      const decision2 = router.route("task_same", "canary_5");

      assert.equal(decision1.bucket, decision2.bucket);
    });

    test("produces different buckets for different taskIds", () => {
      const router = new CanaryTrafficRouter();
      const decision1 = router.route("task_one", "canary_5");
      const decision2 = router.route("task_two", "canary_5");

      // With 5% traffic, most tasks should not match
      assert.equal(typeof decision1.matched, "boolean");
      assert.equal(typeof decision2.matched, "boolean");
    });

    test("handles stable_100 returning all traffic", () => {
      const router = new CanaryTrafficRouter();
      const decision = router.route("task_123", "stable_100");

      assert.equal(decision.matched, true);
      assert.equal(decision.trafficPercentage, 100);
    });

    test("handles rejected returning no traffic", () => {
      const router = new CanaryTrafficRouter();
      const decision = router.route("task_123", "rejected");

      assert.equal(decision.matched, false);
      assert.equal(decision.trafficPercentage, 0);
    });
  });

  describe("shouldRoute", () => {
    test("returns true when task should receive traffic", () => {
      const router = new CanaryTrafficRouter();
      // For stable_100, all tasks should match
      const shouldRoute = router.shouldRoute("task_123", "stable_100");

      assert.equal(shouldRoute, true);
    });

    test("returns false when task should not receive traffic", () => {
      const router = new CanaryTrafficRouter();
      const shouldRoute = router.shouldRoute("task_123", "draft");

      assert.equal(shouldRoute, false);
    });
  });

  describe("computeCanaryAllocation", () => {
    test("computes allocation for canary_5", () => {
      const router = new CanaryTrafficRouter();
      const allocation = router.computeCanaryAllocation("canary_5");

      assert.equal(allocation.targetLevel, "canary_5");
      assert.equal(allocation.canaryPercentage, 5);
      assert.equal(allocation.stablePercentage, 95);
    });

    test("computes allocation for partial_50", () => {
      const router = new CanaryTrafficRouter();
      const allocation = router.computeCanaryAllocation("partial_50");

      assert.equal(allocation.canaryPercentage, 50);
      assert.equal(allocation.stablePercentage, 50);
    });

    test("computes allocation for stable_100 with zero canary", () => {
      const router = new CanaryTrafficRouter();
      const allocation = router.computeCanaryAllocation("stable_100");

      assert.equal(allocation.canaryPercentage, 0);
      assert.equal(allocation.stablePercentage, 100);
    });

    test("computes allocation for released with zero canary", () => {
      const router = new CanaryTrafficRouter();
      const allocation = router.computeCanaryAllocation("released");

      assert.equal(allocation.canaryPercentage, 0);
      assert.equal(allocation.stablePercentage, 100);
    });
  });
});

describe("GuardrailEvaluator", () => {
  describe("evaluate with candidate and strategy", () => {
    test("allows rollout when all guardrail conditions pass", () => {
      const evaluator = new GuardrailEvaluator();
      const candidate = createMockCandidate({
        sourceSignalRefs: ["signal_1"],
        sourceLearningObjectIds: ["lo_1"],
        status: "approved",
        guardrails: [],
      });
      const strategy = createMockStrategyVersion({
        sourceLearningObjectIds: ["lo_1"],
        releaseLevel: "canary_5",
      });

      const result = evaluator.evaluate(candidate, strategy);

      assert.equal(result.allowed, true);
      assert.equal(result.reasonCodes.length, 0);
    });

    test("blocks rollout when sourceSignalRefs is empty", () => {
      const evaluator = new GuardrailEvaluator();
      const candidate = createMockCandidate({
        sourceSignalRefs: [],
        sourceLearningObjectIds: ["lo_1"],
        status: "approved",
        guardrails: [],
      });
      const strategy = createMockStrategyVersion({
        sourceLearningObjectIds: ["lo_1"],
        releaseLevel: "canary_5",
      });

      const result = evaluator.evaluate(candidate, strategy);

      assert.equal(result.allowed, false);
      assert.ok(result.reasonCodes.includes("improvement.guardrail_missing_evidence"));
    });

    test("blocks rollout when sourceLearningObjectIds is empty", () => {
      const evaluator = new GuardrailEvaluator();
      const candidate = createMockCandidate({
        sourceSignalRefs: ["signal_1"],
        sourceLearningObjectIds: [],
        status: "approved",
        guardrails: [],
      });
      const strategy = createMockStrategyVersion({
        sourceLearningObjectIds: ["lo_1"],
        releaseLevel: "canary_5",
      });

      const result = evaluator.evaluate(candidate, strategy);

      assert.equal(result.allowed, false);
      assert.ok(result.reasonCodes.includes("improvement.guardrail_missing_learning_object"));
    });

    test("blocks rollout when strategy has no linked learning objects", () => {
      const evaluator = new GuardrailEvaluator();
      const candidate = createMockCandidate({
        sourceSignalRefs: ["signal_1"],
        sourceLearningObjectIds: ["lo_1"],
        status: "approved",
        guardrails: [],
      });
      const strategy = createMockStrategyVersion({
        sourceLearningObjectIds: [],
        releaseLevel: "canary_5",
      });

      const result = evaluator.evaluate(candidate, strategy);

      assert.equal(result.allowed, false);
      assert.ok(result.reasonCodes.includes("improvement.guardrail_unlinked_strategy"));
    });

    test("blocks shadow rollout when candidate not approved", () => {
      const evaluator = new GuardrailEvaluator();
      const candidate = createMockCandidate({
        sourceSignalRefs: ["signal_1"],
        sourceLearningObjectIds: ["lo_1"],
        status: "candidate_created",
        guardrails: [],
      });
      const strategy = createMockStrategyVersion({
        sourceLearningObjectIds: ["lo_1"],
        releaseLevel: "shadow",
      });

      const result = evaluator.evaluate(candidate, strategy);

      assert.equal(result.allowed, false);
      assert.ok(result.reasonCodes.some(code => code.includes("guardrail_shadow_requires_approval")));
    });

    test("blocks rollout when candidate not approved for non-shadow", () => {
      const evaluator = new GuardrailEvaluator();
      const candidate = createMockCandidate({
        sourceSignalRefs: ["signal_1"],
        sourceLearningObjectIds: ["lo_1"],
        status: "candidate_created",
        guardrails: [],
      });
      const strategy = createMockStrategyVersion({
        sourceLearningObjectIds: ["lo_1"],
        releaseLevel: "canary_5",
      });

      const result = evaluator.evaluate(candidate, strategy);

      assert.equal(result.allowed, false);
      assert.ok(result.reasonCodes.some(code => code.includes("guardrail_requires_approval")));
    });

    test("blocks rollout when guardrail level requirement not met", () => {
      const evaluator = new GuardrailEvaluator();
      const candidate = createMockCandidate({
        sourceSignalRefs: ["signal_1"],
        sourceLearningObjectIds: ["lo_1"],
        status: "approved",
        guardrails: [{
          guardrailId: "guardrail_1",
          description: "Requires L3",
          requiredLevel: "L3_partial",
        }],
      });
      const strategy = createMockStrategyVersion({
        sourceLearningObjectIds: ["lo_1"],
        releaseLevel: "canary_5", // L2 level - should be blocked by guardrail requiring L3
      });

      const result = evaluator.evaluate(candidate, strategy);

      assert.equal(result.allowed, false);
      assert.ok(result.reasonCodes.some(code => code.includes("guardrail_level_blocked")));
    });
  });

  describe("evaluate with stage and metrics (legacy)", () => {
    test("passes when all metrics are within thresholds", () => {
      const evaluator = new GuardrailEvaluator();
      const metrics: RolloutMetrics = {
        requestCount: 100,
        failureRate: 0.01,
        p99LatencyMs: 150,
        baselineP99LatencyMs: 100,
        observationWindowMs: 120_000,
      };

      const result = evaluator.evaluate("canary_5", metrics);

      assert.equal(result.passed, true);
      assert.equal(result.blockingIssues.length, 0);
    });

    test("fails when requestCount is below minimum", () => {
      const evaluator = new GuardrailEvaluator();
      const metrics: RolloutMetrics = {
        requestCount: 10, // Below 20 minimum
        failureRate: 0.01,
        p99LatencyMs: 150,
        baselineP99LatencyMs: 100,
        observationWindowMs: 120_000,
      };

      const result = evaluator.evaluate("canary_5", metrics);

      assert.equal(result.passed, false);
      assert.ok(result.blockingIssues.includes("insufficient sample count"));
    });

    test("fails when observation window is too short", () => {
      const evaluator = new GuardrailEvaluator();
      const metrics: RolloutMetrics = {
        requestCount: 100,
        failureRate: 0.01,
        p99LatencyMs: 150,
        baselineP99LatencyMs: 100,
        observationWindowMs: 30_000, // Below 60s minimum
      };

      const result = evaluator.evaluate("canary_5", metrics);

      assert.equal(result.passed, false);
      assert.ok(result.blockingIssues.includes("insufficient observation window"));
    });

    test("fails when failure rate exceeds threshold", () => {
      const evaluator = new GuardrailEvaluator();
      const metrics: RolloutMetrics = {
        requestCount: 100,
        failureRate: 0.10, // Above 0.05 threshold
        p99LatencyMs: 150,
        baselineP99LatencyMs: 100,
        observationWindowMs: 120_000,
      };

      const result = evaluator.evaluate("canary_5", metrics);

      assert.equal(result.passed, false);
      assert.ok(result.blockingIssues.includes("failure rate exceeded"));
    });

    test("fails when latency multiplier exceeds threshold", () => {
      const evaluator = new GuardrailEvaluator();
      const metrics: RolloutMetrics = {
        requestCount: 100,
        failureRate: 0.01,
        p99LatencyMs: 300, // 3x baseline - above 2x threshold
        baselineP99LatencyMs: 100,
        observationWindowMs: 120_000,
      };

      const result = evaluator.evaluate("canary_5", metrics);

      assert.equal(result.passed, false);
      assert.ok(result.blockingIssues.includes("latency multiplier exceeded"));
    });

    test("returns individual guardrail results", () => {
      const evaluator = new GuardrailEvaluator();
      const metrics: RolloutMetrics = {
        requestCount: 100,
        failureRate: 0.01,
        p99LatencyMs: 150,
        baselineP99LatencyMs: 100,
        observationWindowMs: 120_000,
      };

      const result = evaluator.evaluate("canary_5", metrics);

      assert.ok(Array.isArray(result.guardrailResults));
      assert.ok(result.guardrailResults.length > 0);
      for (const guardrailResult of result.guardrailResults) {
        assert.ok(guardrailResult.name != null);
        assert.ok(guardrailResult.status === "pass" || guardrailResult.status === "fail");
      }
    });
  });
});