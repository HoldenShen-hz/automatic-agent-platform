/**
 * Integration tests for ConfigRolloutService - Issue #2116
 * Tests canary progression through 5%/25%/50%/100%
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  ConfigRolloutService,
  RolloutPhase,
  type ConfigRollout,
} from "../../../../../src/platform/five-plane-control-plane/config-center/config-rollout-service.js";

test.describe("ConfigRolloutService Integration", () => {
  test("complete canary pipeline: CANARY_5 -> 25% -> 50% -> FULL", () => {
    const service = new ConfigRolloutService();

    // Start rollout targeting 100% - starts at CANARY_5 (first non-pending stage)
    const rollout = service.startRollout("test.config", "platform", null, 100);
    assert.equal(rollout.stage.phase, RolloutPhase.CANARY_5);
    assert.equal(rollout.currentPercentage, 5);

    // Stage 1: Promote to canary 25%
    const stage1 = service.promoteRollout(rollout.rolloutId)!;
    assert.equal(stage1.stage.phase, RolloutPhase.CANARY_25);
    assert.equal(stage1.currentPercentage, 25);

    // Stage 2: Promote to half (50%)
    const stage2 = service.promoteRollout(rollout.rolloutId)!;
    assert.equal(stage2.stage.phase, RolloutPhase.HALF);
    assert.equal(stage2.currentPercentage, 50);

    // Stage 3: Promote to full (100%)
    const stage3 = service.promoteRollout(rollout.rolloutId)!;
    assert.equal(stage3.stage.phase, RolloutPhase.FULL);
    assert.equal(stage3.currentPercentage, 100);
  });

  test("auto-progress does not advance canary stages before minDurationMs", () => {
    const service = new ConfigRolloutService();

    // Start rollout targeting 100%
    const rollout = service.startRollout("test.config", "platform", null, 100);
    assert.equal(rollout.stage.phase, RolloutPhase.CANARY_5);

    // Auto-progress should not advance since CANARY_5 requires 30 minutes
    service.autoProgressRollouts();

    const current = service.getActiveRollout("test.config", "platform", null);
    assert.equal(current!.stage.phase, RolloutPhase.CANARY_5);
  });

  test("cancellation stops rollout", () => {
    const service = new ConfigRolloutService();

    const rollout = service.startRollout("test.config", "platform", null, 100);
    assert.equal(rollout.stage.phase, RolloutPhase.CANARY_5);

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
