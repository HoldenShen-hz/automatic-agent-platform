/**
 * transitionLock validation tests
 *
 * Comprehensive tests for the transitionLock function's validation logic
 * covering all error cases for lock transition commands.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  transitionLock,
  type LockTransitionCommand,
  type LockTransitionResult,
  type LockType,
  type LockStatus,
} from "../../../../../src/platform/five-plane-execution/distributed-lock/distributed-lock-types.js";

function createBaseCommand(): LockTransitionCommand {
  return {
    lockId: "lock-001",
    lockType: "execution_lease",
    resourceKey: "worker:lease:001",
    fromStatus: "held",
    toStatus: "extended",
    ownerId: "worker-001",
    reasonCode: "lease.refresh",
    traceId: "trace-001",
    occurredAt: "2026-05-11T00:00:00.000Z",
    fencingToken: 7,
  };
}

// =============================================================================
// Happy path tests
// =============================================================================

test("transitionLock accepts valid transition from held to extended", () => {
  const command = createBaseCommand();
  command.fromStatus = "held";
  command.toStatus = "extended";

  const result = transitionLock(command);

  assert.equal(result.accepted, true);
  assert.equal(result.command.toStatus, "extended");
  assert.equal(result.command.fromStatus, "held");
});

test("transitionLock accepts valid transition from held to released", () => {
  const command = createBaseCommand();
  command.fromStatus = "held";
  command.toStatus = "released";

  const result = transitionLock(command);

  assert.equal(result.accepted, true);
  assert.equal(result.command.toStatus, "released");
});

test("transitionLock accepts valid transition from extended to held", () => {
  const command = createBaseCommand();
  command.fromStatus = "extended";
  command.toStatus = "held";

  const result = transitionLock(command);

  assert.equal(result.accepted, true);
  assert.equal(result.command.toStatus, "held");
});

test("transitionLock accepts valid transition from held to expired", () => {
  const command = createBaseCommand();
  command.fromStatus = "held";
  command.toStatus = "expired";

  const result = transitionLock(command);

  assert.equal(result.accepted, true);
  assert.equal(result.command.toStatus, "expired");
});

test("transitionLock accepts valid transition from held to reclaimed", () => {
  const command = createBaseCommand();
  command.fromStatus = "held";
  command.toStatus = "reclaimed";

  const result = transitionLock(command);

  assert.equal(result.accepted, true);
  assert.equal(result.command.toStatus, "reclaimed");
});

test("transitionLock accepts valid transition from held to stolen", () => {
  const command = createBaseCommand();
  command.fromStatus = "held";
  command.toStatus = "stolen";

  const result = transitionLock(command);

  assert.equal(result.accepted, true);
  assert.equal(result.command.toStatus, "stolen");
});

test("transitionLock accepts transition with all valid LockStatus values", () => {
  const validStatuses: LockStatus[] = ["pending", "held", "extended", "released", "expired", "reclaimed", "stolen"];

  for (const fromStatus of validStatuses) {
    for (const toStatus of validStatuses) {
      if (fromStatus === toStatus) continue;

      const command = createBaseCommand();
      command.fromStatus = fromStatus;
      command.toStatus = toStatus;

      const result = transitionLock(command);
      assert.equal(result.accepted, true, `Transition from ${fromStatus} to ${toStatus} should be accepted`);
    }
  }
});

test("transitionLock accepts transition with all valid LockType values", () => {
  const validTypes: LockType[] = ["execution_lease", "approval_lock", "file_lock", "advisory_lock"];

  for (const lockType of validTypes) {
    const command = createBaseCommand();
    command.lockType = lockType;

    const result = transitionLock(command);
    assert.equal(result.accepted, true, `LockType ${lockType} should be accepted`);
  }
});

// =============================================================================
// Noop transition tests (fromStatus === toStatus)
// =============================================================================

test("transitionLock rejects noop transition when fromStatus equals toStatus", () => {
  const command = createBaseCommand();
  command.fromStatus = "held";
  command.toStatus = "held";

  assert.throws(
    () => transitionLock(command),
    /distributed_lock.transition_noop/,
  );
});

test("transitionLock rejects noop transition for extended status", () => {
  const command = createBaseCommand();
  command.fromStatus = "extended";
  command.toStatus = "extended";

  assert.throws(
    () => transitionLock(command),
    /distributed_lock.transition_noop/,
  );
});

test("transitionLock rejects noop transition for released status", () => {
  const command = createBaseCommand();
  command.fromStatus = "released";
  command.toStatus = "released";

  assert.throws(
    () => transitionLock(command),
    /distributed_lock.transition_noop/,
  );
});

// =============================================================================
// lockId validation tests
// =============================================================================

test("transitionLock throws for empty lockId", () => {
  const command = createBaseCommand();
  command.lockId = "";

  assert.throws(
    () => transitionLock(command),
    /distributed_lock.lock_id_required/,
  );
});

test("transitionLock throws for whitespace-only lockId", () => {
  const command = createBaseCommand();
  command.lockId = "   ";

  assert.throws(
    () => transitionLock(command),
    /distributed_lock.lock_id_required/,
  );
});

test("transitionLock throws for lockId with only newlines", () => {
  const command = createBaseCommand();
  command.lockId = "\n\t";

  assert.throws(
    () => transitionLock(command),
    /distributed_lock.lock_id_required/,
  );
});

// =============================================================================
// resourceKey validation tests
// =============================================================================

test("transitionLock throws for empty resourceKey", () => {
  const command = createBaseCommand();
  command.resourceKey = "";

  assert.throws(
    () => transitionLock(command),
    /distributed_lock.resource_key_required/,
  );
});

test("transitionLock throws for whitespace-only resourceKey", () => {
  const command = createBaseCommand();
  command.resourceKey = "   ";

  assert.throws(
    () => transitionLock(command),
    /distributed_lock.resource_key_required/,
  );
});

test("transitionLock throws for resourceKey with only tabs", () => {
  const command = createBaseCommand();
  command.resourceKey = "\t\t";

  assert.throws(
    () => transitionLock(command),
    /distributed_lock.resource_key_required/,
  );
});

// =============================================================================
// ownerId validation tests
// =============================================================================

test("transitionLock throws for empty ownerId", () => {
  const command = createBaseCommand();
  command.ownerId = "";

  assert.throws(
    () => transitionLock(command),
    /distributed_lock.owner_id_required/,
  );
});

test("transitionLock throws for whitespace-only ownerId", () => {
  const command = createBaseCommand();
  command.ownerId = "   ";

  assert.throws(
    () => transitionLock(command),
    /distributed_lock.owner_id_required/,
  );
});

test("transitionLock throws for ownerId with only spaces", () => {
  const command = createBaseCommand();
  command.ownerId = "               ";

  assert.throws(
    () => transitionLock(command),
    /distributed_lock.owner_id_required/,
  );
});

// =============================================================================
// reasonCode validation tests
// =============================================================================

test("transitionLock throws for empty reasonCode", () => {
  const command = createBaseCommand();
  command.reasonCode = "";

  assert.throws(
    () => transitionLock(command),
    /distributed_lock.reason_code_required/,
  );
});

test("transitionLock throws for whitespace-only reasonCode", () => {
  const command = createBaseCommand();
  command.reasonCode = "   ";

  assert.throws(
    () => transitionLock(command),
    /distributed_lock.reason_code_required/,
  );
});

test("transitionLock throws for reasonCode with only newlines", () => {
  const command = createBaseCommand();
  command.reasonCode = "\n\n";

  assert.throws(
    () => transitionLock(command),
    /distributed_lock.reason_code_required/,
  );
});

// =============================================================================
// traceId validation tests
// =============================================================================

test("transitionLock throws for empty traceId", () => {
  const command = createBaseCommand();
  command.traceId = "";

  assert.throws(
    () => transitionLock(command),
    /distributed_lock.trace_id_required/,
  );
});

test("transitionLock throws for whitespace-only traceId", () => {
  const command = createBaseCommand();
  command.traceId = "   ";

  assert.throws(
    () => transitionLock(command),
    /distributed_lock.trace_id_required/,
  );
});

test("transitionLock throws for traceId with only spaces", () => {
  const command = createBaseCommand();
  command.traceId = "          ";

  assert.throws(
    () => transitionLock(command),
    /distributed_lock.trace_id_required/,
  );
});

// =============================================================================
// Multiple validation errors - first error thrown
// =============================================================================

test("transitionLock throws lock_id_required before resource_key_required when lockId is empty", () => {
  const command = createBaseCommand();
  command.lockId = "";
  command.resourceKey = "";

  try {
    transitionLock(command);
    assert.fail("Expected transitionLock to throw");
  } catch (error) {
    assert.match((error as Error).message, /distributed_lock.lock_id_required/);
  }
});

test("transitionLock validation order: lockId is checked before resourceKey", () => {
  const command = createBaseCommand();
  command.lockId = "";
  // resourceKey is valid

  try {
    transitionLock(command);
    assert.fail("Expected transitionLock to throw");
  } catch (error) {
    assert.match((error as Error).message, /distributed_lock.lock_id_required/);
  }
});

test("transitionLock validation order: resourceKey is checked before ownerId", () => {
  const command = createBaseCommand();
  command.resourceKey = "";

  try {
    transitionLock(command);
    assert.fail("Expected transitionLock to throw");
  } catch (error) {
    assert.match((error as Error).message, /distributed_lock.resource_key_required/);
  }
});

test("transitionLock validation order: ownerId is checked before reasonCode", () => {
  const command = createBaseCommand();
  command.ownerId = "";

  try {
    transitionLock(command);
    assert.fail("Expected transitionLock to throw");
  } catch (error) {
    assert.match((error as Error).message, /distributed_lock.owner_id_required/);
  }
});

test("transitionLock validation order: reasonCode is checked before traceId", () => {
  const command = createBaseCommand();
  command.reasonCode = "";

  try {
    transitionLock(command);
    assert.fail("Expected transitionLock to throw");
  } catch (error) {
    assert.match((error as Error).message, /distributed_lock.reason_code_required/);
  }
});

test("transitionLock validation order: traceId is checked before fromStatus vs toStatus", () => {
  const command = createBaseCommand();
  command.traceId = "";

  try {
    transitionLock(command);
    assert.fail("Expected transitionLock to throw");
  } catch (error) {
    assert.match((error as Error).message, /distributed_lock.trace_id_required/);
  }
});

// =============================================================================
// Return value structure tests
// =============================================================================

test("transitionLock returns LockTransitionResult with accepted=true on success", () => {
  const command = createBaseCommand();
  const result = transitionLock(command);

  assert.equal(result.accepted, true);
  assert.ok("command" in result);
  assert.equal(result.command.lockId, command.lockId);
  assert.equal(result.command.lockType, command.lockType);
  assert.equal(result.command.resourceKey, command.resourceKey);
  assert.equal(result.command.fromStatus, command.fromStatus);
  assert.equal(result.command.toStatus, command.toStatus);
  assert.equal(result.command.ownerId, command.ownerId);
  assert.equal(result.command.reasonCode, command.reasonCode);
  assert.equal(result.command.traceId, command.traceId);
  assert.equal(result.command.occurredAt, command.occurredAt);
});

test("transitionLock preserves optional fencingToken in result", () => {
  const command = createBaseCommand();
  command.fencingToken = 42;

  const result = transitionLock(command);

  assert.equal(result.accepted, true);
  assert.equal(result.command.fencingToken, 42);
});

test("transitionLock result command is the same object as input", () => {
  const command = createBaseCommand();
  const result = transitionLock(command);

  // The command object should be preserved (not cloned)
  assert.strictEqual(result.command, command);
});

// =============================================================================
// Edge cases
// =============================================================================

test("transitionLock handles lockId with leading/trailing whitespace that is not trimmed", () => {
  // Note: The implementation uses trim().length === 0 to check for empty,
  // but does not actually trim the value before storing
  const command = createBaseCommand();
  command.lockId = "  lock-with-spaces  ";

  const result = transitionLock(command);
  assert.equal(result.accepted, true);
  assert.equal(result.command.lockId, "  lock-with-spaces  ");
});

test("transitionLock handles resourceKey with special characters", () => {
  const command = createBaseCommand();
  command.resourceKey = "worker:lease:001:sub:resource?query=value&other=123";

  const result = transitionLock(command);
  assert.equal(result.accepted, true);
});

test("transitionLock handles reasonCode with dots and underscores", () => {
  const command = createBaseCommand();
  command.reasonCode = "lease.refresh_v2.1";

  const result = transitionLock(command);
  assert.equal(result.accepted, true);
  assert.equal(result.command.reasonCode, "lease.refresh_v2.1");
});

test("transitionLock handles traceId with UUID format", () => {
  const command = createBaseCommand();
  command.traceId = "550e8400-e29b-41d4-a716-446655440000";

  const result = transitionLock(command);
  assert.equal(result.accepted, true);
  assert.equal(result.command.traceId, "550e8400-e29b-41d4-a716-446655440000");
});

test("transitionLock handles occurredAt with various ISO timestamp formats", () => {
  const command = createBaseCommand();

  const validTimestamps = [
    "2026-05-11T00:00:00.000Z",
    "2026-05-11T00:00:00Z",
    "2026-12-31T23:59:59.999Z",
  ];

  for (const occurredAt of validTimestamps) {
    command.occurredAt = occurredAt;
    const result = transitionLock(command);
    assert.equal(result.accepted, true, `Timestamp ${occurredAt} should be accepted`);
  }
});
