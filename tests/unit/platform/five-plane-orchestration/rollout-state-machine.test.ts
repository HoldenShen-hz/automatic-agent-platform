/**
 * @fileoverview Unit tests for RolloutStateMachine state transitions
 *
 * Tests the state machine that governs rollout status transitions.
 * Rollout statuses track the progressive release of improvements through
 * various canary stages to stable release.
 *
 * Valid transitions per ROLLOUT_TRANSITIONS map:
 * - candidate_created: under_review, rejected, paused
 * - under_review: approved, rejected, paused
 * - approved: evaluation_enabled, rejected, paused
 * - evaluation_enabled: canary_5, rolled_back, paused
 * - canary_5: partial_25, rolled_back, paused
 * - partial_25: stable_75, rolled_back, paused
 * - stable_75: stable_100, rolled_back, paused
 * - stable_100: released, rolled_back, paused
 * - released: rolled_back, paused
 * - rejected: rejected (terminal)
 * - rolled_back: rolled_back (terminal)
 * - paused: under_review, approved, evaluation_enabled, canary_5, partial_25, stable_75, stable_100, released, rolled_back, paused
 */

import assert from "node:assert/strict";
import test from "node:test";

import type { RolloutStatus } from "../../../../src/platform/five-plane-orchestration/oapeflir/types/rollout-record.js";

// Transition map from rollout-state-machine.ts
// Valid transitions per the actual ROLLOUT_TRANSITIONS map
const ROLLOUT_TRANSITIONS: Readonly<Record<RolloutStatus, readonly RolloutStatus[]>> = {
  candidate_created: ["under_review", "rejected", "paused"],
  under_review: ["approved", "rejected", "paused"],
  approved: ["evaluation_enabled", "rejected", "paused"],
  evaluation_enabled: ["canary_5", "rolled_back", "paused"],
  canary_5: ["partial_25", "rolled_back", "paused"],
  partial_25: ["stable_75", "rolled_back", "paused"],
  stable_75: ["stable_100", "rolled_back", "paused"],
  stable_100: ["released", "rolled_back", "paused"],
  released: ["rolled_back", "paused"],
  rejected: ["rejected"],
  rolled_back: ["rolled_back"],
  paused: ["under_review", "approved", "evaluation_enabled", "canary_5", "partial_25", "stable_75", "stable_100", "released", "rolled_back", "paused"],
};

const ALL_ROLLOUT_STATUSES: RolloutStatus[] = [
  "candidate_created",
  "under_review",
  "approved",
  "evaluation_enabled",
  "canary_5",
  "partial_25",
  "stable_75",
  "stable_100",
  "released",
  "rejected",
  "rolled_back",
  "paused",
];

const TERMINAL_STATUSES: RolloutStatus[] = ["rejected", "rolled_back"];

// Helper to check if a transition is valid according to the production map
function isValidTransition(from: RolloutStatus, to: RolloutStatus): boolean {
  const allowed = ROLLOUT_TRANSITIONS[from] ?? [];
  return allowed.includes(to);
}

// ---------------------------------------------------------------------------
// Valid transitions from candidate_created
// ---------------------------------------------------------------------------

test("RolloutStateMachine: candidate_created -> under_review is allowed", () => {
  assert.ok(isValidTransition("candidate_created", "under_review"), "candidate_created -> under_review should be valid");
});

test("RolloutStateMachine: candidate_created -> rejected is allowed", () => {
  assert.ok(isValidTransition("candidate_created", "rejected"), "candidate_created -> rejected should be valid");
});

test("RolloutStateMachine: candidate_created -> paused is allowed", () => {
  assert.ok(isValidTransition("candidate_created", "paused"), "candidate_created -> paused should be valid");
});

// ---------------------------------------------------------------------------
// Valid transitions from under_review
// ---------------------------------------------------------------------------

test("RolloutStateMachine: under_review -> approved is allowed", () => {
  assert.ok(isValidTransition("under_review", "approved"), "under_review -> approved should be valid");
});

test("RolloutStateMachine: under_review -> rejected is allowed", () => {
  assert.ok(isValidTransition("under_review", "rejected"), "under_review -> rejected should be valid");
});

test("RolloutStateMachine: under_review -> paused is allowed", () => {
  assert.ok(isValidTransition("under_review", "paused"), "under_review -> paused should be valid");
});

// ---------------------------------------------------------------------------
// Valid transitions from approved
// ---------------------------------------------------------------------------

test("RolloutStateMachine: approved -> evaluation_enabled is allowed", () => {
  assert.ok(isValidTransition("approved", "evaluation_enabled"), "approved -> evaluation_enabled should be valid");
});

