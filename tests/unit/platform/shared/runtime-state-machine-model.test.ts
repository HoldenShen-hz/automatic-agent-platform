import test from "node:test";
import assert from "node:assert/strict";

import {
  HARNESS_RUN_TRANSITIONS,
  NODE_RUN_TRANSITIONS,
  SIDE_EFFECT_TRANSITIONS,
  BUDGET_LEDGER_TRANSITIONS,
  BUDGET_RESERVATION_TRANSITIONS,
  type TransitionTable,
} from "../../../../../src/platform/shared/runtime-state-machine-model.js";

test("HARNESS_RUN_TRANSITIONS has valid structure", () => {
  const transitions = HARNESS_RUN_TRANSITIONS;

  // Check that all statuses have arrays of next statuses
  assert.ok(Array.isArray(transitions.created));
  assert.ok(Array.isArray(transitions.admitted));
  assert.ok(Array.isArray(transitions.planning));
  assert.ok(Array.isArray(transitions.ready));
  assert.ok(Array.isArray(transitions.running));
  assert.ok(Array.isArray(transitions.pausing));
  assert.ok(Array.isArray(transitions.paused));
  assert.ok(Array.isArray(transitions.resuming));
  assert.ok(Array.isArray(transitions.replanning));
  assert.ok(Array.isArray(transitions.compensating));
  assert.ok(Array.isArray(transitions.completed));
  assert.ok(Array.isArray(transitions.failed));
  assert.ok(Array.isArray(transitions.cancelled));
  assert.ok(Array.isArray(transitions.aborted));
});

test("HARNESS_RUN_TRANSITIONS terminal states have empty arrays", () => {
  assert.deepStrictEqual(HARNESS_RUN_TRANSITIONS.completed, []);
  assert.deepStrictEqual(HARNESS_RUN_TRANSITIONS.failed, []);
  assert.deepStrictEqual(HARNESS_RUN_TRANSITIONS.cancelled, []);
  assert.deepStrictEqual(HARNESS_RUN_TRANSITIONS.aborted, []);
});

test("HARNESS_RUN_TRANSITIONS valid transitions are defined", () => {
  // created can transition to admitted, failed, cancelled, aborted
  assert.ok(HARNESS_RUN_TRANSITIONS.created.includes("admitted"));
  assert.ok(HARNESS_RUN_TRANSITIONS.created.includes("failed"));
  assert.ok(HARNESS_RUN_TRANSITIONS.created.includes("cancelled"));
  assert.ok(HARNESS_RUN_TRANSITIONS.created.includes("aborted"));

  // running has many possible transitions
  assert.ok(HARNESS_RUN_TRANSITIONS.running.includes("pausing"));
  assert.ok(HARNESS_RUN_TRANSITIONS.running.includes("paused"));
  assert.ok(HARNESS_RUN_TRANSITIONS.running.includes("replanning"));
  assert.ok(HARNESS_RUN_TRANSITIONS.running.includes("compensating"));
  assert.ok(HARNESS_RUN_TRANSITIONS.running.includes("completed"));
  assert.ok(HARNESS_RUN_TRANSITIONS.running.includes("failed"));
  assert.ok(HARNESS_RUN_TRANSITIONS.running.includes("cancelled"));
  assert.ok(HARNESS_RUN_TRANSITIONS.running.includes("aborted"));
});

test("NODE_RUN_TRANSITIONS has valid structure", () => {
  const transitions = NODE_RUN_TRANSITIONS;

  assert.ok(Array.isArray(transitions.created));
  assert.ok(Array.isArray(transitions.ready));
  assert.ok(Array.isArray(transitions.leased));
  assert.ok(Array.isArray(transitions.running));
  assert.ok(Array.isArray(transitions.retry_wait));
  assert.ok(Array.isArray(transitions.awaiting_hitl));
  assert.ok(Array.isArray(transitions.reconciling));
  assert.ok(Array.isArray(transitions.succeeded));
  assert.ok(Array.isArray(transitions.failed));
  assert.ok(Array.isArray(transitions.skipped));
  assert.ok(Array.isArray(transitions.cancelled));
  assert.ok(Array.isArray(transitions.dependency_failed));
  assert.ok(Array.isArray(transitions.policy_blocked));
  assert.ok(Array.isArray(transitions.aborted));
});

test("NODE_RUN_TRANSITIONS terminal states have empty arrays", () => {
  assert.deepStrictEqual(NODE_RUN_TRANSITIONS.succeeded, []);
  assert.deepStrictEqual(NODE_RUN_TRANSITIONS.failed, []);
  assert.deepStrictEqual(NODE_RUN_TRANSITIONS.skipped, []);
  assert.deepStrictEqual(NODE_RUN_TRANSITIONS.cancelled, []);
  assert.deepStrictEqual(NODE_RUN_TRANSITIONS.dependency_failed, []);
  assert.deepStrictEqual(NODE_RUN_TRANSITIONS.policy_blocked, []);
  assert.deepStrictEqual(NODE_RUN_TRANSITIONS.aborted, []);
});

test("NODE_RUN_TRANSITIONS valid transitions are defined", () => {
  // created can go to ready, policy_blocked, dependency_failed, aborted
  assert.ok(NODE_RUN_TRANSITIONS.created.includes("ready"));
  assert.ok(NODE_RUN_TRANSITIONS.created.includes("policy_blocked"));
  assert.ok(NODE_RUN_TRANSITIONS.created.includes("dependency_failed"));
  assert.ok(NODE_RUN_TRANSITIONS.created.includes("aborted"));

  // running can transition to retry_wait, awaiting_hitl, reconciling, succeeded, failed, cancelled, aborted
  assert.ok(NODE_RUN_TRANSITIONS.running.includes("retry_wait"));
  assert.ok(NODE_RUN_TRANSITIONS.running.includes("awaiting_hitl"));
  assert.ok(NODE_RUN_TRANSITIONS.running.includes("reconciling"));
  assert.ok(NODE_RUN_TRANSITIONS.running.includes("succeeded"));
  assert.ok(NODE_RUN_TRANSITIONS.running.includes("failed"));
});

