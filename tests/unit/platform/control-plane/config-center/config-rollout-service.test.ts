/**
 * Unit tests for ConfigRolloutService
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  ConfigRolloutService,
  RolloutPhase,
} from "../../../../../src/platform/control-plane/config-center/config-rollout-service.js";

test("ConfigRolloutService.startRollout creates a new rollout with default stages", () => {
  const service = new ConfigRolloutService();
  const rollout = service.startRollout("runtime.timeout", "platform", null);

  assert.ok(rollout.rolloutId);
  assert.equal(rollout.configPath, "runtime.timeout");
  assert.equal(rollout.layer, "platform");
  assert.equal(rollout.sourceId, null);
  assert.ok(rollout.startedAt);
  assert.ok(rollout.updatedAt);
});

test("ConfigRolloutService.startRollout defaults to FULL stage for 100% target", () => {
  const service = new ConfigRolloutService();
  const rollout = service.startRollout("runtime.timeout", "platform", null, 100);

  assert.equal(rollout.stage.phase, RolloutPhase.FULL);
  assert.equal(rollout.currentPercentage, 100);
  assert.equal(rollout.targetPercentage, 100);
});

test("ConfigRolloutService.startRollout starts at CANARY_5 for target below 25%", () => {
  const service = new ConfigRolloutService();
  const rollout = service.startRollout("runtime.timeout", "platform", null, 5);

  assert.equal(rollout.stage.phase, RolloutPhase.CANARY_5);
  assert.equal(rollout.currentPercentage, 5);
});

test("ConfigRolloutService.shouldApplyConfig returns shouldApply:true when no active rollout", () => {
  const service = new ConfigRolloutService();
  const decision = service.shouldApplyConfig("runtime.timeout", "platform", null, "hash-123");

  assert.equal(decision.shouldApply, true);
  assert.equal(decision.rolloutId, null);
  assert.equal(decision.reason, "no_active_rollout");
});

test("ConfigRolloutService.shouldApplyConfig returns shouldApply:false for PENDING rollout", () => {
  const service = new ConfigRolloutService();
  service.startRollout("runtime.timeout", "platform", null, 0);

  const decision = service.shouldApplyConfig("runtime.timeout", "platform", null, "hash-123");

  assert.equal(decision.shouldApply, false);
  assert.equal(decision.reason, "rollout_pending");
});

test("ConfigRolloutService.shouldApplyConfig returns shouldApply:false for CANCELLED rollout", () => {
  const service = new ConfigRolloutService();
  const rollout = service.startRollout("runtime.timeout", "platform", null);
  service.cancelRollout(rollout.rolloutId);

  const decision = service.shouldApplyConfig("runtime.timeout", "platform", null, "hash-123");

  assert.equal(decision.shouldApply, false);
  assert.equal(decision.reason, "rollout_cancelled");
});

test("ConfigRolloutService.shouldApplyConfig applies config based on hash percentage", () => {
  const service = new ConfigRolloutService();
  // Start at FULL (100%) so all hashes will match
  const rollout = service.startRollout("runtime.timeout", "platform", null, 100);

  // With 100%, all hashes should be below percentage
  const decision = service.shouldApplyConfig("runtime.timeout", "platform", null, "any-hash");

  assert.equal(decision.shouldApply, true);
  assert.equal(decision.rolloutId, rollout.rolloutId);
});

test("ConfigRolloutService.promoteRollout advances to next stage", () => {
  const service = new ConfigRolloutService();
  const rollout = service.startRollout("runtime.timeout", "platform", null, 5);

  assert.equal(rollout.stage.phase, RolloutPhase.CANARY_5);

  const promoted = service.promoteRollout(rollout.rolloutId);

  assert.ok(promoted);
  assert.equal(promoted!.stage.phase, RolloutPhase.CANARY_25);
  assert.equal(promoted!.currentPercentage, 25);
});

test("ConfigRolloutService.promoteRollout returns null for non-existent rollout", () => {
  const service = new ConfigRolloutService();
  const result = service.promoteRollout("non-existent-id");

  assert.equal(result, null);
});

test("ConfigRolloutService.cancelRollout cancels the rollout", () => {
  const service = new ConfigRolloutService();
  const rollout = service.startRollout("runtime.timeout", "platform", null);

  const cancelled = service.cancelRollout(rollout.rolloutId);

  assert.ok(cancelled);
  assert.equal(cancelled!.stage.phase, RolloutPhase.CANCELLED);
});

test("ConfigRolloutService.getActiveRollout returns correct rollout", () => {
  const service = new ConfigRolloutService();
  const rollout = service.startRollout("runtime.timeout", "platform", "tenant-1");

  const found = service.getActiveRollout("runtime.timeout", "platform", "tenant-1");

  assert.ok(found);
  assert.equal(found!.rolloutId, rollout.rolloutId);
});

test("ConfigRolloutService.getActiveRollout returns null for non-existent", () => {
  const service = new ConfigRolloutService();
  const found = service.getActiveRollout("non.existent", "platform", null);

  assert.equal(found, null);
});

test("ConfigRolloutService.getActiveRollouts returns all active rollouts", () => {
  const service = new ConfigRolloutService();
  service.startRollout("config.1", "platform", null);
  service.startRollout("config.2", "tenant", "tenant-1");

  const rollouts = service.getActiveRollouts();

  assert.equal(rollouts.length, 2);
});

test("ConfigRolloutService.autoProgressRollouts does not auto-progress non-auto stages", () => {
  const service = new ConfigRolloutService();
  const rollout = service.startRollout("runtime.timeout", "platform", null, 100);

  // FULL stage has autoProgress: false
  const progressed = service.autoProgressRollouts();

  assert.equal(progressed, 0);
});

test("ConfigRolloutService.cleanupRollouts removes old completed rollouts", () => {
  const service = new ConfigRolloutService();
  const rollout = service.startRollout("runtime.timeout", "platform", null);

  // Manually set to FULL and old
  rollout.stage = { phase: RolloutPhase.FULL, percentage: 100, minDurationMs: 0, autoProgress: false };
  rollout.updatedAt = new Date(Date.now() - 90000000).toISOString(); // 25 hours ago

  const cleaned = service.cleanupRollouts(86400000); // 24 hours

  assert.equal(cleaned, 1);
  assert.equal(service.getActiveRollouts().length, 0);
});

test("ConfigRolloutService.cleanupRollouts keeps recent rollouts", () => {
  const service = new ConfigRolloutService();
  service.startRollout("runtime.timeout", "platform", null);

  const cleaned = service.cleanupRollouts(86400000);

  assert.equal(cleaned, 0);
  assert.equal(service.getActiveRollouts().length, 1);
});

test("ConfigRolloutService.startRollout accepts metadata", () => {
  const service = new ConfigRolloutService();
  const rollout = service.startRollout("runtime.timeout", "platform", null, 100, {
    changedBy: "admin@example.com",
    reason: "Performance improvement",
  });

  assert.deepEqual(rollout.metadata, {
    changedBy: "admin@example.com",
    reason: "Performance improvement",
  });
});
