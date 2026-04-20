/**
 * Unit tests for RolloutFreezeManager
 */

import assert from "node:assert/strict";
import test from "node:test";
import { RolloutFreezeManager, rolloutFreezeManager } from "../../../../../src/platform/shared/observability/rollout-freeze-manager.js";

test("RolloutFreezeManager starts unfrozen", () => {
  const manager = new RolloutFreezeManager();
  assert.equal(manager.isFrozen(), false);
  assert.deepEqual(manager.getState(), { frozen: false, frozenAt: null, frozenBySloId: null });
});

test("RolloutFreezeManager singleton starts unfrozen", () => {
  assert.equal(rolloutFreezeManager.isFrozen(), false);
});

test("RolloutFreezeManager.freeze sets frozen state", () => {
  const manager = new RolloutFreezeManager();
  manager.freeze("slo_test_123");

  assert.equal(manager.isFrozen(), true);
  const state = manager.getState();
  assert.equal(state.frozen, true);
  assert.equal(state.frozenBySloId, "slo_test_123");
  assert.ok(state.frozenAt !== null);
});

test("RolloutFreezeManager.unfreeze clears frozen state", () => {
  const manager = new RolloutFreezeManager();
  manager.freeze("slo_test_456");
  assert.equal(manager.isFrozen(), true);

  manager.unfreeze();
  assert.equal(manager.isFrozen(), false);
  assert.deepEqual(manager.getState(), { frozen: false, frozenAt: null, frozenBySloId: null });
});

test("RolloutFreezeManager singleton can freeze and unfreeze", () => {
  rolloutFreezeManager.freeze("slo_singleton_test");
  assert.equal(rolloutFreezeManager.isFrozen(), true);

  rolloutFreezeManager.unfreeze();
  assert.equal(rolloutFreezeManager.isFrozen(), false);
});
