/**
 * Integration tests for ConfigRolloutService - Issue #2116
 * Tests canary progression through 5%/25%/50% before FULL
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  ConfigRolloutService,
  RolloutPhase,
  type ConfigRollout,
} from "../../../../../../src/platform/control-plane/config-center/config-rollout-service.js";

test.describe("ConfigRolloutService Integration", () => {
  test("complete canary pipeline: PENDING -> 5% -> 25% -> 50% -> FULL", () => {
    const service = new ConfigRolloutService();

    // Start rollout targeting 100%
    const rollout = service.startRollout("test.config", "platform", null, 100);
    assert.equal(rollout.stage.phase, RolloutPhase.PENDING);
    assert.equal(rollout.currentPercentage, 0);

    // Stage 1: Promote to canary (5%)
    const stage1 = service.promoteRollout(rollout.rolloutId)!;
    assert.equal(stage1.stage.phase, RolloutPhase.CANARY);
    assert.equal(stage1.currentPercentage, 5);

    // Stage 2: Promote to canary 25%
    const stage2 = service.promoteRollout(rollout.rolloutId)!;
    assert.equal(stage2.stage.phase, RolloutPhase.CANARY_25);
    assert.equal(stage2.currentPercentage, 25);

    // Stage 3: Promote to half (50%)
    const stage3 = service.promoteRollout(rollout.rolloutId)!;
    assert.equal(stage3.stage.phase, RolloutPhase.HALF);
    assert.equal(stage3.currentPercentage, 50);

    // Stage 4: Promote to full (100%)
    const stage4 = service.promoteRollout(rollout.rolloutId)!;
    assert.equal(stage4.stage.phase, RolloutPhase.FULL);
    assert.equal(stage4.currentPercentage, 100);
  });

  test("health gates block progression when failed", () => {
    const service = new ConfigRolloutService();

    const rollout = service.startRollout("test.config", "platform", null, 100);

    // Promote to CANARY
    service.promoteRollout(rollout.rolloutId);

    // Fail health check
    service.recordHealthCheck(rollout.rolloutId, {
      errorRate: 5.0, // exceeds threshold of 1%
      latencyRegression: 5,
      incidentRate: 2,
    });

    // Auto-progress should not advance due to failed health check
    service.autoProgressRollouts();

    const current = service.getActiveRollout("test.config", "platform", null);
    assert.equal(current!.stage.phase, RolloutPhase.CANARY);
  });

  test("health gates allow progression when passed", async () => {
    const service = new ConfigRolloutService();

    const rollout = service.startRollout("test.config", "platform", null, 100);

    // Promote to CANARY
    service.promoteRollout(rollout.rolloutId);

    // Pass health check
    service.recordHealthCheck(rollout.rolloutId, {
      errorRate: 0.5,
      latencyRegression: 5,
      incidentRate: 2,
    });

    // Auto-progress should advance
    service.autoProgressRollouts();

    const current = service.getActiveRollout("test.config", "platform", null);
    // Should have auto-progressed to next stage
    assert.ok(
      current!.stage.phase === RolloutPhase.CANARY_25 ||
      current!.stage.phase === RolloutPhase.HALF ||
      current!.stage.phase === RolloutPhase.FULL
    );
  });

  test("rollback restores previous stage", () => {
    const service = new ConfigRolloutService();

    const rollout = service.startRollout("test.config", "platform", null, 100);

    // Progress to CANARY_25
    service.promoteRollout(rollout.rolloutId);
    service.promoteRollout(rollout.rolloutId);

    // Rollback to CANARY
    const rolledBack = service.rollbackToPreviousStage(rollout.rolloutId);

    assert.equal(rolledBack!.stage.phase, RolloutPhase.CANARY);
    assert.equal(rolledBack!.currentPercentage, 5);
  });

  test("cancellation stops rollout", () => {
    const service = new ConfigRolloutService();

    const rollout = service.startRollout("test.config", "platform", null, 100);
    service.promoteRollout(rollout.rolloutId);

    // Cancel
    const cancelled = service.cancelRollout(rollout.rolloutId);

    // Config should not apply
    const decision = service.shouldApplyConfig("test.config", "platform", null, "hash");
    assert.equal(decision.shouldApply, false);
    assert.equal(decision.reason, "rollout_cancelled");
  });

  test("hash-based percentage assignment is deterministic", () => {
    const service = new ConfigRolloutService();

    // Start at FULL (100%) so all hashes apply
    service.startRollout("test.config", "platform", null, 100);

    const decision1 = service.shouldApplyConfig("test.config", "platform", null, "same-hash");
    const decision2 = service.shouldApplyConfig("test.config", "platform", null, "same-hash");

    assert.equal(decision1.percentage, decision2.percentage);
  });
});
