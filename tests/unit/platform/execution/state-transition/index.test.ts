import assert from "node:assert/strict";
import test from "node:test";

// State Transition module barrel - re-exports state transition services
import {
  StateTransitionMachine,
  TransitionService,
} from "../../../../../src/platform/execution/state-transition/index.js";

test("StateTransitionMachine is exported as function", () => {
  assert.equal(typeof StateTransitionMachine, "function");
});

test("TransitionService is exported as function", () => {
  assert.equal(typeof TransitionService, "function");
});

test("StateTransitionMachine can be instantiated", () => {
  const machine = new StateTransitionMachine();
  assert.ok(machine !== undefined);
});

test("TransitionService can be instantiated", () => {
  const service = new TransitionService();
  assert.ok(service !== undefined);
});

test("StateTransitionMachine has required methods", () => {
  const machine = new StateTransitionMachine();
  assert.equal(typeof machine.transition, "function");
  assert.equal(typeof machine.getState, "function");
  assert.equal(typeof machine.canTransition, "function");
});

test("TransitionService has required methods", () => {
  const service = new TransitionService();
  assert.equal(typeof service.transition, "function");
  assert.equal(typeof service.validate, "function");
  assert.equal(typeof service.getAvailableTransitions, "function");
});
