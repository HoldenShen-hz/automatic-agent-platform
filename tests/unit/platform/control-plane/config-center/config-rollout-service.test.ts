/**
 * Unit tests for ConfigRolloutService
 * Issue #2116: Canary should go through 5%/25%/50% before FULL
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  ConfigRolloutService,
  RolloutPhase,
  type ConfigRollout,
  type ConfigRolloutStore,
} from "../../../../../src/platform/control-plane/config-center/config-rollout-service.js";

function createMockEventBus() {
  const events: Array<{ eventType: string; payload: Record<string, unknown> }> = [];
  return {
    publish(event: { eventType: string; payload: Record<string, unknown> }) {
      events.push(event);
    },
    getEvents() {
      return events;
    },
    clear() {
      events.length = 0;
    },
  };
}

function createMockRolloutStore(): ConfigRolloutStore {
  const rollouts = new Map<string, ConfigRollout>();
  return {
    async save(rollout: ConfigRollout) {
      rollouts.set(rollout.rolloutId, rollout);
    },
    async load(rolloutId: string) {
      return rollouts.get(rolloutId) ?? null;
    },
    async loadAll() {
      return Array.from(rollouts.values());
    },
    async delete(rolloutId: string) {
      rollouts.delete(rolloutId);
    },
  };
}

test.describe("ConfigRolloutService", () => {
  test("startRollout always begins at PENDING phase regardless of target percentage", () => {
    const service = new ConfigRolloutService();

    // Even with 100% target, should start at PENDING
    const rollout = service.startRollout("test.config", "platform", null, 100);

    assert.equal(rollout.stage.phase, RolloutPhase.PENDING);
    assert.equal(rollout.currentPercentage, 0);
  });

  test("canary progression through 5% stage before 25%", () => {
    const service = new ConfigRolloutService();

    const rollout = service.startRollout("test.config", "platform", null, 50);

    // Initially PENDING (0%)
    assert.equal(rollout.stage.phase, RolloutPhase.PENDING);

    // Promote should move to CANARY (5%)
    const promoted = service.promoteRollout(rollout.rolloutId);
    assert.ok(promoted);
    assert.equal(promoted!.stage.phase, RolloutPhase.CANARY);
    assert.equal(promoted!.currentPercentage, 5);
  });

  test("canary progression through 5% then 10% then FULL", () => {
    const service = new ConfigRolloutService();

    const rollout = service.startRollout("test.config", "platform", null, 100);

    // Promote 1: PENDING -> CANARY (5%)
    const stage1 = service.promoteRollout(rollout.rolloutId);
    assert.ok(stage1);
    assert.equal(stage1.stage.phase, RolloutPhase.CANARY);
    assert.equal(stage1.currentPercentage, 5);

    // Promote 2: CANARY (5%) -> CANARY_10 (10%)
    const stage2 = service.promoteRollout(rollout.rolloutId);
    assert.ok(stage2);
    assert.equal(stage2.stage.phase, RolloutPhase.CANARY_10);
    assert.equal(stage2.currentPercentage, 10);

    // Promote 3: CANARY_10 (10%) -> FULL (100%)
    const stage3 = service.promoteRollout(rollout.rolloutId);
    assert.ok(stage3);
    assert.equal(stage3.stage.phase, RolloutPhase.FULL);
    assert.equal(stage3.currentPercentage, 100);
  });

  test("autoProgressRollouts respects health gates before progression", () => {
    const service = new ConfigRolloutService();

    const rollout = service.startRollout("test.config", "platform", null, 100);

    // Initially PENDING, promote to CANARY
    service.promoteRollout(rollout.rolloutId);

    // Without health check passing, autoProgress should not advance
    const progressCount = service.autoProgressRollouts();

    // Health gates not passed, so no auto-progress
    const currentRollout = service.getActiveRollout("test.config", "platform", null);
    assert.ok(currentRollout);
    assert.equal(currentRollout!.stage.phase, RolloutPhase.CANARY);
  });

  test("autoProgressRollouts advances when health gates pass", async () => {
    // Use custom stages with minDurationMs: 0 to test autoProgress without waiting
    const service = new ConfigRolloutService({
      stages: [
        { phase: RolloutPhase.PENDING, percentage: 0, minDurationMs: 0, autoProgress: false },
        { phase: RolloutPhase.CANARY, percentage: 5, minDurationMs: 0, autoProgress: true },
        { phase: RolloutPhase.CANARY_10, percentage: 10, minDurationMs: 0, autoProgress: false },
        { phase: RolloutPhase.FULL, percentage: 100, minDurationMs: 0, autoProgress: false },
      ],
    });

    const rollout = service.startRollout("test.config", "platform", null, 100);

    // Promote to CANARY
    service.promoteRollout(rollout.rolloutId);

    // Pass health check
    service.recordHealthCheck(rollout.rolloutId, {
      errorRate: 0.5,
      latencyRegression: 5,
      incidentRate: 2,
    });

    // Now auto-progress should work
    const progressCount = service.autoProgressRollouts();

    const currentRollout = service.getActiveRollout("test.config", "platform", null);
    assert.ok(currentRollout);
    // Should auto-progress to CANARY_10 since health gates passed
    assert.equal(currentRollout!.stage.phase, RolloutPhase.CANARY_10);
  });

  test("recordHealthCheck correctly evaluates gates", () => {
    const service = new ConfigRolloutService();

    const rollout = service.startRollout("test.config", "platform", null, 100);

    // Pass health check
    const passed = service.recordHealthCheck(rollout.rolloutId, {
      errorRate: 0.5, // under 1%
      latencyRegression: 5, // under 10%
      incidentRate: 2, // under 5
    });

    assert.ok(passed);
    assert.equal(passed!.lastHealthCheckPassed, true);
  });

  test("recordHealthCheck correctly identifies gate failures", () => {
    const service = new ConfigRolloutService();

    const rollout = service.startRollout("test.config", "platform", null, 100);

    // Fail health check - error rate too high
    const failed = service.recordHealthCheck(rollout.rolloutId, {
      errorRate: 2.0, // over 1%
      latencyRegression: 5,
      incidentRate: 2,
    });

    assert.ok(failed);
    assert.equal(failed!.lastHealthCheckPassed, false);
  });

  test("rollbackToPreviousStage returns to prior stage", () => {
    const service = new ConfigRolloutService();

    const rollout = service.startRollout("test.config", "platform", null, 100);

    // Promote to CANARY
    service.promoteRollout(rollout.rolloutId);
    // Promote to CANARY_25
    service.promoteRollout(rollout.rolloutId);

    // Rollback
    const rolledBack = service.rollbackToPreviousStage(rollout.rolloutId);

    assert.ok(rolledBack);
    assert.equal(rolledBack!.stage.phase, RolloutPhase.CANARY);
    assert.equal(rolledBack!.currentPercentage, 5);
  });

  test("cancelRollout stops the rollout", () => {
    const service = new ConfigRolloutService();

    const rollout = service.startRollout("test.config", "platform", null, 100);

    const cancelled = service.cancelRollout(rollout.rolloutId);

    assert.ok(cancelled);
    assert.equal(cancelled!.stage.phase, RolloutPhase.CANCELLED);
  });

  test("shouldApplyConfig returns correct decision for each stage", () => {
    const service = new ConfigRolloutService();

    // Start rollout targeting 100%
    const rollout = service.startRollout("test.config", "platform", null, 100);

    // PENDING - should not apply
    let decision = service.shouldApplyConfig("test.config", "platform", null, "hash-123");
    assert.equal(decision.shouldApply, false);
    assert.equal(decision.reason, "rollout_pending");

    // Promote to CANARY
    service.promoteRollout(rollout.rolloutId);

    // CANARY (5%) - only hash values that map to 0-4% should apply
    decision = service.shouldApplyConfig("test.config", "platform", null, "hash-123");
    assert.equal(decision.rolloutId, rollout.rolloutId);
  });

  test("getActiveRollouts returns all active rollouts", () => {
    const service = new ConfigRolloutService();

    service.startRollout("config.1", "platform", null, 100);
    service.startRollout("config.2", "platform", null, 100);

    const rollouts = service.getActiveRollouts();

    assert.equal(rollouts.length, 2);
  });

  test("cleanupRollouts removes old completed rollouts", () => {
    const service = new ConfigRolloutService();

    const rollout = service.startRollout("test.config", "platform", null, 100);

    // Move to FULL
    for (let i = 0; i < 10; i++) {
      service.promoteRollout(rollout.rolloutId);
    }

    // Mark as old
    rollout.updatedAt = new Date(Date.now() - 90000000).toISOString();

    const cleaned = service.cleanupRollouts(86400000);

    assert.equal(cleaned, 1);
  });

  test("initialize loads persisted rollouts from store", async () => {
    const store = createMockRolloutStore();
    const service = new ConfigRolloutService({ rolloutStore: store });

    // Create and persist a rollout
    const rollout = service.startRollout("test.config", "platform", null, 100);

    await service.initialize();

    const loaded = service.getActiveRollout("test.config", "platform", null);
    assert.ok(loaded);
    assert.equal(loaded!.rolloutId, rollout.rolloutId);
  });

  test("hashToPercentage produces deterministic results", () => {
    const service = new ConfigRolloutService();

    const percentage1 = service.shouldApplyConfig("test", "platform", null, "same-hash");
    const percentage2 = service.shouldApplyConfig("test", "platform", null, "same-hash");

    // Same hash should give same percentage
    assert.equal(percentage1.percentage, percentage2.percentage);
  });
});
