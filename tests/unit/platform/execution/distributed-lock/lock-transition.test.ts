/**
 * @fileoverview Unit tests for distributed lock transitionLock function
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  transitionLock,
  type LockTransitionCommand,
} from "../../../../../src/platform/five-plane-execution/distributed-lock/distributed-lock-types.js";

function makeCommand(overrides: Partial<LockTransitionCommand> = {}): LockTransitionCommand {
  return {
    lockId: "lock_1",
    lockType: "execution_lease",
    resourceKey: "exec_task_1",
    fromStatus: "held",
    toStatus: "released",
    ownerId: "owner_1",
    reasonCode: "normal_completion",
    traceId: "trace_1",
    occurredAt: "2024-01-01T00:00:00.000Z",
    ...overrides,
  };
}

test("transitionLock returns accepted true for valid transition", () => {
  const command = makeCommand();

  const result = transitionLock(command);

  assert.equal(result.accepted, true);
  assert.equal(result.command, command);
});

test("transitionLock throws for empty lockId", () => {
  const command = makeCommand({ lockId: "" });

  assert.throws(() => transitionLock(command), { message: "distributed_lock.lock_id_required" });
});

test("transitionLock throws for whitespace-only lockId", () => {
  const command = makeCommand({ lockId: "   " });

  assert.throws(() => transitionLock(command), { message: "distributed_lock.lock_id_required" });
});

test("transitionLock throws for empty resourceKey", () => {
  const command = makeCommand({ resourceKey: "" });

  assert.throws(() => transitionLock(command), { message: "distributed_lock.resource_key_required" });
});

test("transitionLock throws for empty ownerId", () => {
  const command = makeCommand({ ownerId: "" });

  assert.throws(() => transitionLock(command), { message: "distributed_lock.owner_id_required" });
});

test("transitionLock throws for empty reasonCode", () => {
  const command = makeCommand({ reasonCode: "" });

  assert.throws(() => transitionLock(command), { message: "distributed_lock.reason_code_required" });
});

test("transitionLock throws for empty traceId", () => {
  const command = makeCommand({ traceId: "" });

  assert.throws(() => transitionLock(command), { message: "distributed_lock.trace_id_required" });
});

test("transitionLock throws when fromStatus equals toStatus (noop)", () => {
  const command = makeCommand({ fromStatus: "held", toStatus: "held" });

  assert.throws(() => transitionLock(command), { message: "distributed_lock.transition_noop" });
});

test("transitionLock accepts any valid status transition", () => {
  const validTransitions: [LockTransitionCommand["fromStatus"], LockTransitionCommand["toStatus"]][] = [
    ["held", "released"],
    ["held", "expired"],
    ["held", "reclaimed"],
    ["held", "stolen"],
    ["pending", "held"],
    ["extended", "released"],
    ["extended", "reclaimed"],
  ];

  for (const [from, to] of validTransitions) {
    const command = makeCommand({ fromStatus: from, toStatus: to });
    const result = transitionLock(command);
    assert.equal(result.accepted, true, `transition ${from} -> ${to} should be accepted`);
  }
});

test("transitionLock passes through fencingToken", () => {
  const command = makeCommand({ fencingToken: 42 });

  const result = transitionLock(command);

  assert.equal(result.command.fencingToken, 42);
});

test("transitionLock preserves all command fields in result", () => {
  const command = makeCommand();

  const result = transitionLock(command);

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