test("SIDE_EFFECT_TRANSITIONS has valid structure", () => {
  const transitions = SIDE_EFFECT_TRANSITIONS;

  assert.ok(Array.isArray(transitions.proposed));
  assert.ok(Array.isArray(transitions.approved));
  assert.ok(Array.isArray(transitions.reserved));
  assert.ok(Array.isArray(transitions.committing));
  assert.ok(Array.isArray(transitions.committed));
  assert.ok(Array.isArray(transitions.confirming));
  assert.ok(Array.isArray(transitions.confirmed));
  assert.ok(Array.isArray(transitions.ambiguous));
  assert.ok(Array.isArray(transitions.manual_review_required));
  assert.ok(Array.isArray(transitions.reconciling));
  assert.ok(Array.isArray(transitions.compensation_required));
  assert.ok(Array.isArray(transitions.compensating));
  assert.ok(Array.isArray(transitions.compensated));
  assert.ok(Array.isArray(transitions.failed));
  assert.ok(Array.isArray(transitions.revoked));
  assert.ok(Array.isArray(transitions.expired));
});

test("SIDE_EFFECT_TRANSITIONS terminal states have empty arrays", () => {
  assert.deepStrictEqual(SIDE_EFFECT_TRANSITIONS.compensated, []);
  assert.deepStrictEqual(SIDE_EFFECT_TRANSITIONS.failed, []);
  assert.deepStrictEqual(SIDE_EFFECT_TRANSITIONS.revoked, []);
  assert.deepStrictEqual(SIDE_EFFECT_TRANSITIONS.expired, []);
});

test("SIDE_EFFECT_TRANSITIONS complex state flow is defined", () => {
  // confirming can go to confirmed, ambiguous, manual_review_required, failed
  assert.ok(SIDE_EFFECT_TRANSITIONS.confirming.includes("confirmed"));
  assert.ok(SIDE_EFFECT_TRANSITIONS.confirming.includes("ambiguous"));
  assert.ok(SIDE_EFFECT_TRANSITIONS.confirming.includes("manual_review_required"));
  assert.ok(SIDE_EFFECT_TRANSITIONS.confirming.includes("failed"));
});

test("BUDGET_LEDGER_TRANSITIONS has valid structure", () => {
  const transitions = BUDGET_LEDGER_TRANSITIONS;

  assert.ok(Array.isArray(transitions.open));
  assert.ok(Array.isArray(transitions.soft_cap_reached));
  assert.ok(Array.isArray(transitions.hard_cap_reached));
  assert.ok(Array.isArray(transitions.settling));
  assert.ok(Array.isArray(transitions.reserving));
  assert.ok(Array.isArray(transitions.releasing));
  assert.ok(Array.isArray(transitions.closed));
});

test("BUDGET_LEDGER_TRANSITIONS closed is terminal", () => {
  assert.deepStrictEqual(BUDGET_LEDGER_TRANSITIONS.closed, []);
});

test("BUDGET_RESERVATION_TRANSITIONS has valid structure", () => {
  const transitions = BUDGET_RESERVATION_TRANSITIONS;

  assert.ok(Array.isArray(transitions.reserved));
  assert.ok(Array.isArray(transitions.settled));
  assert.ok(Array.isArray(transitions.released));
  assert.ok(Array.isArray(transitions.expired));
  assert.ok(Array.isArray(transitions.rejected));
});

test("BUDGET_RESERVATION_TRANSITIONS terminal states have empty arrays", () => {
  assert.deepStrictEqual(BUDGET_RESERVATION_TRANSITIONS.settled, []);
  assert.deepStrictEqual(BUDGET_RESERVATION_TRANSITIONS.released, []);
  assert.deepStrictEqual(BUDGET_RESERVATION_TRANSITIONS.expired, []);
  assert.deepStrictEqual(BUDGET_RESERVATION_TRANSITIONS.rejected, []);
});

test("TransitionTable type guard works correctly", () => {
  // This test ensures the type is correctly structured
  const table = HARNESS_RUN_TRANSITIONS;

  for (const [_status, nextStatuses] of Object.entries(table)) {
    assert.ok(
      Array.isArray(nextStatuses),
      `Transition for ${String(_status)} should be an array`,
    );
    for (const nextStatus of nextStatuses) {
      assert.strictEqual(
        typeof nextStatus,
        "string",
        `Next status should be string, got ${typeof nextStatus}`,
      );
    }
  }
});

test("All transition tables are finite", () => {
  const allTables: TransitionTable<string>[] = [
    HARNESS_RUN_TRANSITIONS,
    NODE_RUN_TRANSITIONS,
    SIDE_EFFECT_TRANSITIONS,
    BUDGET_LEDGER_TRANSITIONS,
    BUDGET_RESERVATION_TRANSITIONS,
  ];

  for (const table of allTables) {
    const entries = Object.entries(table);
    assert.ok(entries.length > 0, "Transition table should not be empty");
    for (const [, nextStatuses] of entries) {
      assert.ok(
        nextStatuses.length < 20,
        "Transition table entries should be finite",
      );
    }
  }
});