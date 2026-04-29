import assert from "node:assert/strict";
import test from "node:test";

import type {
  AcquireExecutionLeaseInput,
  ExecutionLeaseDecision,
  ExecutionLeaseHandoverDecision,
  ExecutionWriteValidationResult,
  HandoverExecutionLeaseInput,
  ReleaseExecutionLeaseInput,
  RenewExecutionLeaseInput,
  ValidateExecutionWriteInput,
} from "../../../../../src/platform/execution/lease/execution-lease-service-async.js";

test("AcquireExecutionLeaseInput interface structure", () => {
  const input: AcquireExecutionLeaseInput = {
    executionId: "exec_1",
    workerId: "worker_1",
    ttlMs: 30_000,
    occurredAt: "2026-04-26T10:00:00Z",
  };

  assert.equal(input.executionId, "exec_1");
  assert.equal(input.workerId, "worker_1");
  assert.equal(input.ttlMs, 30_000);
});

test("AcquireExecutionLeaseInput queueName is optional", () => {
  const input: AcquireExecutionLeaseInput = {
    executionId: "exec_1",
    workerId: "worker_1",
    ttlMs: 30_000,
  };

  assert.equal(input.queueName, undefined);
});

test("RenewExecutionLeaseInput interface structure", () => {
  const input: RenewExecutionLeaseInput = {
    leaseId: "lease_1",
    workerId: "worker_1",
    ttlMs: 15_000,
    occurredAt: "2026-04-26T10:15:00Z",
  };

  assert.equal(input.leaseId, "lease_1");
  assert.equal(input.workerId, "worker_1");
  assert.equal(input.ttlMs, 15_000);
});

test("ReleaseExecutionLeaseInput interface structure", () => {
  const input: ReleaseExecutionLeaseInput = {
    leaseId: "lease_1",
    workerId: "worker_1",
    reasonCode: "work_completed",
    occurredAt: "2026-04-26T10:30:00Z",
  };

  assert.equal(input.leaseId, "lease_1");
  assert.equal(input.reasonCode, "work_completed");
});

test("ReleaseExecutionLeaseInput reasonCode is optional", () => {
  const input: ReleaseExecutionLeaseInput = {
    leaseId: "lease_1",
    workerId: "worker_1",
  };

  assert.equal(input.reasonCode, undefined);
});

test("ValidateExecutionWriteInput interface structure", () => {
  const input: ValidateExecutionWriteInput = {
    executionId: "exec_1",
    leaseId: "lease_1",
    workerId: "worker_1",
    fencingToken: 1,
    occurredAt: "2026-04-26T10:00:00Z",
  };

  assert.equal(input.executionId, "exec_1");
  assert.equal(input.leaseId, "lease_1");
  assert.equal(input.fencingToken, 1);
});

test("HandoverExecutionLeaseInput interface structure", () => {
  const input: HandoverExecutionLeaseInput = {
    leaseId: "lease_1",
    workerId: "worker_1",
    newWorkerId: "worker_2",
    ttlMs: 30_000,
    reasonCode: "worker_draining",
    occurredAt: "2026-04-26T10:00:00Z",
  };

  assert.equal(input.leaseId, "lease_1");
  assert.equal(input.newWorkerId, "worker_2");
  assert.equal(input.reasonCode, "worker_draining");
});

test("ExecutionLeaseDecision outcome types", () => {
  const blockedDecision: ExecutionLeaseDecision = {
    outcome: "blocked",
    reasonCode: "active_lease_exists",
    lease: null,
  };

  assert.equal(blockedDecision.outcome, "blocked");
  assert.equal(blockedDecision.reasonCode, "active_lease_exists");

  const grantedDecision: ExecutionLeaseDecision = {
    outcome: "granted",
    reasonCode: null,
    lease: {
      id: "lease_1",
      executionId: "exec_1",
      workerId: "worker_1",
      attempt: 1,
      fencingToken: 1,
      queueName: null,
      status: "active" as const,
      leasedAt: "2026-04-26T10:00:00Z",
      expiresAt: "2026-04-26T10:30:00Z",
      lastHeartbeatAt: "2026-04-26T10:00:00Z",
      releasedAt: null,
      reasonCode: null,
    },
  };

  assert.equal(grantedDecision.outcome, "granted");
  assert.ok(grantedDecision.lease);
});

