import assert from "node:assert/strict";
import test from "node:test";

import type {
  WorkerClaimExecutionInput,
  WorkerExecutionHeartbeatInput,
  WorkerRemoteLogInput,
  WorkerHandshakeDecision,
  ExecutionWorkerHandshakeServiceOptions,
} from "../../../../../../src/platform/execution/worker-pool/worker/execution-worker-handshake-types.js";
import type { WorkerSnapshotRecord } from "../../../../../../src/platform/contracts/types/domain.js";
import { ExecutionResourceCeilingGuard } from "../../../../../../src/platform/execution/dispatcher/execution-resource-ceiling-guard.js";

// ---------------------------------------------------------------------------
// WorkerClaimExecutionInput
// ---------------------------------------------------------------------------

test("WorkerClaimExecutionInput minimal construction", () => {
  const input: WorkerClaimExecutionInput = {
    ticketId: "ticket_123",
    workerId: "worker_abc",
    leaseId: "lease_xyz",
    fencingToken: 1,
  };
  assert.equal(input.ticketId, "ticket_123");
  assert.equal(input.workerId, "worker_abc");
  assert.equal(input.fencingToken, 1);
});

test("WorkerClaimExecutionInput with all optional fields", () => {
  const input: WorkerClaimExecutionInput = {
    ticketId: "ticket_full",
    workerId: "worker_full",
    leaseId: "lease_full",
    fencingToken: 5,
    runtimeInstanceId: "runtime_1",
    restartedFromRuntimeInstanceId: "runtime_0",
    progressMessage: "executing step 3",
    lastToolName: "bash",
    toolCallCount: 42,
    cpuPct: 65.5,
    memoryMb: 512,
    remoteSessionStatus: "connected",
    lastAcknowledgedStreamOffset: "offset_100",
    streamResumeSuccessRate: 0.95,
    credentialRefreshSuccessRate: 0.99,
    sessionConsistencyCheckStatus: "passed",
    sessionConsistencyCheckedAt: "2026-04-25T00:00:00.000Z",
    workspaceSyncStatus: "aligned",
    workspaceSyncCheckedAt: "2026-04-25T00:00:00.000Z",
    saturation: 0.7,
    activeLeaseCount: 2,
    meanStartupLatencyMs: 1500,
    sandboxSuccessRate: 0.98,
    repoCacheHitRate: 0.85,
    toolBacklogCount: 5,
    currentStepId: "step_3",
    lastProgressAt: "2026-04-25T00:01:00.000Z",
    remoteLogs: [
      { level: "info", message: "worker starting", context: { workerId: "worker_full" } },
    ],
    occurredAt: "2026-04-25T00:00:00.000Z",
  };
  assert.equal(input.runtimeInstanceId, "runtime_1");
  assert.equal(input.progressMessage, "executing step 3");
  assert.equal(input.toolCallCount, 42);
  assert.equal(input.saturation, 0.7);
  assert.ok(input.remoteLogs != null);
  assert.equal(input.remoteLogs.length, 1);
});

test("WorkerClaimExecutionInput remoteLogs can be empty", () => {
  const input: WorkerClaimExecutionInput = {
    ticketId: "ticket_1",
    workerId: "worker_1",
    leaseId: "lease_1",
    fencingToken: 1,
    remoteLogs: [],
  };
  assert.ok(Array.isArray(input.remoteLogs));
  assert.equal(input.remoteLogs.length, 0);
});

// ---------------------------------------------------------------------------
// WorkerExecutionHeartbeatInput
// ---------------------------------------------------------------------------

test("WorkerExecutionHeartbeatInput minimal construction", () => {
  const input: WorkerExecutionHeartbeatInput = {
    executionId: "exec_123",
    workerId: "worker_abc",
    leaseId: "lease_xyz",
    fencingToken: 1,
    ttlMs: 30000,
  };
  assert.equal(input.executionId, "exec_123");
  assert.equal(input.ttlMs, 30000);
});

test("WorkerExecutionHeartbeatInput with all optional fields", () => {
  const input: WorkerExecutionHeartbeatInput = {
    executionId: "exec_full",
    workerId: "worker_full",
    leaseId: "lease_full",
    fencingToken: 3,
    ttlMs: 60000,
    runtimeInstanceId: "runtime_2",
    restartedFromRuntimeInstanceId: "runtime_1",
    progressMessage: "processing",
    lastToolName: "edit",
    toolCallCount: 100,
    cpuPct: 80.0,
    memoryMb: 1024,
    remoteSessionStatus: "connected",
    lastAcknowledgedStreamOffset: "offset_200",
    streamResumeSuccessRate: 0.9,
    credentialRefreshSuccessRate: 0.95,
    sessionConsistencyCheckStatus: "passed",
    sessionConsistencyCheckedAt: "2026-04-25T00:00:00.000Z",
    workspaceSyncStatus: "aligned",
    workspaceSyncCheckedAt: "2026-04-25T00:00:00.000Z",
    saturation: 0.85,
    activeLeaseCount: 3,
    meanStartupLatencyMs: 2000,
    sandboxSuccessRate: 0.97,
    repoCacheHitRate: 0.88,
    toolBacklogCount: 10,
    currentStepId: "step_5",
    lastProgressAt: "2026-04-25T00:02:00.000Z",
    remoteLogs: [
      { level: "warn", message: "high memory usage", context: { memoryMb: 1024 } },
    ],
    occurredAt: "2026-04-25T00:01:00.000Z",
  };
  assert.equal(input.saturation, 0.85);
  assert.equal(input.toolBacklogCount, 10);
  assert.equal(input.remoteLogs?.[0]?.level, "warn");
});

