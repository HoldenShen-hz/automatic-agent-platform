/**
 * Unit tests for ConfigRolloutService CANARY_5 minDurationMs fix (§24)
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  ConfigRolloutService,
  RolloutPhase,
  DEFAULT_ROLLOUT_STAGES,
} from "../../../../../src/platform/control-plane/config-center/config-rollout-service.js";

test("DEFAULT_ROLLOUT_STAGES CANARY_5 has minDurationMs of 1800000 (30 minutes)", () => {
  const canary5Stage = DEFAULT_ROLLOUT_STAGES.find((s) => s.phase === RolloutPhase.CANARY_5);

  assert.ok(canary5Stage, "CANARY_5 stage should exist");
  assert.strictEqual(
    canary5Stage!.minDurationMs,
    1800000,
    "CANARY_5 minDurationMs should be 1800000 (30 minutes per §24 spec)",
  );
});

test("CANARY_5 stage has correct percentage of 5%", () => {
  const canary5Stage = DEFAULT_ROLLOUT_STAGES.find((s) => s.phase === RolloutPhase.CANARY_5);

  assert.ok(canary5Stage);
  assert.strictEqual(canary5Stage!.percentage, 5);
});

test("CANARY_5 stage autoProgress is true", () => {
  const canary5Stage = DEFAULT_ROLLOUT_STAGES.find((s) => s.phase === RolloutPhase.CANARY_5);

  assert.ok(canary5Stage);
  assert.strictEqual(canary5Stage!.autoProgress, true);
});

test("startRollout with 5% target starts at CANARY_5 stage", () => {
  const service = new ConfigRolloutService();
  const rollout = service.startRollout("runtime.timeout", "platform", null, 5);

  assert.strictEqual(rollout.stage.phase, RolloutPhase.CANARY_5);
  assert.strictEqual(rollout.currentPercentage, 5);
});

test("autoProgressRollouts does not progress CANARY_5 before 30 minutes", () => {
  const service = new ConfigRolloutService();
  const rollout = service.startRollout("runtime.timeout", "platform", null, 5);

  // Manually set the rollout to have started just 10 minutes ago
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  rollout.startedAt = tenMinutesAgo;
  rollout.updatedAt = tenMinutesAgo;

  // Progress should be 0 since not enough time has elapsed
  const progressed = service.autoProgressRollouts();

  assert.strictEqual(progressed, 0);
  assert.strictEqual(rollout.stage.phase, RolloutPhase.CANARY_5);
});

test("autoProgressRollouts progresses CANARY_5 after 30 minutes", () => {
  const service = new ConfigRolloutService();
  const rollout = service.startRollout("runtime.timeout", "platform", null, 5);

  // Manually set the rollout to have started 31 minutes ago
  const thirtyOneMinutesAgo = new Date(Date.now() - 31 * 60 * 1000).toISOString();
  rollout.startedAt = thirtyOneMinutesAgo;
  rollout.updatedAt = thirtyOneMinutesAgo;

  const progressed = service.autoProgressRollouts();

  assert.strictEqual(progressed, 1);
  assert.strictEqual(rollout.stage.phase, RolloutPhase.CANARY_25);
  assert.strictEqual(rollout.currentPercentage, 25);
});

test("autoProgressRollouts progresses through all stages correctly", () => {
  const service = new ConfigRolloutService();
  const rollout = service.startRollout("runtime.timeout", "platform", null, 5);

  // CANARY_5 -> CANARY_25 (after 30 min)
  const thirtyOneMinutesAgo = new Date(Date.now() - 31 * 60 * 1000).toISOString();
  rollout.startedAt = thirtyOneMinutesAgo;
  rollout.updatedAt = thirtyOneMinutesAgo;

  service.autoProgressRollouts();
  assert.strictEqual(rollout.stage.phase, RolloutPhase.CANARY_25);

  // CANARY_25 -> HALF (after 5 min, total 35 min)
  rollout.updatedAt = new Date(Date.now() - 35 * 60 * 1000).toISOString();
  service.autoProgressRollouts();
  assert.strictEqual(rollout.stage.phase, RolloutPhase.HALF);

  // HALF -> FULL (after 10 min, total 45 min)
  rollout.updatedAt = new Date(Date.now() - 45 * 60 * 1000).toISOString();
  service.autoProgressRollouts();
  assert.strictEqual(rollout.stage.phase, RolloutPhase.FULL);
});

test("All rollout stages have expected minDurationMs values", () => {
  const stageMap = new Map(DEFAULT_ROLLOUT_STAGES.map((s) => [s.phase, s]));

  // PENDING: 0 min
  assert.strictEqual(stageMap.get(RolloutPhase.PENDING)!.minDurationMs, 0);

  // CANARY_5: 30 min (1800000 ms) per §24
  assert.strictEqual(stageMap.get(RolloutPhase.CANARY_5)!.minDurationMs, 1800000);

  // CANARY_25: 5 min (300000 ms)
  assert.strictEqual(stageMap.get(RolloutPhase.CANARY_25)!.minDurationMs, 300000);

  // HALF: 10 min (600000 ms)
  assert.strictEqual(stageMap.get(RolloutPhase.HALF)!.minDurationMs, 600000);

  // FULL: 0 min
  assert.strictEqual(stageMap.get(RolloutPhase.FULL)!.minDurationMs, 0);
});

test("ConfigRolloutService can be instantiated with custom stages", () => {
  const customStages = [
    { phase: RolloutPhase.PENDING, percentage: 0, minDurationMs: 0, autoProgress: false },
    { phase: RolloutPhase.CANARY_5, percentage: 5, minDurationMs: 3600000, autoProgress: true }, // 1 hour
    { phase: RolloutPhase.FULL, percentage: 100, minDurationMs: 0, autoProgress: false },
  ];

  const service = new ConfigRolloutService({ stages: customStages });
  const rollout = service.startRollout("test.config", "platform", null, 5);

  assert.strictEqual(rollout.stage.phase, RolloutPhase.CANARY_5);
  // Custom stages have 1 hour (3600000ms), not default 30 min
  rollout.startedAt = new Date(Date.now() - 45 * 60 * 1000).toISOString(); // 45 min ago
  rollout.updatedAt = rollout.startedAt;
  service.autoProgressRollouts();
  // With 45 min elapsed and only 1 hour required, shouldn't progress yet
  assert.strictEqual(rollout.stage.phase, RolloutPhase.CANARY_5);
});