test("ExecutionLeaseDecision with renewed outcome", () => {
  const decision: ExecutionLeaseDecision = {
    outcome: "renewed",
    reasonCode: null,
    lease: {
      id: "lease_1",
      executionId: "exec_1",
      workerId: "worker_1",
      attempt: 1,
      fencingToken: 1,
      queueName: null,
      status: "active" as const,
      leasedAt: "2026-04-26T10:00:00Z",
      expiresAt: "2026-04-26T10:30:00Z",
      lastHeartbeatAt: "2026-04-26T10:15:00Z",
      releasedAt: null,
      reasonCode: null,
    },
  };

  assert.equal(decision.outcome, "renewed");
});

test("ExecutionLeaseDecision with released outcome", () => {
  const decision: ExecutionLeaseDecision = {
    outcome: "released",
    reasonCode: null,
    lease: null,
  };

  assert.equal(decision.outcome, "released");
});

test("ExecutionWriteValidationResult allowed structure", () => {
  const result: ExecutionWriteValidationResult = {
    allowed: true,
    reasonCode: null,
    authoritativeFencingToken: 1,
    activeLeaseId: "lease_1",
  };

  assert.equal(result.allowed, true);
  assert.equal(result.authoritativeFencingToken, 1);
});

test("ExecutionWriteValidationResult not allowed - no active lease", () => {
  const result: ExecutionWriteValidationResult = {
    allowed: false,
    reasonCode: "no_active_lease",
    authoritativeFencingToken: 0,
    activeLeaseId: null,
  };

  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "no_active_lease");
});

test("ExecutionWriteValidationResult not allowed - lease mismatch", () => {
  const result: ExecutionWriteValidationResult = {
    allowed: false,
    reasonCode: "lease_mismatch",
    authoritativeFencingToken: 2,
    activeLeaseId: "lease_2",
  };

  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "lease_mismatch");
  assert.equal(result.authoritativeFencingToken, 2);
});

test("ExecutionWriteValidationResult not allowed - worker mismatch", () => {
  const result: ExecutionWriteValidationResult = {
    allowed: false,
    reasonCode: "worker_mismatch",
    authoritativeFencingToken: 1,
    activeLeaseId: "lease_1",
  };

  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "worker_mismatch");
});

test("ExecutionWriteValidationResult not allowed - stale fencing token", () => {
  const result: ExecutionWriteValidationResult = {
    allowed: false,
    reasonCode: "stale_fencing_token",
    authoritativeFencingToken: 3,
    activeLeaseId: "lease_1",
  };

  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "stale_fencing_token");
  assert.equal(result.authoritativeFencingToken, 3);
});

test("ExecutionWriteValidationResult not allowed - lease expired", () => {
  const result: ExecutionWriteValidationResult = {
    allowed: false,
    reasonCode: "lease_expired",
    authoritativeFencingToken: 4,
    activeLeaseId: "lease_3",
  };

  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "lease_expired");
  assert.equal(result.authoritativeFencingToken, 4);
});

test("ExecutionLeaseHandoverDecision blocked structure", () => {
  const decision: ExecutionLeaseHandoverDecision = {
    outcome: "blocked",
    reasonCode: "lease_not_found",
    previousLease: null,
    lease: null,
  };

  assert.equal(decision.outcome, "blocked");
  assert.equal(decision.reasonCode, "lease_not_found");
});

test("ExecutionLeaseHandoverDecision handed_over structure", () => {
  const decision: ExecutionLeaseHandoverDecision = {
    outcome: "handed_over",
    reasonCode: null,
    previousLease: {
      id: "lease_1",
      executionId: "exec_1",
      workerId: "worker_1",
      attempt: 1,
      fencingToken: 1,
      queueName: null,
      status: "released" as const,
      leasedAt: "2026-04-26T10:00:00Z",
      expiresAt: "2026-04-26T10:30:00Z",
      lastHeartbeatAt: "2026-04-26T10:00:00Z",
      releasedAt: "2026-04-26T10:20:00Z",
      reasonCode: "worker_draining_handover",
    },
    lease: {
      id: "lease_2",
      executionId: "exec_1",
      workerId: "worker_2",
      attempt: 1,
      fencingToken: 2,
      queueName: null,
      status: "active" as const,
      leasedAt: "2026-04-26T10:20:00Z",
      expiresAt: "2026-04-26T10:50:00Z",
      lastHeartbeatAt: "2026-04-26T10:20:00Z",
      releasedAt: null,
      reasonCode: null,
    },
  };

  assert.equal(decision.outcome, "handed_over");
  assert.ok(decision.previousLease);
  assert.ok(decision.lease);
  assert.equal(decision.lease!.fencingToken, 2);
});