// ---------------------------------------------------------------------------
// WorkerRemoteLogInput
// ---------------------------------------------------------------------------

test("WorkerRemoteLogInput debug level", () => {
  const log: WorkerRemoteLogInput = {
    level: "debug",
    message: "debug message",
    context: null,
  };
  assert.equal(log.level, "debug");
  assert.equal(log.message, "debug message");
});

test("WorkerRemoteLogInput info level", () => {
  const log: WorkerRemoteLogInput = {
    level: "info",
    message: "info message",
  };
  assert.equal(log.level, "info");
  assert.equal(log.context, undefined);
});

test("WorkerRemoteLogInput warn level with occurredAt", () => {
  const log: WorkerRemoteLogInput = {
    level: "warn",
    message: "warning message",
    context: { warning: true },
    occurredAt: "2026-04-25T00:00:00.000Z",
  };
  assert.equal(log.level, "warn");
  assert.equal(log.occurredAt, "2026-04-25T00:00:00.000Z");
});

test("WorkerRemoteLogInput error level", () => {
  const log: WorkerRemoteLogInput = {
    level: "error",
    message: "error occurred",
  };
  assert.equal(log.level, "error");
});

test("WorkerRemoteLogInput accepts all valid log levels", () => {
  const levels: WorkerRemoteLogInput["level"][] = ["debug", "info", "warn", "error"];
  assert.equal(levels.length, 4);
});

// ---------------------------------------------------------------------------
// WorkerHandshakeDecision
// ---------------------------------------------------------------------------

test("WorkerHandshakeDecision accepted decision", () => {
  const decision: WorkerHandshakeDecision = {
    accepted: true,
    reasonCode: null,
    executionId: "exec_123",
    ticketId: "ticket_456",
    leaseId: "lease_789",
  };
  assert.equal(decision.accepted, true);
  assert.equal(decision.reasonCode, null);
  assert.ok(decision.executionId != null);
});

test("WorkerHandshakeDecision rejected with ticket_not_found", () => {
  const decision: WorkerHandshakeDecision = {
    accepted: false,
    reasonCode: "ticket_not_found",
    executionId: null,
    ticketId: "ticket_missing",
    leaseId: null,
  };
  assert.equal(decision.accepted, false);
  assert.equal(decision.reasonCode, "ticket_not_found");
});

test("WorkerHandshakeDecision rejected with ticket_not_claimed", () => {
  const decision: WorkerHandshakeDecision = {
    accepted: false,
    reasonCode: "ticket_not_claimed",
    executionId: null,
    ticketId: "ticket_not_claimed_123",
    leaseId: null,
  };
  assert.equal(decision.reasonCode, "ticket_not_claimed");
});

test("WorkerHandshakeDecision rejected with worker_mismatch", () => {
  const decision: WorkerHandshakeDecision = {
    accepted: false,
    reasonCode: "worker_mismatch",
    executionId: null,
    ticketId: null,
    leaseId: null,
  };
  assert.equal(decision.reasonCode, "worker_mismatch");
});

test("WorkerHandshakeDecision rejected with lease_mismatch", () => {
  const decision: WorkerHandshakeDecision = {
    accepted: false,
    reasonCode: "lease_mismatch",
    executionId: null,
    ticketId: null,
    leaseId: "lease_wrong",
  };
  assert.equal(decision.reasonCode, "lease_mismatch");
});

test("WorkerHandshakeDecision rejected with worker_not_registered", () => {
  const decision: WorkerHandshakeDecision = {
    accepted: false,
    reasonCode: "worker_not_registered",
    executionId: null,
    ticketId: null,
    leaseId: null,
  };
  assert.equal(decision.reasonCode, "worker_not_registered");
});

test("WorkerHandshakeDecision rejected with worker_not_trusted", () => {
  const decision: WorkerHandshakeDecision = {
    accepted: false,
    reasonCode: "worker_not_trusted",
    executionId: null,
    ticketId: null,
    leaseId: null,
  };
  assert.equal(decision.reasonCode, "worker_not_trusted");
});

test("WorkerHandshakeDecision rejected with lease_not_found", () => {
  const decision: WorkerHandshakeDecision = {
    accepted: false,
    reasonCode: "lease_not_found",
    executionId: null,
    ticketId: null,
    leaseId: null,
  };
  assert.equal(decision.reasonCode, "lease_not_found");
});

test("WorkerHandshakeDecision rejected with no_active_lease", () => {
  const decision: WorkerHandshakeDecision = {
    accepted: false,
    reasonCode: "no_active_lease",
    executionId: null,
    ticketId: null,
    leaseId: null,
  };
  assert.equal(decision.reasonCode, "no_active_lease");
});

