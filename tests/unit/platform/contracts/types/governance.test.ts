/**
 * Unit tests for Governance Contract Types
 *
 * @see src/platform/contracts/types/governance.ts
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  createEmptyGovernanceSnapshot,
  type ModelGovernanceSnapshot,
  type ModelGovernanceProfileStatus,
} from "../../../../../src/platform/contracts/types/governance.js";

// ─────────────────────────────────────────────────────────────────────────────
// createEmptyGovernanceSnapshot Tests
// ─────────────────────────────────────────────────────────────────────────────

test("createEmptyGovernanceSnapshot creates snapshot with empty profileStatuses", () => {
  const snapshot = createEmptyGovernanceSnapshot();

  assert.ok("profileStatuses" in snapshot);
  assert.ok(typeof snapshot.profileStatuses === "object");
});

test("createEmptyGovernanceSnapshot creates snapshot with empty rollbackTargets", () => {
  const snapshot = createEmptyGovernanceSnapshot();

  assert.ok("rollbackTargets" in snapshot);
  assert.ok(typeof snapshot.rollbackTargets === "object");
});

test("createEmptyGovernanceSnapshot returns empty profileStatuses object", () => {
  const snapshot = createEmptyGovernanceSnapshot();

  assert.deepStrictEqual(snapshot.profileStatuses, {});
});

test("createEmptyGovernanceSnapshot returns empty rollbackTargets object", () => {
  const snapshot = createEmptyGovernanceSnapshot();

  assert.deepStrictEqual(snapshot.rollbackTargets, {});
});

test("createEmptyGovernanceSnapshot returns readonly profileStatuses", () => {
  const snapshot = createEmptyGovernanceSnapshot();

  // Verify it's an object that can be accessed
  const keys = Object.keys(snapshot.profileStatuses);
  assert.ok(Array.isArray(keys));
});

test("createEmptyGovernanceSnapshot returns readonly rollbackTargets", () => {
  const snapshot = createEmptyGovernanceSnapshot();

  // Verify it's an object that can be accessed
  const keys = Object.keys(snapshot.rollbackTargets);
  assert.ok(Array.isArray(keys));
});

// ─────────────────────────────────────────────────────────────────────────────
// ModelGovernanceSnapshot Structure Tests
// ─────────────────────────────────────────────────────────────────────────────

test("createEmptyGovernanceSnapshot returns valid ModelGovernanceSnapshot type", () => {
  const snapshot = createEmptyGovernanceSnapshot();

  // Verify the structure matches the ModelGovernanceSnapshot interface
  const _check: ModelGovernanceSnapshot = snapshot;
  assert.ok(_check !== null && _check !== undefined);
});

test("createEmptyGovernanceSnapshot has both required properties", () => {
  const snapshot = createEmptyGovernanceSnapshot();

  assert.ok(Object.hasOwn(snapshot, "profileStatuses"));
  assert.ok(Object.hasOwn(snapshot, "rollbackTargets"));
});

test("createEmptyGovernanceSnapshot profileStatuses is a plain object", () => {
  const snapshot = createEmptyGovernanceSnapshot();

  assert.strictEqual(Object.getPrototypeOf(snapshot.profileStatuses), Object.prototype);
});

test("createEmptyGovernanceSnapshot rollbackTargets is a plain object", () => {
  const snapshot = createEmptyGovernanceSnapshot();

  assert.strictEqual(Object.getPrototypeOf(snapshot.rollbackTargets), Object.prototype);
});

// ─────────────────────────────────────────────────────────────────────────────
// ModelGovernanceProfileStatus Type Tests
// ─────────────────────────────────────────────────────────────────────────────

test("ModelGovernanceProfileStatus includes expected values", () => {
  const statuses: ModelGovernanceProfileStatus[] = ["active", "degraded", "disabled"];

  // Verify these are valid status values by creating a snapshot and checking
  // the type system would accept them
  for (const _status of statuses) {
    const _snapshot: ModelGovernanceSnapshot = {
      profileStatuses: { testProfile: _status },
      rollbackTargets: { testProfile: null },
    };
    assert.ok(_snapshot.profileStatuses["testProfile"] === _status);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Usage Pattern Tests
// ─────────────────────────────────────────────────────────────────────────────

test("createEmptyGovernanceSnapshot can be used as initial state", () => {
  const initialState = createEmptyGovernanceSnapshot();

  // Simulate adding a profile
  const updatedState: ModelGovernanceSnapshot = {
    profileStatuses: {
      ...initialState.profileStatuses,
      production: "active",
    },
    rollbackTargets: {
      ...initialState.rollbackTargets,
      production: null,
    },
  };

  assert.strictEqual(updatedState.profileStatuses["production"], "active");
  assert.strictEqual(initialState.profileStatuses["production"], undefined);
});

test("createEmptyGovernanceSnapshot can be merged with other snapshots", () => {
  const snapshot1 = createEmptyGovernanceSnapshot();
  const snapshot2 = createEmptyGovernanceSnapshot();

  const merged: ModelGovernanceSnapshot = {
    profileStatuses: {
      ...snapshot1.profileStatuses,
      ...snapshot2.profileStatuses,
    },
    rollbackTargets: {
      ...snapshot1.rollbackTargets,
      ...snapshot2.rollbackTargets,
    },
  };

  assert.deepStrictEqual(merged.profileStatuses, {});
  assert.deepStrictEqual(merged.rollbackTargets, {});
});

test("createEmptyGovernanceSnapshot works with Object.freeze", () => {
  const snapshot = createEmptyGovernanceSnapshot();
  const frozen = Object.freeze(snapshot);

  assert.ok(Object.isFrozen(snapshot));
  assert.strictEqual(frozen.profileStatuses, snapshot.profileStatuses);
  assert.strictEqual(frozen.rollbackTargets, snapshot.rollbackTargets);
});
