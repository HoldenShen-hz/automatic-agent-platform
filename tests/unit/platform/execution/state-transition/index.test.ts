import assert from "node:assert/strict";
import test from "node:test";

// State Transition module barrel - re-exports state transition services
import {
  StateTransitionMachine,
  TransitionService,
} from "../../../../../src/platform/five-plane-execution/state-transition/index.js";

test("StateTransitionMachine is exported as function [index]", () => {
  assert.equal(typeof StateTransitionMachine, "function");
});

test("TransitionService is exported as function [index]", () => {
  assert.equal(typeof TransitionService, "function");
});

test("StateTransitionMachine can be instantiated [index]", () => {
  const machine = new StateTransitionMachine("task", {
    queued: ["pending"],
    pending: [],
  });
  assert.ok(machine !== undefined);
});

test("TransitionService can be instantiated [index]", () => {
  const service = new TransitionService(
    { transaction: (work: () => void) => work() } as any,
    {} as any,
    {} as any,
  );
  assert.ok(service !== undefined);
});

test("StateTransitionMachine has required methods [index]", () => {
  const machine = new StateTransitionMachine("task", {
    queued: ["pending"],
    pending: [],
  });
  assert.equal(typeof machine.assertTransition, "function");
});

test("TransitionService has required methods [index]", () => {
  const service = new TransitionService(
    { transaction: (work: () => void) => work() } as any,
    {} as any,
    {} as any,
  );
  assert.equal(typeof service.transitionTaskStatus, "function");
  assert.equal(typeof service.transitionWorkflowStatus, "function");
  assert.equal(typeof service.transitionSessionStatus, "function");
  assert.equal(typeof service.transitionExecutionStatus, "function");
  assert.equal(typeof service.transitionApprovalStatus, "function");
});
