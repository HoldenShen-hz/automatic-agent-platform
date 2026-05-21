import assert from "node:assert/strict";
import test from "node:test";

// RolloutScheduler tests
import { RolloutScheduler } from "../../../../../../../src/platform/five-plane-orchestration/oapeflir/improve-rollout/rollout/rollout-scheduler.js";

test("RolloutScheduler can be instantiated", () => {
  const scheduler = new RolloutScheduler();
  assert.ok(scheduler !== undefined);
});

test("RolloutScheduler has required scheduling methods", () => {
  const scheduler = new RolloutScheduler();
  assert.equal(typeof scheduler.schedule, "function");
  assert.equal(typeof scheduler.cancel, "function");
  assert.equal(typeof scheduler.getScheduledRollouts, "function");
});

test("RolloutScheduler.schedule is callable", () => {
  const scheduler = new RolloutScheduler();
  assert.doesNotThrow(() => {
    scheduler.schedule({
      rolloutId: "test_rollout_1",
      candidateId: "candidate_1",
      priority: 1,
    });
  });
});

test("RolloutScheduler.cancel is callable", () => {
  const scheduler = new RolloutScheduler();
  assert.doesNotThrow(() => {
    scheduler.cancel("test_rollout_1");
  });
});

test("RolloutScheduler.getScheduledRollouts returns array", () => {
  const scheduler = new RolloutScheduler();
  const rollouts = scheduler.getScheduledRollouts();
  assert.ok(Array.isArray(rollouts));
});

test("RolloutScheduler.schedule adds to scheduled list", () => {
  const scheduler = new RolloutScheduler();
  scheduler.schedule({
    rolloutId: "test_rollout_2",
    candidateId: "candidate_2",
    priority: 2,
  });
  const rollouts = scheduler.getScheduledRollouts();
  assert.ok(rollouts.length > 0);
});

test("RolloutScheduler.cancel removes from scheduled list", () => {
  const scheduler = new RolloutScheduler();
  scheduler.schedule({
    rolloutId: "test_rollout_3",
    candidateId: "candidate_3",
    priority: 3,
  });
  scheduler.cancel("test_rollout_3");
  const rollouts = scheduler.getScheduledRollouts();
  const found = rollouts.some((r) => r.rolloutId === "test_rollout_3");
  assert.equal(found, false);
});

test("RolloutScheduler handles multiple schedules", () => {
  const scheduler = new RolloutScheduler();
  scheduler.schedule({
    rolloutId: "test_rollout_4",
    candidateId: "candidate_4",
    priority: 4,
  });
  scheduler.schedule({
    rolloutId: "test_rollout_5",
    candidateId: "candidate_5",
    priority: 5,
  });
  const rollouts = scheduler.getScheduledRollouts();
  assert.ok(rollouts.length >= 2);
});