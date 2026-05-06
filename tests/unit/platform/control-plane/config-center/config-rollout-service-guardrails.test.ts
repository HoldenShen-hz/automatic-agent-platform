import assert from "node:assert/strict";
import test from "node:test";

import {
  ConfigRolloutService,
  RolloutPhase,
} from "../../../../../src/platform/control-plane/config-center/config-rollout-service.js";

test("config rollout default stages follow canary to 10 percent to full", () => {
  const service = new ConfigRolloutService();
  const rollout = service.startRollout("config.test", "platform", null, 100);

  const canary = service.promoteRollout(rollout.rolloutId);
  assert.ok(canary);
  assert.equal(canary.stage.phase, RolloutPhase.CANARY);
  assert.equal(canary.currentPercentage, 5);

  const tenPercent = service.promoteRollout(rollout.rolloutId);
  assert.ok(tenPercent);
  assert.equal(tenPercent.stage.phase, RolloutPhase.CANARY_10);
  assert.equal(tenPercent.currentPercentage, 10);

  const full = service.promoteRollout(rollout.rolloutId);
  assert.ok(full);
  assert.equal(full.stage.phase, RolloutPhase.FULL);
  assert.equal(full.currentPercentage, 100);
});

test("config rollout health check failure triggers automatic rollback and preserves observed metrics", () => {
  const service = new ConfigRolloutService();
  const rollout = service.startRollout("config.test", "platform", null, 100);

  service.promoteRollout(rollout.rolloutId);
  const tenPercent = service.promoteRollout(rollout.rolloutId);
  assert.ok(tenPercent);
  assert.equal(tenPercent.stage.phase, RolloutPhase.CANARY_10);

  const updated = service.recordHealthCheck(rollout.rolloutId, {
    errorRate: 2,
    latencyRegression: 12,
    incidentRate: 7,
  });
  assert.ok(updated);
  assert.equal(updated.stage.phase, RolloutPhase.CANARY);
  assert.equal(updated.currentPercentage, 5);

  const health = service.getRolloutHealth(rollout.rolloutId);
  assert.ok(health);
  assert.equal(health.errorRate, 2);
  assert.equal(health.latencyRegression, 12);
  assert.equal(health.incidentRate, 7);
  assert.ok(health.reasons.some((reason) => reason.includes("error_rate")));
});
