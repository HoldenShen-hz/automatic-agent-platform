/**
 * Unit Tests: Rollout Release Policy and Autonomy Boundary
 *
 * Tests release policy structures and autonomy boundary decisions
 * for rollout governance.
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import type { ReleasePolicy, ReleasePolicyEvaluation, PolicyCheckResult, ReleaseAction } from "../../../../../src/platform/five-plane-orchestration/improve-rollout/release-policy.js";
import { AutonomyBoundaryPolicy, type AutonomyBoundaryDecision, type AutonomyTarget } from "../../../../../src/platform/five-plane-orchestration/improve-rollout/autonomy-boundary-policy.js";
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

describe("ReleasePolicy", () => {
  describe("ReleasePolicy interface structure", () => {
    test("has required fields for policy definition", () => {
      const policy: ReleasePolicy = {
        policyId: "policy_1",
        name: "Test Policy",
        description: "Test description",
        targetLevels: ["L2_canary", "L3_partial"],
        trafficAllocation: {
          L0_off: 0,
          L1_evaluate: 0,
          L2_canary: 5,
          L3_partial: 25,
          L4_stable: 75,
          L5_full: 100,
        },
        minimumObservationWindowMs: 60_000,
        rollbackFailureRateThreshold: 0.05,
        rollbackLatencyMultiplierThreshold: 2,
        requiresHumanApproval: true,
        active: true,
      };

      assert.equal(policy.policyId, "policy_1");
      assert.equal(policy.name, "Test Policy");
      assert.deepEqual(policy.targetLevels, ["L2_canary", "L3_partial"]);
      assert.ok(policy.minimumObservationWindowMs > 0);
    });

    test("allows custom rollback thresholds", () => {
      const policy: ReleasePolicy = {
        policyId: "policy_strict",
        name: "Strict Policy",
        description: "Stricter thresholds",
        targetLevels: ["L4_stable"],
        trafficAllocation: {
          L0_off: 0,
          L1_evaluate: 0,
          L2_canary: 5,
          L3_partial: 25,
          L4_stable: 75,
          L5_full: 100,
        },
        minimumObservationWindowMs: 120_000, // Longer window
        rollbackFailureRateThreshold: 0.02, // Stricter 2%
        rollbackLatencyMultiplierThreshold: 1.5, // Stricter 1.5x
        requiresHumanApproval: true,
        active: true,
      };

      assert.equal(policy.rollbackFailureRateThreshold, 0.02);
      assert.equal(policy.rollbackLatencyMultiplierThreshold, 1.5);
    });
  });

  describe("ReleasePolicyEvaluation structure", () => {
    test("contains policy, passed flag, checks, and recommended action", () => {
      const policy: ReleasePolicy = {
        policyId: "policy_eval_1",
        name: "Eval Policy",
        description: "For evaluation",
        targetLevels: ["L2_canary"],
        trafficAllocation: {
          L0_off: 0,
          L1_evaluate: 0,
          L2_canary: 5,
          L3_partial: 25,
          L4_stable: 75,
          L5_full: 100,
        },
        minimumObservationWindowMs: 60_000,
        rollbackFailureRateThreshold: 0.05,
        rollbackLatencyMultiplierThreshold: 2,
        requiresHumanApproval: false,
        active: true,
      };

      const evaluation: ReleasePolicyEvaluation = {
        policy,
        passed: true,
        checks: [
          {
            checkName: "sample_count",
            passed: true,
            details: "100 requests",
            severity: "info",
          },
        ],
        recommendedAction: "promote",
        reason: "All checks passed",
      };

      assert.equal(evaluation.policy.policyId, "policy_eval_1");
      assert.equal(evaluation.passed, true);
      assert.equal(evaluation.recommendedAction, "promote");
      assert.ok(evaluation.checks.length > 0);
    });

    test("supports different release actions", () => {
      const actions: ReleaseAction[] = ["promote", "demote", "rollback", "hold", "require_approval"];

      for (const action of actions) {
        const evaluation: ReleasePolicyEvaluation = {
          policy: {
            policyId: "action_test",
            name: "Action Test",
            description: "Test",
            targetLevels: ["L2_canary"],
            trafficAllocation: {
              L0_off: 0,
              L1_evaluate: 0,
              L2_canary: 5,
              L3_partial: 25,
              L4_stable: 75,
              L5_full: 100,
            },
            minimumObservationWindowMs: 60_000,
            rollbackFailureRateThreshold: 0.05,
            rollbackLatencyMultiplierThreshold: 2,
            requiresHumanApproval: false,
            active: true,
          },
          passed: true,
          checks: [],
          recommendedAction: action,
          reason: "Test",
        };
        assert.equal(evaluation.recommendedAction, action);
      }
    });
  });

  describe("PolicyCheckResult structure", () => {
    test("contains check metadata", () => {
      const check: PolicyCheckResult = {
        checkName: "failure_rate_check",
        passed: false,
        details: "Failure rate 0.08 exceeds threshold 0.05",
        severity: "critical",
      };

      assert.equal(check.checkName, "failure_rate_check");
      assert.equal(check.passed, false);
      assert.equal(check.severity, "critical");
    });

    test("supports info severity for non-blocking issues", () => {
      const check: PolicyCheckResult = {
        checkName: "sample_size",
        passed: true,
        details: "Sufficient samples collected",
        severity: "info",
      };

      assert.equal(check.severity, "info");
    });
  });
});

describe("AutonomyBoundaryPolicy", () => {
  describe("decide", () => {
    test("allows routing_policy target without learning objects", () => {
      const policy = new AutonomyBoundaryPolicy();
      const decision = policy.decide("routing_policy", []);

      assert.equal(decision.allowed, true);
      assert.equal(decision.reasonCode, "improvement.allowed");
    });

    test("allows planning_policy target", () => {
      const policy = new AutonomyBoundaryPolicy();
      const decision = policy.decide("planning_policy", []);

      assert.equal(decision.allowed, true);
      assert.equal(decision.reasonCode, "improvement.allowed");
    });

    test("allows execution_policy target", () => {
      const policy = new AutonomyBoundaryPolicy();
      const decision = policy.decide("execution_policy", []);

      assert.equal(decision.allowed, true);
      assert.equal(decision.reasonCode, "improvement.allowed");
    });

    test("allows memory_policy target", () => {
      const policy = new AutonomyBoundaryPolicy();
      const decision = policy.decide("memory_policy", []);

      assert.equal(decision.allowed, true);
      assert.equal(decision.reasonCode, "improvement.allowed");
    });

    test("blocks sandbox_policy target requiring manual approval", () => {
      const policy = new AutonomyBoundaryPolicy();
      const decision = policy.decide("sandbox_policy", []);

      assert.equal(decision.allowed, false);
      assert.equal(decision.reasonCode, "improvement.manual_approval_required");
    });

    test("blocks provider_registry target requiring manual approval", () => {
      const policy = new AutonomyBoundaryPolicy();
      const decision = policy.decide("provider_registry", []);

      assert.equal(decision.allowed, false);
      assert.equal(decision.reasonCode, "improvement.manual_approval_required");
    });

    test("allows routing_policy when learning objects are validated", () => {
      const policy = new AutonomyBoundaryPolicy();
      const learningObjects = [
        createMockLearningObject({ evidenceRefs: ["signal_1"], promotionStatus: "validated" }),
        createMockLearningObject({ evidenceRefs: ["signal_2"], promotionStatus: "promoted" }),
      ];

      const decision = policy.decide("routing_policy", learningObjects);

      assert.equal(decision.allowed, true);
      assert.equal(decision.reasonCode, "improvement.allowed");
    });

    test("blocks routing_policy when learning objects are not validated", () => {
      const policy = new AutonomyBoundaryPolicy();
      const learningObjects = [
        createMockLearningObject({ evidenceRefs: ["signal_1"], promotionStatus: "pending" }),
      ];

      const decision = policy.decide("routing_policy", learningObjects);

      assert.equal(decision.allowed, false);
      assert.equal(decision.reasonCode, "improvement.learning_object_not_validated");
    });

    test("blocks routing_policy when learning objects lack evidence", () => {
      const policy = new AutonomyBoundaryPolicy();
      const learningObjects = [
        createMockLearningObject({ evidenceRefs: [], promotionStatus: "validated" }),
      ];

      const decision = policy.decide("routing_policy", learningObjects);

      assert.equal(decision.allowed, false);
      assert.equal(decision.reasonCode, "improvement.learning_object_not_validated");
    });

    test("allows with mixed learning objects when all are validated", () => {
      const policy = new AutonomyBoundaryPolicy();
      const learningObjects = [
        createMockLearningObject({ evidenceRefs: ["signal_1"], promotionStatus: "validated" }),
        createMockLearningObject({ evidenceRefs: ["signal_2"], promotionStatus: "pending" }), // Not validated
      ];

      const decision = policy.decide("routing_policy", learningObjects);

      assert.equal(decision.allowed, false);
    });

    test("allows with all validated learning objects", () => {
      const policy = new AutonomyBoundaryPolicy();
      const learningObjects = [
        createMockLearningObject({ evidenceRefs: ["signal_1"], promotionStatus: "validated" }),
        createMockLearningObject({ evidenceRefs: ["signal_2"], promotionStatus: "promoted" }),
      ];

      const decision = policy.decide("routing_policy", learningObjects);

      assert.equal(decision.allowed, true);
    });
  });

  describe("AutonomyBoundaryDecision structure", () => {
    test("contains allowed flag and reason code", () => {
      const policy = new AutonomyBoundaryPolicy();
      const decision = policy.decide("routing_policy", []);

      assert.equal(typeof decision.allowed, "boolean");
      assert.equal(typeof decision.reasonCode, "string");
    });
  });
});