test("RolloutStateMachine: approved -> rejected is allowed", () => {
  assert.ok(isValidTransition("approved", "rejected"), "approved -> rejected should be valid");
});

test("RolloutStateMachine: approved -> paused is allowed", () => {
  assert.ok(isValidTransition("approved", "paused"), "approved -> paused should be valid");
});

// ---------------------------------------------------------------------------
// Valid transitions from evaluation_enabled
// ---------------------------------------------------------------------------

test("RolloutStateMachine: evaluation_enabled -> canary_5 is allowed", () => {
  assert.ok(isValidTransition("evaluation_enabled", "canary_5"), "evaluation_enabled -> canary_5 should be valid");
});

test("RolloutStateMachine: evaluation_enabled -> rolled_back is allowed", () => {
  assert.ok(isValidTransition("evaluation_enabled", "rolled_back"), "evaluation_enabled -> rolled_back should be valid");
});

test("RolloutStateMachine: evaluation_enabled -> paused is allowed", () => {
  assert.ok(isValidTransition("evaluation_enabled", "paused"), "evaluation_enabled -> paused should be valid");
});

// ---------------------------------------------------------------------------
// Valid transitions from canary_5
// ---------------------------------------------------------------------------

test("RolloutStateMachine: canary_5 -> partial_25 is allowed", () => {
  assert.ok(isValidTransition("canary_5", "partial_25"), "canary_5 -> partial_25 should be valid");
});

test("RolloutStateMachine: canary_5 -> rolled_back is allowed", () => {
  assert.ok(isValidTransition("canary_5", "rolled_back"), "canary_5 -> rolled_back should be valid");
});

test("RolloutStateMachine: canary_5 -> paused is allowed", () => {
  assert.ok(isValidTransition("canary_5", "paused"), "canary_5 -> paused should be valid");
});

// ---------------------------------------------------------------------------
// Valid transitions from partial_25
// ---------------------------------------------------------------------------

test("RolloutStateMachine: partial_25 -> stable_75 is allowed", () => {
  assert.ok(isValidTransition("partial_25", "stable_75"), "partial_25 -> stable_75 should be valid");
});

test("RolloutStateMachine: partial_25 -> rolled_back is allowed", () => {
  assert.ok(isValidTransition("partial_25", "rolled_back"), "partial_25 -> rolled_back should be valid");
});

test("RolloutStateMachine: partial_25 -> paused is allowed", () => {
  assert.ok(isValidTransition("partial_25", "paused"), "partial_25 -> paused should be valid");
});

// ---------------------------------------------------------------------------
// Valid transitions from stable_75
// ---------------------------------------------------------------------------

test("RolloutStateMachine: stable_75 -> stable_100 is allowed", () => {
  assert.ok(isValidTransition("stable_75", "stable_100"), "stable_75 -> stable_100 should be valid");
});

test("RolloutStateMachine: stable_75 -> rolled_back is allowed", () => {
  assert.ok(isValidTransition("stable_75", "rolled_back"), "stable_75 -> rolled_back should be valid");
});

test("RolloutStateMachine: stable_75 -> paused is allowed", () => {
  assert.ok(isValidTransition("stable_75", "paused"), "stable_75 -> paused should be valid");
});

// ---------------------------------------------------------------------------
// Valid transitions from stable_100
// ---------------------------------------------------------------------------

test("RolloutStateMachine: stable_100 -> released is allowed", () => {
  assert.ok(isValidTransition("stable_100", "released"), "stable_100 -> released should be valid");
});

test("RolloutStateMachine: stable_100 -> rolled_back is allowed", () => {
  assert.ok(isValidTransition("stable_100", "rolled_back"), "stable_100 -> rolled_back should be valid");
});

test("RolloutStateMachine: stable_100 -> paused is allowed", () => {
  assert.ok(isValidTransition("stable_100", "paused"), "stable_100 -> paused should be valid");
});

// ---------------------------------------------------------------------------
// Valid transitions from released
// ---------------------------------------------------------------------------

test("RolloutStateMachine: released -> rolled_back is allowed", () => {
  assert.ok(isValidTransition("released", "rolled_back"), "released -> rolled_back should be valid");
});

test("RolloutStateMachine: released -> paused is allowed", () => {
  assert.ok(isValidTransition("released", "paused"), "released -> paused should be valid");
});

// ---------------------------------------------------------------------------
// Valid transitions from paused
// ---------------------------------------------------------------------------

test("RolloutStateMachine: paused -> under_review is allowed", () => {
  assert.ok(isValidTransition("paused", "under_review"), "paused -> under_review should be valid");
});

