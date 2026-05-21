/**
 * Unit Tests: Rollout Monitoring
 *
 * Tests auto-rollback service and rollback state machine for
 * monitoring rollout health and triggering rollback when needed.
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { AutoRollbackService, type AutoRollbackConfig, type AutoRollbackDecision, type RolloutMetrics } from "../../../../../src/platform/five-plane-orchestration/improve-rollout/auto-rollback-service.js";
import { ImprovementRollbackStateMachine, type ImprovementRollbackReceipt } from "../../../../../src/platform/five-plane-orchestration/improve-rollout/rollback-pending-state.js";
import type { RolloutRecord } from "../../../../../src/platform/five-plane-orchestration/oapeflir/types/rollout-record.js";

function createMockRecord(overrides: Partial<RolloutRecord> = {}): RolloutRecord {
  return {
    recordId: "record_test_1",
    candidateId: "candidate_test_1",
    level: "L2_canary",
    previousLevel: "L1_evaluate",
    fromLevel: "L1_evaluate",
    toLevel: "L2_canary",
    strategyVersionId: "sv_test_1",
    status: "canary_5",
    transitionedAt: Date.now(),
    guardrailReasonCodes: [],
    evidence: [],
    ...overrides,
  };
}

describe("AutoRollbackService", () => {
  describe("constructor", () => {
    test("uses default configuration when no config provided", () => {
      const service = new AutoRollbackService();
      assert.ok(service != null);
    });

    test("accepts partial configuration override", () => {
      const service = new AutoRollbackService({ maxFailureRate: 0.1 });
      assert.ok(service != null);
    });

    test("accepts custom rollback handler", () => {
      const handler = (rollout: RolloutRecord, reasonCodes: string[]): void => {
        // Mock handler
      };
      const service = new AutoRollbackService({ rollbackHandler: handler });
      assert.ok(service != null);
    });
  });

  describe("evaluate", () => {
    test("returns rollback:false when sample count is insufficient", () => {
      const service = new AutoRollbackService();
      const record = createMockRecord();
      const metrics: RolloutMetrics = {
        requestCount: 10, // Below minimum of 20
        failureRate: 0.01,
        p99LatencyMs: 100,
        baselineP99LatencyMs: 100,
      };

      const decision = service.evaluate(record, metrics);

      assert.equal(decision.rollback, false);
      assert.ok(decision.reasonCodes.includes("rollout.metrics_insufficient_sample"));
    });

    test("returns rollback:false when observation window is too short", () => {
      const service = new AutoRollbackService();
      const record = createMockRecord();
      const metrics: RolloutMetrics = {
        requestCount: 100,
        failureRate: 0.01,
        p99LatencyMs: 100,
        baselineP99LatencyMs: 100,
        observationWindowMs: 30_000, // Below minimum of 60s
      };

      const decision = service.evaluate(record, metrics);

      assert.equal(decision.rollback, false);
      assert.ok(decision.reasonCodes.includes("rollout.metrics_insufficient_window"));
    });

    test("returns rollback:true when failure rate exceeds threshold", () => {
      const service = new AutoRollbackService({
        maxFailureRate: 0.05,
      });
      const record = createMockRecord();
      const metrics: RolloutMetrics = {
        requestCount: 100,
        failureRate: 0.10, // 10% - above 5% threshold
        p99LatencyMs: 100,
        baselineP99LatencyMs: 100,
        observationWindowMs: 120_000,
      };

      const decision = service.evaluate(record, metrics);

      assert.equal(decision.rollback, true);
      assert.ok(decision.reasonCodes.includes("rollout.failure_rate_exceeded"));
    });

    test("returns rollback:true when latency multiplier exceeds threshold", () => {
      const service = new AutoRollbackService({
        maxLatencyMultiplier: 2,
      });
      const record = createMockRecord();
      const metrics: RolloutMetrics = {
        requestCount: 100,
        failureRate: 0.01,
        p99LatencyMs: 300, // 3x baseline
        baselineP99LatencyMs: 100,
        observationWindowMs: 120_000,
      };

      const decision = service.evaluate(record, metrics);

      assert.equal(decision.rollback, true);
      assert.ok(decision.reasonCodes.includes("rollout.latency_multiplier_exceeded"));
    });

    test("returns rollback:true with multiple reason codes when both thresholds exceeded", () => {
      const service = new AutoRollbackService({
        maxFailureRate: 0.05,
        maxLatencyMultiplier: 2,
      });
      const record = createMockRecord();
      const metrics: RolloutMetrics = {
        requestCount: 100,
        failureRate: 0.10, // Exceeds 5%
        p99LatencyMs: 300, // 3x baseline - exceeds 2x
        baselineP99LatencyMs: 100,
        observationWindowMs: 120_000,
      };

      const decision = service.evaluate(record, metrics);

      assert.equal(decision.rollback, true);
      assert.ok(decision.reasonCodes.length >= 2);
      assert.ok(decision.reasonCodes.includes("rollout.failure_rate_exceeded"));
      assert.ok(decision.reasonCodes.includes("rollout.latency_multiplier_exceeded"));
    });

    test("returns rollback:false when all metrics are healthy", () => {
      const service = new AutoRollbackService();
      const record = createMockRecord();
      const metrics: RolloutMetrics = {
        requestCount: 100,
        failureRate: 0.01,
        p99LatencyMs: 105,
        baselineP99LatencyMs: 100,
        observationWindowMs: 120_000,
      };

      const decision = service.evaluate(record, metrics);

      assert.equal(decision.rollback, false);
      assert.equal(decision.reasonCodes.length, 0);
    });

    test("uses default observation window when not provided", () => {
      const service = new AutoRollbackService();
      const record = createMockRecord();
      const metrics: RolloutMetrics = {
        requestCount: 100,
        failureRate: 0.01,
        p99LatencyMs: 100,
        baselineP99LatencyMs: 100,
        // No observationWindowMs provided
      };

      const decision = service.evaluate(record, metrics);

      // Should pass since observation window defaults to 60s and metrics have sufficient sample
      assert.equal(decision.rollback, false);
    });

    test("handles zero baseline latency gracefully", () => {
      const service = new AutoRollbackService();
      const record = createMockRecord();
      const metrics: RolloutMetrics = {
        requestCount: 100,
        failureRate: 0.01,
        p99LatencyMs: 100,
        baselineP99LatencyMs: 0, // Zero baseline
        observationWindowMs: 120_000,
      };

      const decision = service.evaluate(record, metrics);

      // Should not throw and should evaluate based on failure rate
      assert.equal(typeof decision.rollback, "boolean");
    });
  });

  describe("rollback handler", () => {
    test("calls rollback handler when rollback is triggered", () => {
      let handlerCalled = false;
      const handler = (rollout: RolloutRecord, reasonCodes: string[]): void => {
        handlerCalled = true;
        assert.equal(rollout.recordId, "record_test_1");
        assert.ok(reasonCodes.length > 0);
      };

      const service = new AutoRollbackService({
        maxFailureRate: 0.05,
        rollbackHandler: handler,
      });
      const record = createMockRecord();
      const metrics: RolloutMetrics = {
        requestCount: 100,
        failureRate: 0.10,
        p99LatencyMs: 100,
        baselineP99LatencyMs: 100,
        observationWindowMs: 120_000,
      };

      service.evaluate(record, metrics);

      assert.equal(handlerCalled, true);
    });

    test("does not call rollback handler when rollback is not triggered", () => {
      let handlerCalled = false;
      const handler = (): void => {
        throw new Error("Handler should not be called");
      };

      const service = new AutoRollbackService({
        rollbackHandler: handler,
      });
      const record = createMockRecord();
      const metrics: RolloutMetrics = {
        requestCount: 100,
        failureRate: 0.01,
        p99LatencyMs: 100,
        baselineP99LatencyMs: 100,
        observationWindowMs: 120_000,
      };

      service.evaluate(record, metrics);

      assert.equal(handlerCalled, false);
    });
  });
});

describe("ImprovementRollbackStateMachine", () => {
  describe("requestRollback", () => {
    test("creates rollback receipt for released improvement", () => {
      const stateMachine = new ImprovementRollbackStateMachine();
      const receipt = stateMachine.requestRollback("improvement_1", "released");

      assert.equal(receipt.improvementId, "improvement_1");
      assert.equal(receipt.fromState, "released");
      assert.equal(receipt.toState, "rollback_pending");
      assert.equal(receipt.postmortemRequired, true);
      assert.equal(receipt.reasonCode, "improvement.rollback_pending");
    });

    test("throws error when improvement is not in released state", () => {
      const stateMachine = new ImprovementRollbackStateMachine();

      assert.throws(
        () => stateMachine.requestRollback("improvement_1", "rollback_pending"),
        /improvement.rollback_requires_released/,
      );
    });

    test("throws error with improvement ID in message", () => {
      const stateMachine = new ImprovementRollbackStateMachine();

      try {
        stateMachine.requestRollback("improvement_specific_id", "rollback_pending");
        assert.fail("Should have thrown");
      } catch (error) {
        assert.ok(error instanceof Error);
        assert.ok(error.message.includes("improvement_specific_id"));
      }
    });
  });

  describe("completeRollback", () => {
    test("creates rollback receipt for rollback_pending improvement", () => {
      const stateMachine = new ImprovementRollbackStateMachine();
      const receipt = stateMachine.completeRollback("improvement_1", "rollback_pending");

      assert.equal(receipt.improvementId, "improvement_1");
      assert.equal(receipt.fromState, "rollback_pending");
      assert.equal(receipt.toState, "rolled_back");
      assert.equal(receipt.postmortemRequired, true);
      assert.equal(receipt.reasonCode, "improvement.rolled_back");
    });

    test("throws error when improvement is not in rollback_pending state", () => {
      const stateMachine = new ImprovementRollbackStateMachine();

      assert.throws(
        () => stateMachine.completeRollback("improvement_1", "released"),
        /improvement.rollback_complete_requires_pending/,
      );
    });

    test("throws error with improvement ID in message", () => {
      const stateMachine = new ImprovementRollbackStateMachine();

      try {
        stateMachine.completeRollback("improvement_specific_id", "released");
        assert.fail("Should have thrown");
      } catch (error) {
        assert.ok(error instanceof Error);
        assert.ok(error.message.includes("improvement_specific_id"));
      }
    });
  });

  describe("state transitions", () => {
    test("full rollback lifecycle: released -> rollback_pending -> rolled_back", () => {
      const stateMachine = new ImprovementRollbackStateMachine();

      const pendingReceipt = stateMachine.requestRollback("improvement_1", "released");
      assert.equal(pendingReceipt.toState, "rollback_pending");

      const completedReceipt = stateMachine.completeRollback("improvement_1", "rollback_pending");
      assert.equal(completedReceipt.toState, "rolled_back");
    });

    test("rollback receipt is immutable", () => {
      const stateMachine = new ImprovementRollbackStateMachine();
      const receipt = stateMachine.requestRollback("improvement_1", "released");

      // Verify readonly properties
      assert.equal(receipt.improvementId, "improvement_1");
      assert.equal(Object.isFrozen(receipt), true);
    });
  });
});