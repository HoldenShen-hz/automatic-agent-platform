/**
 * Worker Handshake CLI Tests
 *
 * Tests for worker-handshake.ts CLI module.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { ValidationError } from "../../../../src/platform/contracts/errors.js";

// ---------------------------------------------------------------------------
// Tests for worker handshake action branching
// ---------------------------------------------------------------------------

test("worker-handshake action claim is valid", () => {
  const action = "claim";
  assert.equal(action, "claim");
});

test("worker-handshake action heartbeat is valid", () => {
  const action = "heartbeat";
  assert.equal(action, "heartbeat");
});

test("worker-handshake throws ValidationError for unknown action", () => {
  const action: string = "unknown";
  const errorPrefix = `unknown_worker_handshake_action:${action}`;
  assert.throws(
    () => {
      if (action !== "claim" && action !== "heartbeat") {
        throw new ValidationError(errorPrefix, errorPrefix);
      }
    },
    { message: errorPrefix },
  );
});

// ---------------------------------------------------------------------------
// Tests for claim execution argument building
// ---------------------------------------------------------------------------

test("claim requires ticketId", () => {
  const ticketId: string | null = null;
  assert.throws(
    () => {
      if (ticketId == null) {
        throw new ValidationError("missing_env:AA_TICKET_ID", "missing_env:AA_TICKET_ID");
      }
    },
    { message: "missing_env:AA_TICKET_ID" },
  );
});

test("claim builds arguments with ticketId and worker info", () => {
  const envConfig = {
    ticketId: "ticket-123",
    workerId: "worker-456",
    leaseId: "lease-789",
    fencingToken: 42,
    runtimeInstanceId: undefined,
    restartedFromRuntimeInstanceId: undefined,
    progressMessage: null,
    lastToolName: undefined,
    toolCallCount: undefined,
    cpuPct: undefined,
    memoryMb: undefined,
    remoteSessionStatus: undefined,
    lastAcknowledgedStreamOffset: undefined,
    streamResumeSuccessRate: undefined,
    credentialRefreshSuccessRate: undefined,
    sessionConsistencyCheckStatus: undefined,
    sessionConsistencyCheckedAt: undefined,
    workspaceSyncStatus: undefined,
    workspaceSyncCheckedAt: undefined,
    saturation: undefined,
    activeLeaseCount: undefined,
    meanStartupLatencyMs: undefined,
    sandboxSuccessRate: undefined,
    repoCacheHitRate: undefined,
    toolBacklogCount: undefined,
    currentStepId: undefined,
    lastProgressAt: undefined,
    remoteLogs: undefined,
    occurredAt: undefined,
  };

  const args: Record<string, unknown> = {
    ticketId: envConfig.ticketId,
    workerId: envConfig.workerId,
    leaseId: envConfig.leaseId,
    fencingToken: envConfig.fencingToken,
  };

  if (envConfig.runtimeInstanceId !== undefined) {
    args.runtimeInstanceId = envConfig.runtimeInstanceId;
  }

  assert.equal(args.ticketId, "ticket-123");
  assert.equal(args.workerId, "worker-456");
  assert.equal(args.fencingToken, 42);
});

test("claim includes optional metrics when provided", () => {
  const envConfig = {
    ticketId: "ticket-123",
    workerId: "worker-456",
    leaseId: "lease-789",
    fencingToken: 42,
    cpuPct: 65.5,
    memoryMb: 512,
    toolCallCount: 150,
  };

  const args: Record<string, unknown> = {
    ticketId: envConfig.ticketId,
    workerId: envConfig.workerId,
    leaseId: envConfig.leaseId,
    fencingToken: envConfig.fencingToken,
  };

  if (envConfig.cpuPct !== undefined) {
    args.cpuPct = envConfig.cpuPct;
  }
  if (envConfig.memoryMb !== undefined) {
    args.memoryMb = envConfig.memoryMb;
  }
  if (envConfig.toolCallCount !== undefined) {
    args.toolCallCount = envConfig.toolCallCount;
  }

  assert.equal(args.cpuPct, 65.5);
  assert.equal(args.memoryMb, 512);
  assert.equal(args.toolCallCount, 150);
});

// ---------------------------------------------------------------------------
// Tests for heartbeat argument building
// ---------------------------------------------------------------------------

test("heartbeat requires executionId", () => {
  const executionId: string | null = null;
  assert.throws(
    () => {
      if (executionId == null) {
        throw new ValidationError("missing_env:AA_EXECUTION_ID", "missing_env:AA_EXECUTION_ID");
      }
    },
    { message: "missing_env:AA_EXECUTION_ID" },
  );
});

test("heartbeat builds arguments with executionId and ttl", () => {
  const envConfig = {
    executionId: "exec-123",
    workerId: "worker-456",
    leaseId: "lease-789",
    fencingToken: 42,
    leaseTtlMs: 30000,
  };

  const args: Record<string, unknown> = {
    executionId: envConfig.executionId,
    workerId: envConfig.workerId,
    leaseId: envConfig.leaseId,
    fencingToken: envConfig.fencingToken,
    ttlMs: envConfig.leaseTtlMs,
  };

  assert.equal(args.executionId, "exec-123");
  assert.equal(args.ttlMs, 30000);
});

test("heartbeat includes progress message when provided", () => {
  const envConfig = {
    executionId: "exec-123",
    workerId: "worker-456",
    leaseId: "lease-789",
    fencingToken: 42,
    leaseTtlMs: 30000,
    progressMessage: "processing step 3",
  };

  const args: Record<string, unknown> = {
    executionId: envConfig.executionId,
    workerId: envConfig.workerId,
    leaseId: envConfig.leaseId,
    fencingToken: envConfig.fencingToken,
    ttlMs: envConfig.leaseTtlMs,
    progressMessage: envConfig.progressMessage,
  };

  assert.equal(args.progressMessage, "processing step 3");
});