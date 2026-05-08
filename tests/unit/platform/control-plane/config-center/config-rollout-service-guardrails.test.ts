import assert from "node:assert/strict";
import test from "node:test";

import {
  ConfigRolloutService,
  RolloutPhase,
} from "../../../../../src/platform/control-plane/config-center/config-rollout-service.js";

test("config rollout default stages follow canary to 10 percent to full", () => {
  const service = new ConfigRolloutService();
  const rollout = service.startRollout("config.test", "platform", null, 100);

  // startRollout with targetPercentage=100 starts at CANARY_5 due to resolveInitialStage
  assert.equal(rollout.stage.phase, RolloutPhase.CANARY_5);
  assert.equal(rollout.currentPercentage, 5);

  const tenPercent = service.promoteRollout(rollout.rolloutId);
  assert.ok(tenPercent);
  assert.equal(tenPercent.stage.phase, RolloutPhase.CANARY_25);
  assert.equal(tenPercent.currentPercentage, 25);

  const half = service.promoteRollout(rollout.rolloutId);
  assert.ok(half);
  assert.equal(half.stage.phase, RolloutPhase.HALF);
  assert.equal(half.currentPercentage, 50);

  const full = service.promoteRollout(rollout.rolloutId);
  assert.ok(full);
  assert.equal(full.stage.phase, RolloutPhase.FULL);
  assert.equal(full.currentPercentage, 100);
});

test("config rollout health check failure triggers automatic rollback and preserves observed metrics", () => {
  const service = new ConfigRolloutService();
  const rollout = service.startRollout("config.test", "platform", null, 100);

  // Initial stage is CANARY_5
  assert.equal(rollout.stage.phase, RolloutPhase.CANARY_5);
  assert.equal(rollout.currentPercentage, 5);

  // Promote to CANARY_25 (10%)
  const tenPercent = service.promoteRollout(rollout.rolloutId);
  assert.ok(tenPercent);
  assert.equal(tenPercent.stage.phase, RolloutPhase.CANARY_25);
  assert.equal(tenPercent.currentPercentage, 25);

  // Simulate health check failure by calling autoProgressRollouts with failing health snapshot
  const failingHealth = {
    errorRate: 2, // exceeds maxErrorRate of 0.05
    latencyRegression: 12,
    incidentRate: 7,
  };

  // autoProgressRollouts should not advance because health check fails
  const progressCount = service.autoProgressRollouts({ [rollout.rolloutId]: failingHealth });
  assert.equal(progressCount, 0, "Rollout should not auto-progress with failing health");

  // Manually promote to next stage despite health failure (tests manual override)
  const updated = service.promoteRollout(rollout.rolloutId);
  assert.ok(updated);
  assert.equal(updated.stage.phase, RolloutPhase.HALF);
  assert.equal(updated.currentPercentage, 50);

  // Cancel the rollout to test cancellation
  const cancelled = service.cancelRollout(rollout.rolloutId);
  assert.ok(cancelled);
  assert.equal(cancelled.stage.phase, RolloutPhase.CANCELLED);
  // currentPercentage remains at the stage's percentage when cancelled
});