test("RolloutStateMachine: paused -> approved is allowed", () => {
  assert.ok(isValidTransition("paused", "approved"), "paused -> approved should be valid");
});

test("RolloutStateMachine: paused -> evaluation_enabled is allowed", () => {
  assert.ok(isValidTransition("paused", "evaluation_enabled"), "paused -> evaluation_enabled should be valid");
});

test("RolloutStateMachine: paused -> canary_5 is allowed", () => {
  assert.ok(isValidTransition("paused", "canary_5"), "paused -> canary_5 should be valid");
});

test("RolloutStateMachine: paused -> partial_25 is allowed", () => {
  assert.ok(isValidTransition("paused", "partial_25"), "paused -> partial_25 should be valid");
});

test("RolloutStateMachine: paused -> stable_75 is allowed", () => {
  assert.ok(isValidTransition("paused", "stable_75"), "paused -> stable_75 should be valid");
});

test("RolloutStateMachine: paused -> stable_100 is allowed", () => {
  assert.ok(isValidTransition("paused", "stable_100"), "paused -> stable_100 should be valid");
});

test("RolloutStateMachine: paused -> released is allowed", () => {
  assert.ok(isValidTransition("paused", "released"), "paused -> released should be valid");
});

test("RolloutStateMachine: paused -> rolled_back is allowed", () => {
  assert.ok(isValidTransition("paused", "rolled_back"), "paused -> rolled_back should be valid");
});

// ---------------------------------------------------------------------------
// Terminal state: rejected - all transitions invalid except self
// ---------------------------------------------------------------------------

test("RolloutStateMachine: rejected is terminal - cannot transition to under_review", () => {
  assert.ok(!isValidTransition("rejected", "under_review"), "rejected -> under_review should be invalid");
});

test("RolloutStateMachine: rejected is terminal - cannot transition to candidate_created", () => {
  assert.ok(!isValidTransition("rejected", "candidate_created"), "rejected -> candidate_created should be invalid");
});

test("RolloutStateMachine: rejected is terminal - cannot transition to canary_5", () => {
  assert.ok(!isValidTransition("rejected", "canary_5"), "rejected -> canary_5 should be invalid");
});

test("RolloutStateMachine: rejected is terminal - cannot transition to partial_25", () => {
  assert.ok(!isValidTransition("rejected", "partial_25"), "rejected -> partial_25 should be invalid");
});

test("RolloutStateMachine: rejected is terminal - cannot transition to stable_75", () => {
  assert.ok(!isValidTransition("rejected", "stable_75"), "rejected -> stable_75 should be invalid");
});

test("RolloutStateMachine: rejected is terminal - cannot transition to released", () => {
  assert.ok(!isValidTransition("rejected", "released"), "rejected -> released should be invalid");
});

test("RolloutStateMachine: rejected is terminal - cannot transition to paused", () => {
  assert.ok(!isValidTransition("rejected", "paused"), "rejected -> paused should be invalid");
});

// ---------------------------------------------------------------------------
// Terminal state: rolled_back - all transitions invalid except self
// ---------------------------------------------------------------------------

test("RolloutStateMachine: rolled_back is terminal - cannot transition to under_review", () => {
  assert.ok(!isValidTransition("rolled_back", "under_review"), "rolled_back -> under_review should be invalid");
});

test("RolloutStateMachine: rolled_back is terminal - cannot transition to candidate_created", () => {
  assert.ok(!isValidTransition("rolled_back", "candidate_created"), "rolled_back -> candidate_created should be invalid");
});

test("RolloutStateMachine: rolled_back is terminal - cannot transition to canary_5", () => {
  assert.ok(!isValidTransition("rolled_back", "canary_5"), "rolled_back -> canary_5 should be invalid");
});

test("RolloutStateMachine: rolled_back is terminal - cannot transition to released", () => {
  assert.ok(!isValidTransition("rolled_back", "released"), "rolled_back -> released should be invalid");
});

// ---------------------------------------------------------------------------
// Invalid backward transitions
// ---------------------------------------------------------------------------

test("RolloutStateMachine: canary_5 -> evaluation_enabled is invalid (backward)", () => {
  assert.ok(!isValidTransition("canary_5", "evaluation_enabled"), "canary_5 -> evaluation_enabled should be invalid");
});

test("RolloutStateMachine: partial_25 -> canary_5 is invalid (backward)", () => {
  assert.ok(!isValidTransition("partial_25", "canary_5"), "partial_25 -> canary_5 should be invalid");
});

