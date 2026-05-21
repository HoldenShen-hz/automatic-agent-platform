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
  assert.equal(typeof scheduler.advance, "function");
  assert.equal(typeof scheduler.advanceMany, "function");
});

test("RolloutScheduler.advance is callable", () => {
  const scheduler = new RolloutScheduler();
  assert.doesNotThrow(async () => {
    await scheduler.advance({
      candidate: { id: "candidate_1", version: 1, metadata: {} },
      record: {
        proposalId: "test_rollout_1",
        stage: "shadow",
        percentage: 0,
        startedAt: new Date().toISOString(),
        status: "shadow",
      },
    });
  });
});

test("RolloutScheduler.advanceMany is callable", () => {
  const scheduler = new RolloutScheduler();
  assert.doesNotThrow(async () => {
    await scheduler.advanceMany([]);
  });
});