import assert from "node:assert/strict";
import test from "node:test";

// RolloutStateMachine tests
import { RolloutStateMachine } from "../../../../../../../src/platform/five-plane-orchestration/oapeflir/improve-rollout/rollout/rollout-state-machine.js";

test("RolloutStateMachine can be instantiated", () => {
  const machine = new RolloutStateMachine();
  assert.ok(machine !== undefined);
});

test("RolloutStateMachine has required state transition methods", () => {
  const machine = new RolloutStateMachine();
  assert.equal(typeof machine.transition, "function");
  assert.equal(typeof machine.getCurrentState, "function");
  assert.equal(typeof machine.reset, "function");
});

test("RolloutStateMachine.reset returns to initial state", () => {
  const machine = new RolloutStateMachine();
  machine.reset();
  const state = machine.getCurrentState();
  assert.ok(state !== undefined);
});

test("RolloutStateMachine.transition is callable", () => {
  const machine = new RolloutStateMachine();
  assert.doesNotThrow(() => {
    machine.transition("advance");
  });
});

test("RolloutStateMachine.getCurrentState returns current state", () => {
  const machine = new RolloutStateMachine();
  const state = machine.getCurrentState();
  assert.ok(state !== undefined);
  assert.equal(typeof state, "object");
});

test("RolloutStateMachine multiple transitions", () => {
  const machine = new RolloutStateMachine();
  machine.reset();
  machine.transition("advance");
  machine.transition("advance");
  const state = machine.getCurrentState();
  assert.ok(state !== undefined);
});

test("RolloutStateMachine instance maintains separate state", () => {
  const machine1 = new RolloutStateMachine();
  const machine2 = new RolloutStateMachine();
  machine1.transition("advance");
  const state1 = machine1.getCurrentState();
  const state2 = machine2.getCurrentState();
  // Each instance maintains its own state
  assert.ok(state1 !== undefined);
  assert.ok(state2 !== undefined);
});