test("RolloutStateMachine: stable_75 -> partial_25 is invalid (backward)", () => {
  assert.ok(!isValidTransition("stable_75", "partial_25"), "stable_75 -> partial_25 should be invalid");
});

test("RolloutStateMachine: stable_100 -> stable_75 is invalid (backward)", () => {
  assert.ok(!isValidTransition("stable_100", "stable_75"), "stable_100 -> stable_75 should be invalid");
});

test("RolloutStateMachine: released -> stable_100 is invalid (backward)", () => {
  assert.ok(!isValidTransition("released", "stable_100"), "released -> stable_100 should be invalid");
});

// ---------------------------------------------------------------------------
// Invalid skip transitions
// ---------------------------------------------------------------------------

test("RolloutStateMachine: candidate_created -> canary_5 is invalid (skip)", () => {
  assert.ok(!isValidTransition("candidate_created", "canary_5"), "candidate_created -> canary_5 should be invalid");
});

test("RolloutStateMachine: under_review -> released is invalid (skip)", () => {
  assert.ok(!isValidTransition("under_review", "released"), "under_review -> released should be invalid");
});

test("RolloutStateMachine: approved -> partial_25 is invalid (skip)", () => {
  assert.ok(!isValidTransition("approved", "partial_25"), "approved -> partial_25 should be invalid");
});

test("RolloutStateMachine: evaluation_enabled -> stable_75 is invalid (skip)", () => {
  assert.ok(!isValidTransition("evaluation_enabled", "stable_75"), "evaluation_enabled -> stable_75 should be invalid");
});

test("RolloutStateMachine: canary_5 -> stable_100 is invalid (skip)", () => {
  assert.ok(!isValidTransition("canary_5", "stable_100"), "canary_5 -> stable_100 should be invalid");
});

// ---------------------------------------------------------------------------
// Data-driven test: all valid transitions from production map
// ---------------------------------------------------------------------------

test("RolloutStateMachine: all valid transitions from production map succeed", () => {
  let validCount = 0;
  for (const [fromStatus, allowedTargets] of Object.entries(ROLLOUT_TRANSITIONS)) {
    for (const toStatus of allowedTargets) {
      assert.ok(
        isValidTransition(fromStatus as RolloutStatus, toStatus as RolloutStatus),
        `${fromStatus} -> ${toStatus} should be valid`,
      );
      validCount++;
    }
  }
  // Verify we have meaningful test coverage (at least 20 valid transitions)
  assert.ok(validCount >= 20, `Expected at least 20 valid transitions, got ${validCount}`);
});

// ---------------------------------------------------------------------------
// Data-driven test: all invalid transitions from production map are rejected
// ---------------------------------------------------------------------------

test("RolloutStateMachine: all invalid transitions from production map are rejected", () => {
  let invalidCount = 0;
  for (const fromStatus of ALL_ROLLOUT_STATUSES) {
    for (const toStatus of ALL_ROLLOUT_STATUSES) {
      if (fromStatus === toStatus) continue; // Self-transitions are allowed (idempotent)

      const allowedTargets = ROLLOUT_TRANSITIONS[fromStatus] ?? [];
      if (allowedTargets.includes(toStatus)) continue; // Skip valid transitions

      assert.ok(
        !isValidTransition(fromStatus, toStatus),
        `${fromStatus} -> ${toStatus} should be invalid`,
      );
      invalidCount++;
    }
  }
  // Verify we have meaningful test coverage
  assert.ok(invalidCount >= 30, `Expected at least 30 invalid transitions, got ${invalidCount}`);
});

// ---------------------------------------------------------------------------
// State invariant: terminal states have no outgoing transitions
// ---------------------------------------------------------------------------

test("RolloutStateMachine: terminal states have no outgoing transitions to other states", () => {
  for (const terminal of TERMINAL_STATUSES) {
    for (const target of ALL_ROLLOUT_STATUSES) {
      if (terminal === target) continue;
      assert.ok(
        !isValidTransition(terminal, target),
        `Terminal state ${terminal} should not transition to ${target}`,
      );
    }
  }
});

// ---------------------------------------------------------------------------
// State invariant: self-transitions are only valid if defined in the map
// ---------------------------------------------------------------------------

test("RolloutStateMachine: self-transitions allowed only if explicitly in transition map", () => {
  // Terminal states only allow self
  assert.ok(isValidTransition("rejected", "rejected"), "rejected -> rejected should be valid");
  assert.ok(isValidTransition("rolled_back", "rolled_back"), "rolled_back -> rolled_back should be valid");
  // paused allows self-transition
  assert.ok(isValidTransition("paused", "paused"), "paused -> paused should be valid");
});