test("WorkerHandshakeDecision rejected with stale_fencing_token", () => {
  const decision: WorkerHandshakeDecision = {
    accepted: false,
    reasonCode: "stale_fencing_token",
    executionId: null,
    ticketId: null,
    leaseId: null,
  };
  assert.equal(decision.reasonCode, "stale_fencing_token");
});

test("WorkerHandshakeDecision rejected with execution_not_found", () => {
  const decision: WorkerHandshakeDecision = {
    accepted: false,
    reasonCode: "execution_not_found",
    executionId: null,
    ticketId: null,
    leaseId: null,
  };
  assert.equal(decision.reasonCode, "execution_not_found");
});

test("WorkerHandshakeDecision rejected with lease_not_active", () => {
  const decision: WorkerHandshakeDecision = {
    accepted: false,
    reasonCode: "lease_not_active",
    executionId: null,
    ticketId: null,
    leaseId: null,
  };
  assert.equal(decision.reasonCode, "lease_not_active");
});

test("WorkerHandshakeDecision rejected with lease_expired", () => {
  const decision: WorkerHandshakeDecision = {
    accepted: false,
    reasonCode: "lease_expired",
    executionId: null,
    ticketId: null,
    leaseId: null,
  };
  assert.equal(decision.reasonCode, "lease_expired");
});

test("WorkerHandshakeDecision rejected with remote_session_viewer_only", () => {
  const decision: WorkerHandshakeDecision = {
    accepted: false,
    reasonCode: "remote_session_viewer_only",
    executionId: null,
    ticketId: null,
    leaseId: null,
  };
  assert.equal(decision.reasonCode, "remote_session_viewer_only");
});

test("WorkerHandshakeDecision rejected with remote_session_consistency_mismatch", () => {
  const decision: WorkerHandshakeDecision = {
    accepted: false,
    reasonCode: "remote_session_consistency_mismatch",
    executionId: null,
    ticketId: null,
    leaseId: null,
  };
  assert.equal(decision.reasonCode, "remote_session_consistency_mismatch");
});

test("WorkerHandshakeDecision rejected with remote_workspace_sync_conflict", () => {
  const decision: WorkerHandshakeDecision = {
    accepted: false,
    reasonCode: "remote_workspace_sync_conflict",
    executionId: null,
    ticketId: null,
    leaseId: null,
  };
  assert.equal(decision.reasonCode, "remote_workspace_sync_conflict");
});

test("WorkerHandshakeDecision rejected with remote_session_resume_offset_missing", () => {
  const decision: WorkerHandshakeDecision = {
    accepted: false,
    reasonCode: "remote_session_resume_offset_missing",
    executionId: null,
    ticketId: null,
    leaseId: null,
  };
  assert.equal(decision.reasonCode, "remote_session_resume_offset_missing");
});

test("WorkerHandshakeDecision rejected with resource_limit_exceeded", () => {
  const decision: WorkerHandshakeDecision = {
    accepted: false,
    reasonCode: "resource_limit_exceeded",
    executionId: null,
    ticketId: null,
    leaseId: null,
  };
  assert.equal(decision.reasonCode, "resource_limit_exceeded");
});

test("WorkerHandshakeDecision all reasonCode values are unique", () => {
  const reasonCodes: WorkerHandshakeDecision["reasonCode"][] = [
    "ticket_not_found",
    "ticket_not_claimed",
    "worker_mismatch",
    "lease_mismatch",
    "worker_not_registered",
    "worker_not_trusted",
    "lease_not_found",
    "no_active_lease",
    "stale_fencing_token",
    "execution_not_found",
    "lease_not_active",
    "lease_expired",
    "remote_session_viewer_only",
    "remote_session_consistency_mismatch",
    "remote_workspace_sync_conflict",
    "remote_session_resume_offset_missing",
    "resource_limit_exceeded",
    null,
  ];
  const uniqueCount = new Set(reasonCodes.filter((r) => r !== null) as string[]).size;
  assert.equal(uniqueCount, 17); // 17 non-null reason codes
});

// ---------------------------------------------------------------------------
// ExecutionWorkerHandshakeServiceOptions
// ---------------------------------------------------------------------------

test("ExecutionWorkerHandshakeServiceOptions empty object is valid", () => {
  const options: ExecutionWorkerHandshakeServiceOptions = {};
  assert.ok(options != null);
});

test("ExecutionWorkerHandshakeServiceOptions with resourceCeilingGuard", () => {
  // Guard is a class instance, we just verify type accepts it
  const guard: ExecutionResourceCeilingGuard = new ExecutionResourceCeilingGuard({ maxToolCalls: 100 });
  const options: ExecutionWorkerHandshakeServiceOptions = {
    resourceCeilingGuard: guard,
  };
  assert.ok(options.resourceCeilingGuard != null);
});

test("ExecutionWorkerHandshakeServiceOptions resourceCeilingGuard is optional", () => {
  const options: ExecutionWorkerHandshakeServiceOptions = {};
  assert.equal(options.resourceCeilingGuard, undefined);
});