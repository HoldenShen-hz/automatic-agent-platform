import assert from "node:assert/strict";
import test from "node:test";

import {
  ImprovementRollbackStateMachine,
  type ImprovementRollbackReceipt,
  type ImprovementReleaseState,
} from "../../../../../src/platform/orchestration/improve-rollout/rollback-pending-state.js";

test("ImprovementRollbackStateMachine.requestRollback creates receipt for released state", () => {
  const machine = new ImprovementRollbackStateMachine();
  const receipt = machine.requestRollback("improvement-1", "released");

  assert.equal(receipt.improvementId, "improvement-1");
  assert.equal(receipt.fromState, "released");
  assert.equal(receipt.toState, "rollback_pending");
  assert.equal(receipt.postmortemRequired, true);
  assert.equal(receipt.reasonCode, "improvement.rollback_pending");
});

test("ImprovementRollbackStateMachine.requestRollback throws when not in released state", () => {
  const machine = new ImprovementRollbackStateMachine();

  assert.throws(
    () => machine.requestRollback("improvement-1", "rollback_pending"),
    /improvement.rollback_requires_released/,
  );
});

test("ImprovementRollbackStateMachine.requestRollback throws when already rolled_back", () => {
  const machine = new ImprovementRollbackStateMachine();

  assert.throws(
    () => machine.requestRollback("improvement-1", "rolled_back"),
    /improvement.rollback_requires_released/,
  );
});

test("ImprovementRollbackStateMachine.completeRollback creates receipt for rollback_pending state", () => {
  const machine = new ImprovementRollbackStateMachine();
  const receipt = machine.completeRollback("improvement-1", "rollback_pending");

  assert.equal(receipt.improvementId, "improvement-1");
  assert.equal(receipt.fromState, "rollback_pending");
  assert.equal(receipt.toState, "rolled_back");
  assert.equal(receipt.postmortemRequired, true);
  assert.equal(receipt.reasonCode, "improvement.rolled_back");
});

test("ImprovementRollbackStateMachine.completeRollback throws when not in rollback_pending state", () => {
  const machine = new ImprovementRollbackStateMachine();

  assert.throws(
    () => machine.completeRollback("improvement-1", "released"),
    /improvement.rollback_complete_requires_pending/,
  );
});

test("ImprovementRollbackStateMachine.completeRollback throws when already rolled_back", () => {
  const machine = new ImprovementRollbackStateMachine();

  assert.throws(
    () => machine.completeRollback("improvement-1", "rolled_back"),
    /improvement.rollback_complete_requires_pending/,
  );
});

test("ImprovementRollbackReceipt has expected structure", () => {
  const machine = new ImprovementRollbackStateMachine();
  const receipt = machine.requestRollback("improvement-1", "released");

  assert.equal(receipt.improvementId, "improvement-1");
  assert.equal(receipt.fromState, "released");
  assert.equal(receipt.toState, "rollback_pending");
  assert.equal(receipt.postmortemRequired, true);
  assert.equal(typeof receipt.reasonCode, "string");
});

test("ImprovementReleaseState type accepts all expected values", () => {
  const states: ImprovementReleaseState[] = ["released", "rollback_pending", "rolled_back"];

  for (const state of states) {
    const machine = new ImprovementRollbackStateMachine();
    if (state === "released") {
      const receipt = machine.requestRollback("test-id", state);
      assert.equal(receipt.toState, "rollback_pending");
    } else if (state === "rollback_pending") {
      const receipt = machine.completeRollback("test-id", state);
      assert.equal(receipt.toState, "rolled_back");
    }
  }
});

test("ImprovementRollbackStateMachine handles multiple improvements independently", () => {
  const machine = new ImprovementRollbackStateMachine();

  const receipt1 = machine.requestRollback("improvement-1", "released");
  const receipt2 = machine.requestRollback("improvement-2", "released");

  assert.notEqual(receipt1.improvementId, receipt2.improvementId);
  assert.equal(receipt1.toState, "rollback_pending");
  assert.equal(receipt2.toState, "rollback_pending");
});

test("ImprovementRollbackStateMachine completeRollback after requestRollback", () => {
  const machine = new ImprovementRollbackStateMachine();

  const pendingReceipt = machine.requestRollback("improvement-1", "released");
  assert.equal(pendingReceipt.toState, "rollback_pending");

  const completedReceipt = machine.completeRollback("improvement-1", "rollback_pending");
  assert.equal(completedReceipt.toState, "rolled_back");
});

test("ImprovementRollbackReasonCode type values", () => {
  const machine = new ImprovementRollbackStateMachine();

  const pendingReceipt = machine.requestRollback("improvement-1", "released");
  assert.equal(pendingReceipt.reasonCode, "improvement.rollback_pending");

  const completedReceipt = machine.completeRollback("improvement-2", "rollback_pending");
  assert.equal(completedReceipt.reasonCode, "improvement.rolled_back");
});
