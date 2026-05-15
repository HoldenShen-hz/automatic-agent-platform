import test from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";

import { SqliteDatabase } from "../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { ExecutionWorkerHandshakeService } from "../../../src/platform/five-plane-execution/worker-pool/execution-worker-handshake-service.js";
import { ExecutionLeaseService } from "../../../src/platform/five-plane-execution/lease/execution-lease-service.js";
import { WorkerRegistryService } from "../../../src/platform/five-plane-execution/worker-pool/worker-registry-service.js";
import { newId, nowIso } from "../../../src/platform/contracts/types/ids.js";
import { createTempWorkspace, cleanupPath } from "../../helpers/fs.js";
import type { TaskStatus, ExecutionStatus } from "../../../src/platform/contracts/types/status.js";

function plusMs(iso: string, ms: number): string {
  return new Date(Date.parse(iso) + ms).toISOString();
}

function setupDatabase(workspace: string) {
  const db = new SqliteDatabase(join(workspace, "test.db"));
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  const handshakeService = new ExecutionWorkerHandshakeService(db, store);
  const leaseService = new ExecutionLeaseService(db, store);
  const workerRegistry = new WorkerRegistryService(store);
  return { db, store, handshakeService, leaseService, workerRegistry };
}

function createWorkerAndLease(
  store: AuthoritativeTaskStore,
  workerId: string,
  taskId: string,
  executionId: string,
  ticketId: string,
  options: {
    status?: string;
    placement?: string;
    registrationVerifiedAt?: string | null;
    fenceToken?: number;
    leaseStatus?: string;
    ticketStatus?: string;
  } = {},
) {
  const now = nowIso();
  const {
    status = "idle",
    placement = "local",
    registrationVerifiedAt = null,
    fenceToken = 1,
    leaseStatus = "active",
    ticketStatus = "claimed",
  } = options;

  // Create worker snapshot
  store.upsertWorkerSnapshot({
    workerId,
    status: status as any,
    placement: placement as any,
    isolationLevel: "standard",
    repoVersion: null,
    remoteSessionStatus: null,
    lastAcknowledgedStreamOffset: null,
    streamResumeSuccessRate: null,
    credentialRefreshSuccessRate: null,
    sessionConsistencyCheckStatus: null,
    sessionConsistencyCheckedAt: null,
    workspaceSyncStatus: null,
    workspaceSyncCheckedAt: null,
    saturation: null,
    activeLeaseCount: 0,
    meanStartupLatencyMs: null,
    sandboxSuccessRate: null,
    repoCacheHitRate: null,
    registrationVerifiedAt: registrationVerifiedAt as any,
    registrationChallengeId: null,
    capabilitiesJson: "[]",
    runningExecutionsJson: "[]",
    maxConcurrency: 10,
    queueAffinity: null,
    runtimeInstanceId: null,
    restartedFromRuntimeInstanceId: null,
    restartGeneration: 0,
    cpuPct: null,
    memoryMb: null,
    toolBacklogCount: 0,
    currentStepId: null,
    lastProgressAt: null,
    lastHeartbeatAt: now,
    updatedAt: now,
  });

  const leaseId = newId("lease");
  const expiresAt = plusMs(now, 60000);

  // Create lease
  store.insertExecutionLease({
    id: leaseId,
    executionId,
    workerId,
    attempt: 1,
    fencingToken: fenceToken,
    queueName: null,
    status: leaseStatus as any,
    leasedAt: now,
    expiresAt,
    lastHeartbeatAt: now,
    releasedAt: null,
    reasonCode: null,
  });

  // Create ticket - uses the actual taskId that exists
  store.insertExecutionTicket({
    id: ticketId,
    executionId,
    taskId,
    priority: "normal",
    queueName: null,
    dispatchTarget: null,
    requiredIsolationLevel: null,
    requiredRepoVersion: null,
    requiredCapabilitiesJson: "[]",
    dispatchAfter: null,
    attempt: 1,
    status: ticketStatus as any,
    assignedWorkerId: workerId,
    leaseId,
    claimedAt: now,
    consumedAt: null,
    invalidatedAt: null,
    createdAt: now,
    updatedAt: now,
  });

  return { leaseId, expiresAt, fenceToken };
}

function createTaskAndExecution(
  store: AuthoritativeTaskStore,
  taskId: string,
  executionId: string,
  options: {
    taskStatus?: TaskStatus;
    executionStatus?: ExecutionStatus;
    startedAt?: string | null;
  } = {},
) {
  const now = nowIso();
  const {
    taskStatus = "in_progress",
    executionStatus = "created",
    startedAt = null,
  } = options;

  store.insertTask({
    id: taskId,
    parentId: null,
    rootId: taskId,
    divisionId: "general_ops",
    title: "Test task",
    status: taskStatus,
    source: "user",
    priority: "normal",
    inputJson: "{}",
    normalizedInputJson: "{}",
    outputJson: null,
    estimatedCostUsd: 0,
    actualCostUsd: 0,
    errorCode: null,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
  });

  store.insertExecution({
    id: executionId,
    taskId,
    workflowId: "single_agent_minimal",
    parentExecutionId: null,
    agentId: "unassigned", // Required field, will be updated on claim
    roleId: "general_executor",
    runKind: "task_run",
    status: executionStatus,
    inputRef: null,
    traceId: "trace-test",
    attempt: 1,
    timeoutMs: 60000,
    budgetUsdLimit: 1,
    requiresApproval: 0,
    sandboxMode: "workspace_write",
    allowedToolsJson: "[]",
    allowedPathsJson: "[]",
    maxRetries: 0,
    retryBackoff: "none",
    lastErrorCode: null,
    lastErrorMessage: null,
    startedAt,
    finishedAt: null,
    createdAt: now,
    updatedAt: now,
  });
}

// === Claim Execution Tests ===

test("claimExecution accepts valid claim from registered local worker", () => {
  const workspace = createTempWorkspace("aa-handshake-");
  try {
    const { db, store, handshakeService, leaseService } = setupDatabase(workspace);
    const now = nowIso();
    const taskId = newId("task");
    const executionId = newId("exec");
    const workerId = "worker-test-1";
    const ticketId = newId("ticket");

    createTaskAndExecution(store, taskId, executionId, { taskStatus: "in_progress", executionStatus: "created" });
    const { leaseId, fenceToken } = createWorkerAndLease(store, workerId, taskId, executionId, ticketId, {
      status: "idle",
      placement: "local",
      fenceToken: 1,
      ticketStatus: "claimed",
    });

    const result = handshakeService.claimExecution({
      ticketId,
      workerId,
      leaseId,
      fencingToken: fenceToken,
      occurredAt: now,
    });

    assert.equal(result.accepted, true);
    assert.equal(result.reasonCode, null);
    assert.equal(result.executionId, executionId);
    assert.equal(result.ticketId, ticketId);

    // Verify execution status updated
    const execution = store.getExecution(executionId);
    assert.equal(execution?.status, "executing");
    assert.equal(execution?.agentId, workerId);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("claimExecution rejects when ticket not found", () => {
  const workspace = createTempWorkspace("aa-handshake-");
  try {
    const { db, store, handshakeService } = setupDatabase(workspace);
    const now = nowIso();
    const taskId = newId("task");
    const executionId = newId("exec");
    const workerId = "worker-test-2";
    const ticketId = newId("ticket"); // This ticket won't be created

    createTaskAndExecution(store, taskId, executionId);
    // Do NOT create worker/lease/ticket - testing ticket not found

    const result = handshakeService.claimExecution({
      ticketId,
      workerId,
      leaseId: newId("lease"),
      fencingToken: 1,
      occurredAt: now,
    });

    assert.equal(result.accepted, false);
    assert.equal(result.reasonCode, "ticket_not_found");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("claimExecution rejects when worker not registered", () => {
  const workspace = createTempWorkspace("aa-handshake-");
  try {
    const { db, store, handshakeService } = setupDatabase(workspace);
    const now = nowIso();
    const taskId = newId("task");
    const executionId = newId("exec");
    const workerId = "unregistered-worker";
    const ticketId = newId("ticket");
    const leaseId = newId("lease");

    createTaskAndExecution(store, taskId, executionId);

    // Create ticket directly without registering worker
    const now2 = nowIso();
    store.insertExecutionTicket({
      id: ticketId,
      executionId,
      taskId,
      priority: "normal",
      queueName: null,
      dispatchTarget: null,
      requiredIsolationLevel: null,
      requiredRepoVersion: null,
      requiredCapabilitiesJson: "[]",
      dispatchAfter: null,
      attempt: 1,
      status: "claimed",
      assignedWorkerId: workerId, // Assigned to unregistered worker
      leaseId,
      claimedAt: now2,
      consumedAt: null,
      invalidatedAt: null,
      createdAt: now2,
      updatedAt: now2,
    });

    const result = handshakeService.claimExecution({
      ticketId,
      workerId,
      leaseId,
      fencingToken: 1,
      occurredAt: now,
    });

    assert.equal(result.accepted, false);
    assert.equal(result.reasonCode, "worker_not_registered");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("claimExecution rejects untrusted remote worker without registration verification", () => {
  const workspace = createTempWorkspace("aa-handshake-");
  try {
    const { db, store, handshakeService } = setupDatabase(workspace);
    const now = nowIso();
    const taskId = newId("task");
    const executionId = newId("exec");
    const workerId = "remote-worker-untrusted";
    const ticketId = newId("ticket");

    createTaskAndExecution(store, taskId, executionId);
    createWorkerAndLease(store, workerId, taskId, executionId, ticketId, {
      placement: "remote",
      registrationVerifiedAt: null, // Not verified
      ticketStatus: "claimed",
    });

    const result = handshakeService.claimExecution({
      ticketId,
      workerId,
      leaseId: newId("lease"),
      fencingToken: 1,
      occurredAt: now,
    });

    assert.equal(result.accepted, false);
    assert.equal(result.reasonCode, "worker_not_trusted");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("claimExecution accepts trusted remote worker with verification", () => {
  const workspace = createTempWorkspace("aa-handshake-");
  try {
    const { db, store, handshakeService } = setupDatabase(workspace);
    const now = nowIso();
    const taskId = newId("task");
    const executionId = newId("exec");
    const workerId = "remote-worker-trusted";
    const ticketId = newId("ticket");

    createTaskAndExecution(store, taskId, executionId);
    createWorkerAndLease(store, workerId, taskId, executionId, ticketId, {
      placement: "remote",
      registrationVerifiedAt: now, // Verified
      ticketStatus: "claimed",
    });

    const result = handshakeService.claimExecution({
      ticketId,
      workerId,
      leaseId: newId("lease"),
      fencingToken: 1,
      remoteSessionStatus: "connected",
      lastAcknowledgedStreamOffset: "stream:0",
      sessionConsistencyCheckStatus: "passed",
      workspaceSyncStatus: "aligned",
      occurredAt: now,
    });

    assert.equal(result.accepted, false); // Still fails due to lease mismatch
    assert.equal(result.reasonCode, "lease_mismatch");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("claimExecution rejects when ticket not in claimed status", () => {
  const workspace = createTempWorkspace("aa-handshake-");
  try {
    const { db, store, handshakeService } = setupDatabase(workspace);
    const now = nowIso();
    const taskId = newId("task");
    const executionId = newId("exec");
    const workerId = "worker-test-5";
    const ticketId = newId("ticket");

    createTaskAndExecution(store, taskId, executionId);
    createWorkerAndLease(store, workerId, taskId, executionId, ticketId, {
      ticketStatus: "pending", // Not claimed yet
    });

    const result = handshakeService.claimExecution({
      ticketId,
      workerId,
      leaseId: newId("lease"),
      fencingToken: 1,
      occurredAt: now,
    });

    assert.equal(result.accepted, false);
    assert.equal(result.reasonCode, "ticket_not_claimed");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("claimExecution rejects when ticket assigned to different worker", () => {
  const workspace = createTempWorkspace("aa-handshake-");
  try {
    const { db, store, handshakeService } = setupDatabase(workspace);
    const now = nowIso();
    const taskId = newId("task");
    const executionId = newId("exec");
    const workerId = "worker-test-6";
    const wrongWorkerId = "wrong-worker";
    const ticketId = newId("ticket");

    createTaskAndExecution(store, taskId, executionId);
    const { leaseId } = createWorkerAndLease(store, workerId, taskId, executionId, ticketId, {
      ticketStatus: "claimed",
    });

    // Register the wrong worker so it's recognized but not the assigned one
    store.upsertWorkerSnapshot({
      workerId: wrongWorkerId,
      status: "idle",
      placement: "local",
      isolationLevel: "standard",
      repoVersion: null,
      remoteSessionStatus: null,
      lastAcknowledgedStreamOffset: null,
      streamResumeSuccessRate: null,
      credentialRefreshSuccessRate: null,
      sessionConsistencyCheckStatus: null,
      sessionConsistencyCheckedAt: null,
      workspaceSyncStatus: null,
      workspaceSyncCheckedAt: null,
      saturation: null,
      activeLeaseCount: 0,
      meanStartupLatencyMs: null,
      sandboxSuccessRate: null,
      repoCacheHitRate: null,
      registrationVerifiedAt: null,
      registrationChallengeId: null,
      capabilitiesJson: "[]",
      runningExecutionsJson: "[]",
      maxConcurrency: 10,
      queueAffinity: null,
      runtimeInstanceId: null,
      restartedFromRuntimeInstanceId: null,
      restartGeneration: 0,
      cpuPct: null,
      memoryMb: null,
      toolBacklogCount: 0,
      currentStepId: null,
      lastProgressAt: null,
      lastHeartbeatAt: now,
      updatedAt: now,
    });

    const result = handshakeService.claimExecution({
      ticketId,
      workerId: wrongWorkerId,
      leaseId,
      fencingToken: 1,
      occurredAt: now,
    });

    assert.equal(result.accepted, false);
    assert.equal(result.reasonCode, "worker_mismatch");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("claimExecution rejects when lease ID does not match", () => {
  const workspace = createTempWorkspace("aa-handshake-");
  try {
    const { db, store, handshakeService } = setupDatabase(workspace);
    const now = nowIso();
    const taskId = newId("task");
    const executionId = newId("exec");
    const workerId = "worker-test-7";
    const ticketId = newId("ticket");

    createTaskAndExecution(store, taskId, executionId);
    createWorkerAndLease(store, workerId, taskId, executionId, ticketId, {
      ticketStatus: "claimed",
    });

    const result = handshakeService.claimExecution({
      ticketId,
      workerId,
      leaseId: "wrong-lease-id",
      fencingToken: 1,
      occurredAt: now,
    });

    assert.equal(result.accepted, false);
    assert.equal(result.reasonCode, "lease_mismatch");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("claimExecution rejects with stale fencing token", () => {
  const workspace = createTempWorkspace("aa-handshake-");
  try {
    const { db, store, handshakeService } = setupDatabase(workspace);
    const now = nowIso();
    const taskId = newId("task");
    const executionId = newId("exec");
    const workerId = "worker-test-8";
    const ticketId = newId("ticket");

    createTaskAndExecution(store, taskId, executionId);
    const { leaseId, fenceToken } = createWorkerAndLease(store, workerId, taskId, executionId, ticketId, {
      fenceToken: 5, // Current token is 5
      ticketStatus: "claimed",
    });

    // Use stale token (3 instead of 5)
    const result = handshakeService.claimExecution({
      ticketId,
      workerId,
      leaseId,
      fencingToken: 3,
      occurredAt: now,
    });

    assert.equal(result.accepted, false);
    assert.equal(result.reasonCode, "stale_fencing_token");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("claimExecution rejects when no active lease exists", () => {
  const workspace = createTempWorkspace("aa-handshake-");
  try {
    const { db, store, handshakeService } = setupDatabase(workspace);
    const now = nowIso();
    const taskId = newId("task");
    const executionId = newId("exec");
    const workerId = "worker-test-9";
    const ticketId = newId("ticket");

    createTaskAndExecution(store, taskId, executionId);
    const { leaseId, fenceToken } = createWorkerAndLease(store, workerId, taskId, executionId, ticketId, {
      leaseStatus: "released", // Lease is released
      ticketStatus: "claimed",
    });

    const result = handshakeService.claimExecution({
      ticketId,
      workerId,
      leaseId,
      fencingToken: fenceToken,
      occurredAt: now,
    });

    assert.equal(result.accepted, false);
    assert.equal(result.reasonCode, "no_active_lease");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("claimExecution rejects remote worker with viewer_only session status", () => {
  const workspace = createTempWorkspace("aa-handshake-");
  try {
    const { db, store, handshakeService } = setupDatabase(workspace);
    const now = nowIso();
    const taskId = newId("task");
    const executionId = newId("exec");
    const workerId = "remote-worker-viewer";
    const ticketId = newId("ticket");

    createTaskAndExecution(store, taskId, executionId);
    const { leaseId, fenceToken } = createWorkerAndLease(store, workerId, taskId, executionId, ticketId, {
      placement: "remote",
      registrationVerifiedAt: now,
      fenceToken: 1,
      ticketStatus: "claimed",
    });

    const result = handshakeService.claimExecution({
      ticketId,
      workerId,
      leaseId,
      fencingToken: fenceToken,
      remoteSessionStatus: "viewer_only",
      lastAcknowledgedStreamOffset: "stream:0",
      sessionConsistencyCheckStatus: "passed",
      workspaceSyncStatus: "aligned",
      occurredAt: now,
    });

    assert.equal(result.accepted, false);
    assert.equal(result.reasonCode, "remote_session_viewer_only");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("claimExecution rejects remote worker with session consistency mismatch", () => {
  const workspace = createTempWorkspace("aa-handshake-");
  try {
    const { db, store, handshakeService } = setupDatabase(workspace);
    const now = nowIso();
    const taskId = newId("task");
    const executionId = newId("exec");
    const workerId = "remote-worker-mismatch";
    const ticketId = newId("ticket");

    createTaskAndExecution(store, taskId, executionId);
    const { leaseId, fenceToken } = createWorkerAndLease(store, workerId, taskId, executionId, ticketId, {
      placement: "remote",
      registrationVerifiedAt: now,
      fenceToken: 1,
      ticketStatus: "claimed",
    });

    const result = handshakeService.claimExecution({
      ticketId,
      workerId,
      leaseId,
      fencingToken: fenceToken,
      remoteSessionStatus: "connected",
      lastAcknowledgedStreamOffset: "stream:5",
      sessionConsistencyCheckStatus: "mismatch",
      workspaceSyncStatus: "aligned",
      occurredAt: now,
    });

    assert.equal(result.accepted, false);
    assert.equal(result.reasonCode, "remote_session_consistency_mismatch");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("claimExecution rejects remote worker with workspace sync conflict", () => {
  const workspace = createTempWorkspace("aa-handshake-");
  try {
    const { db, store, handshakeService } = setupDatabase(workspace);
    const now = nowIso();
    const taskId = newId("task");
    const executionId = newId("exec");
    const workerId = "remote-worker-sync-conflict";
    const ticketId = newId("ticket");

    createTaskAndExecution(store, taskId, executionId);
    const { leaseId, fenceToken } = createWorkerAndLease(store, workerId, taskId, executionId, ticketId, {
      placement: "remote",
      registrationVerifiedAt: now,
      fenceToken: 1,
      ticketStatus: "claimed",
    });

    const result = handshakeService.claimExecution({
      ticketId,
      workerId,
      leaseId,
      fencingToken: fenceToken,
      remoteSessionStatus: "connected",
      lastAcknowledgedStreamOffset: "stream:5",
      sessionConsistencyCheckStatus: "passed",
      workspaceSyncStatus: "conflict",
      occurredAt: now,
    });

    assert.equal(result.accepted, false);
    assert.equal(result.reasonCode, "remote_workspace_sync_conflict");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("claimExecution rejects remote worker with missing resume offset during reconnect", () => {
  const workspace = createTempWorkspace("aa-handshake-");
  try {
    const { db, store, handshakeService } = setupDatabase(workspace);
    const now = nowIso();
    const taskId = newId("task");
    const executionId = newId("exec");
    const workerId = "remote-worker-no-offset";
    const ticketId = newId("ticket");

    createTaskAndExecution(store, taskId, executionId);
    const { leaseId, fenceToken } = createWorkerAndLease(store, workerId, taskId, executionId, ticketId, {
      placement: "remote",
      registrationVerifiedAt: now,
      fenceToken: 1,
      ticketStatus: "claimed",
    });

    const result = handshakeService.claimExecution({
      ticketId,
      workerId,
      leaseId,
      fencingToken: fenceToken,
      remoteSessionStatus: "reconnecting",
      lastAcknowledgedStreamOffset: null, // Missing during reconnect
      sessionConsistencyCheckStatus: "passed",
      workspaceSyncStatus: "aligned",
      occurredAt: now,
    });

    assert.equal(result.accepted, false);
    assert.equal(result.reasonCode, "remote_session_resume_offset_missing");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

// === Record Heartbeat Tests ===

test("recordHeartbeat accepts valid heartbeat from worker with active lease", () => {
  const workspace = createTempWorkspace("aa-handshake-");
  try {
    const { db, store, handshakeService, leaseService } = setupDatabase(workspace);
    const now = nowIso();
    const taskId = newId("task");
    const executionId = newId("exec");
    const workerId = "worker-hb-1";
    const ticketId = newId("ticket");

    createTaskAndExecution(store, taskId, executionId, {
      taskStatus: "in_progress",
      executionStatus: "executing",
      startedAt: now,
    });
    const { leaseId, fenceToken } = createWorkerAndLease(store, workerId, taskId, executionId, ticketId, {
      status: "busy",
      fenceToken: 1,
      leaseStatus: "active",
      ticketStatus: "consumed",
    });

    const result = handshakeService.recordHeartbeat({
      executionId,
      workerId,
      leaseId,
      fencingToken: fenceToken,
      ttlMs: 30000,
      progressMessage: "Processing step 1",
      occurredAt: now,
    });

    assert.equal(result.accepted, true);
    assert.equal(result.reasonCode, null);
    assert.equal(result.executionId, executionId);
    assert.equal(result.leaseId, leaseId);

    // Verify heartbeat was recorded
    const snapshots = store.listHeartbeatSnapshotsByExecution(executionId);
    assert.ok(snapshots.length >= 1);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("recordHeartbeat rejects when execution not found", () => {
  const workspace = createTempWorkspace("aa-handshake-");
  try {
    const { db, handshakeService } = setupDatabase(workspace);
    const now = nowIso();

    const result = handshakeService.recordHeartbeat({
      executionId: "nonexistent-exec",
      workerId: "worker-hb-2",
      leaseId: newId("lease"),
      fencingToken: 1,
      ttlMs: 30000,
      occurredAt: now,
    });

    assert.equal(result.accepted, false);
    assert.equal(result.reasonCode, "execution_not_found");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("recordHeartbeat rejects when worker not registered", () => {
  const workspace = createTempWorkspace("aa-handshake-");
  try {
    const { db, store, handshakeService } = setupDatabase(workspace);
    const now = nowIso();
    const taskId = newId("task");
    const executionId = newId("exec");

    createTaskAndExecution(store, taskId, executionId, {
      taskStatus: "in_progress",
      executionStatus: "executing",
    });

    const result = handshakeService.recordHeartbeat({
      executionId,
      workerId: "unregistered-worker",
      leaseId: newId("lease"),
      fencingToken: 1,
      ttlMs: 30000,
      occurredAt: now,
    });

    assert.equal(result.accepted, false);
    assert.equal(result.reasonCode, "worker_not_registered");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("recordHeartbeat rejects with stale fencing token", () => {
  const workspace = createTempWorkspace("aa-handshake-");
  try {
    const { db, store, handshakeService } = setupDatabase(workspace);
    const now = nowIso();
    const taskId = newId("task");
    const executionId = newId("exec");
    const workerId = "worker-hb-4";
    const ticketId = newId("ticket");

    createTaskAndExecution(store, taskId, executionId, {
      taskStatus: "in_progress",
      executionStatus: "executing",
    });
    const { leaseId, fenceToken } = createWorkerAndLease(store, workerId, taskId, executionId, ticketId, {
      fenceToken: 10,
      leaseStatus: "active",
    });

    const result = handshakeService.recordHeartbeat({
      executionId,
      workerId,
      leaseId,
      fencingToken: 5, // Stale token
      ttlMs: 30000,
      occurredAt: now,
    });

    assert.equal(result.accepted, false);
    assert.equal(result.reasonCode, "stale_fencing_token");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("recordHeartbeat rejects when lease is expired", () => {
  const workspace = createTempWorkspace("aa-handshake-");
  try {
    const { db, store, handshakeService } = setupDatabase(workspace);
    const now = nowIso();
    const taskId = newId("task");
    const executionId = newId("exec");
    const workerId = "worker-hb-5";
    const ticketId = newId("ticket");

    createTaskAndExecution(store, taskId, executionId, {
      taskStatus: "in_progress",
      executionStatus: "executing",
    });
    const { leaseId, fenceToken } = createWorkerAndLease(store, workerId, taskId, executionId, ticketId, {
      fenceToken: 1,
      leaseStatus: "active",
    });

    // Manually expire the lease by setting expiresAt to the past
    db.connection
      .prepare("UPDATE execution_leases SET expires_at = ? WHERE id = ?")
      .run(new Date(Date.parse(now) - 60000).toISOString(), leaseId);

    const result = handshakeService.recordHeartbeat({
      executionId,
      workerId,
      leaseId,
      fencingToken: fenceToken,
      ttlMs: 30000,
      occurredAt: now,
    });

    assert.equal(result.accepted, false);
    assert.equal(result.reasonCode, "lease_expired");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("recordHeartbeat rejects when lease not found", () => {
  const workspace = createTempWorkspace("aa-handshake-");
  try {
    const { db, store, handshakeService } = setupDatabase(workspace);
    const now = nowIso();
    const taskId = newId("task");
    const executionId = newId("exec");
    const workerId = "worker-hb-6";

    createTaskAndExecution(store, taskId, executionId, {
      taskStatus: "in_progress",
      executionStatus: "executing",
    });
    // Create worker but no lease
    store.upsertWorkerSnapshot({
      workerId,
      status: "busy",
      placement: "local",
      isolationLevel: "standard",
      repoVersion: null,
      remoteSessionStatus: null,
      lastAcknowledgedStreamOffset: null,
      streamResumeSuccessRate: null,
      credentialRefreshSuccessRate: null,
      sessionConsistencyCheckStatus: null,
      sessionConsistencyCheckedAt: null,
      workspaceSyncStatus: null,
      workspaceSyncCheckedAt: null,
      saturation: null,
      activeLeaseCount: 0,
      meanStartupLatencyMs: null,
      sandboxSuccessRate: null,
      repoCacheHitRate: null,
      registrationVerifiedAt: null,
      registrationChallengeId: null,
      capabilitiesJson: "[]",
      runningExecutionsJson: "[]",
      maxConcurrency: 10,
      queueAffinity: null,
      runtimeInstanceId: null,
      restartedFromRuntimeInstanceId: null,
      restartGeneration: 0,
      cpuPct: null,
      memoryMb: null,
      toolBacklogCount: 0,
      currentStepId: null,
      lastProgressAt: null,
      lastHeartbeatAt: now,
      updatedAt: now,
    });

    const result = handshakeService.recordHeartbeat({
      executionId,
      workerId,
      leaseId: "nonexistent-lease",
      fencingToken: 1,
      ttlMs: 30000,
      occurredAt: now,
    });

    assert.equal(result.accepted, false);
    assert.equal(result.reasonCode, "lease_not_found");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("recordHeartbeat rejects remote worker with viewer_only session", () => {
  const workspace = createTempWorkspace("aa-handshake-");
  try {
    const { db, store, handshakeService } = setupDatabase(workspace);
    const now = nowIso();
    const taskId = newId("task");
    const executionId = newId("exec");
    const workerId = "remote-worker-hb";
    const ticketId = newId("ticket");

    createTaskAndExecution(store, taskId, executionId, {
      taskStatus: "in_progress",
      executionStatus: "executing",
    });
    const { leaseId, fenceToken } = createWorkerAndLease(store, workerId, taskId, executionId, ticketId, {
      placement: "remote",
      registrationVerifiedAt: now,
      fenceToken: 1,
      leaseStatus: "active",
    });

    const result = handshakeService.recordHeartbeat({
      executionId,
      workerId,
      leaseId,
      fencingToken: fenceToken,
      ttlMs: 30000,
      remoteSessionStatus: "viewer_only",
      lastAcknowledgedStreamOffset: "stream:0",
      sessionConsistencyCheckStatus: "passed",
      workspaceSyncStatus: "aligned",
      occurredAt: now,
    });

    assert.equal(result.accepted, false);
    assert.equal(result.reasonCode, "remote_session_viewer_only");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("recordHeartbeat records telemetry data on successful heartbeat", () => {
  const workspace = createTempWorkspace("aa-handshake-");
  try {
    const { db, store, handshakeService } = setupDatabase(workspace);
    const now = nowIso();
    const taskId = newId("task");
    const executionId = newId("exec");
    const workerId = "worker-hb-telemetry";
    const ticketId = newId("ticket");

    createTaskAndExecution(store, taskId, executionId, {
      taskStatus: "in_progress",
      executionStatus: "executing",
      startedAt: now,
    });
    const { leaseId, fenceToken } = createWorkerAndLease(store, workerId, taskId, executionId, ticketId, {
      status: "busy",
      fenceToken: 1,
      leaseStatus: "active",
    });

    const result = handshakeService.recordHeartbeat({
      executionId,
      workerId,
      leaseId,
      fencingToken: fenceToken,
      ttlMs: 30000,
      progressMessage: "Working on step 2",
      cpuPct: 45.5,
      memoryMb: 512,
      toolCallCount: 25,
      currentStepId: "step-2",
      saturation: 0.5,
      occurredAt: now,
    });

    assert.equal(result.accepted, true);
    assert.equal(result.reasonCode, null);

    // Verify heartbeat snapshot was recorded with telemetry
    const snapshots = store.listHeartbeatSnapshotsByExecution(executionId);
    assert.ok(snapshots.length >= 1);
    const latestSnapshot = snapshots[0]!;
    assert.equal(latestSnapshot.cpuPct, 45.5);
    assert.equal(latestSnapshot.memoryMb, 512);

    // Verify agent execution record was updated
    const agentExec = store.getAgentExecutionRecord(executionId);
    assert.ok(agentExec);
    assert.equal(agentExec?.toolCallCount, 25);
    assert.equal(agentExec?.currentStepId, "step-2");
    assert.equal(agentExec?.progressMessage, "Working on step 2");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("recordHeartbeat renews lease TTL on success", () => {
  const workspace = createTempWorkspace("aa-handshake-");
  try {
    const { db, store, handshakeService } = setupDatabase(workspace);
    const now = nowIso();
    const taskId = newId("task");
    const executionId = newId("exec");
    const workerId = "worker-hb-renew";
    const ticketId = newId("ticket");

    createTaskAndExecution(store, taskId, executionId, {
      taskStatus: "in_progress",
      executionStatus: "executing",
    });
    const { leaseId, fenceToken } = createWorkerAndLease(store, workerId, taskId, executionId, ticketId, {
      fenceToken: 1,
      leaseStatus: "active",
    });

    // Get original expiresAt
    const originalLease = store.getExecutionLease(leaseId);
    const originalExpiresAt = originalLease?.expiresAt;

    // Wait a tiny bit and send heartbeat with new TTL
    const afterDelay = plusMs(now, 100);
    const result = handshakeService.recordHeartbeat({
      executionId,
      workerId,
      leaseId,
      fencingToken: fenceToken,
      ttlMs: 60000, // New 60 second TTL
      occurredAt: afterDelay,
    });

    assert.equal(result.accepted, true);

    // Verify lease was renewed with new expiration
    const renewedLease = store.getExecutionLease(leaseId);
    assert.ok(renewedLease);
    assert.ok(Date.parse(renewedLease.expiresAt) > Date.parse(originalExpiresAt!));

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("recordHeartbeat rejects worker mismatch (different worker owns lease)", () => {
  const workspace = createTempWorkspace("aa-handshake-");
  try {
    const { db, store, handshakeService } = setupDatabase(workspace);
    const now = nowIso();
    const taskId = newId("task");
    const executionId = newId("exec");
    const workerId = "worker-owner";
    const differentWorkerId = "worker-other";
    const ticketId = newId("ticket");

    createTaskAndExecution(store, taskId, executionId, {
      taskStatus: "in_progress",
      executionStatus: "executing",
    });
    const { leaseId, fenceToken } = createWorkerAndLease(store, workerId, taskId, executionId, ticketId, {
      fenceToken: 1,
      leaseStatus: "active",
    });

    // Register the different worker so it's recognized but doesn't own the lease
    store.upsertWorkerSnapshot({
      workerId: differentWorkerId,
      status: "idle",
      placement: "local",
      isolationLevel: "standard",
      repoVersion: null,
      remoteSessionStatus: null,
      lastAcknowledgedStreamOffset: null,
      streamResumeSuccessRate: null,
      credentialRefreshSuccessRate: null,
      sessionConsistencyCheckStatus: null,
      sessionConsistencyCheckedAt: null,
      workspaceSyncStatus: null,
      workspaceSyncCheckedAt: null,
      saturation: null,
      activeLeaseCount: 0,
      meanStartupLatencyMs: null,
      sandboxSuccessRate: null,
      repoCacheHitRate: null,
      registrationVerifiedAt: null,
      registrationChallengeId: null,
      capabilitiesJson: "[]",
      runningExecutionsJson: "[]",
      maxConcurrency: 10,
      queueAffinity: null,
      runtimeInstanceId: null,
      restartedFromRuntimeInstanceId: null,
      restartGeneration: 0,
      cpuPct: null,
      memoryMb: null,
      toolBacklogCount: 0,
      currentStepId: null,
      lastProgressAt: null,
      lastHeartbeatAt: now,
      updatedAt: now,
    });

    const result = handshakeService.recordHeartbeat({
      executionId,
      workerId: differentWorkerId, // Different worker trying to heartbeat
      leaseId,
      fencingToken: fenceToken,
      ttlMs: 30000,
      occurredAt: now,
    });

    assert.equal(result.accepted, false);
    assert.equal(result.reasonCode, "worker_mismatch");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

// === Handshake Event Recording Tests ===

test("claimExecution records claim_accepted event on success", () => {
  const workspace = createTempWorkspace("aa-handshake-");
  try {
    const { db, store, handshakeService } = setupDatabase(workspace);
    const now = nowIso();
    const taskId = newId("task");
    const executionId = newId("exec");
    const workerId = "worker-event-1";
    const ticketId = newId("ticket");

    createTaskAndExecution(store, taskId, executionId, {
      taskStatus: "in_progress",
      executionStatus: "created",
    });
    const { leaseId, fenceToken } = createWorkerAndLease(store, workerId, taskId, executionId, ticketId, {
      fenceToken: 1,
      ticketStatus: "claimed",
    });

    handshakeService.claimExecution({
      ticketId,
      workerId,
      leaseId,
      fencingToken: fenceToken,
      occurredAt: now,
    });

    // Verify event was recorded
    const events = store.listEventsForTask(taskId);
    const claimEvent = events.find((e) => e.eventType === "worker:claim_accepted");
    assert.ok(claimEvent, "Expected worker:claim_accepted event to be recorded");

    const payload = JSON.parse(claimEvent!.payloadJson);
    assert.equal(payload.ticketId, ticketId);
    assert.equal(payload.workerId, workerId);
    assert.equal(payload.leaseId, leaseId);
    assert.equal(payload.fencingToken, fenceToken);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("claimExecution records claim_rejected event on failure", () => {
  const workspace = createTempWorkspace("aa-handshake-");
  try {
    const { db, store, handshakeService } = setupDatabase(workspace);
    const now = nowIso();
    const taskId = newId("task");
    const executionId = newId("exec");
    const workerId = "unregistered-worker";
    const ticketId = newId("ticket");

    createTaskAndExecution(store, taskId, executionId);

    // Create ticket assigned to unregistered worker - this will trigger worker_not_registered rejection
    const now2 = nowIso();
    store.insertExecutionTicket({
      id: ticketId,
      executionId,
      taskId,
      priority: "normal",
      queueName: null,
      dispatchTarget: null,
      requiredIsolationLevel: null,
      requiredRepoVersion: null,
      requiredCapabilitiesJson: "[]",
      dispatchAfter: null,
      attempt: 1,
      status: "claimed",
      assignedWorkerId: workerId,
      leaseId: newId("lease"),
      claimedAt: now2,
      consumedAt: null,
      invalidatedAt: null,
      createdAt: now2,
      updatedAt: now2,
    });

    handshakeService.claimExecution({
      ticketId,
      workerId,
      leaseId: newId("lease"),
      fencingToken: 1,
      occurredAt: now,
    });

    // Verify rejection event was recorded
    const events = store.listEventsForTask(taskId);
    const rejectEvent = events.find((e) => e.eventType === "worker:claim_rejected");
    assert.ok(rejectEvent, "Expected worker:claim_rejected event to be recorded");

    const payload = JSON.parse(rejectEvent!.payloadJson);
    assert.equal(payload.reasonCode, "worker_not_registered");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("recordHeartbeat records heartbeat_recorded event on success", () => {
  const workspace = createTempWorkspace("aa-handshake-");
  try {
    const { db, store, handshakeService } = setupDatabase(workspace);
    const now = nowIso();
    const taskId = newId("task");
    const executionId = newId("exec");
    const workerId = "worker-event-3";
    const ticketId = newId("ticket");

    createTaskAndExecution(store, taskId, executionId, {
      taskStatus: "in_progress",
      executionStatus: "executing",
    });
    const { leaseId, fenceToken } = createWorkerAndLease(store, workerId, taskId, executionId, ticketId, {
      fenceToken: 1,
      leaseStatus: "active",
    });

    handshakeService.recordHeartbeat({
      executionId,
      workerId,
      leaseId,
      fencingToken: fenceToken,
      ttlMs: 30000,
      occurredAt: now,
    });

    // Verify event was recorded
    const events = store.listEventsForTask(taskId);
    const heartbeatEvent = events.find((e) => e.eventType === "worker:heartbeat_recorded");
    assert.ok(heartbeatEvent, "Expected worker:heartbeat_recorded event to be recorded");

    const payload = JSON.parse(heartbeatEvent!.payloadJson);
    assert.equal(payload.workerId, workerId);
    assert.equal(payload.leaseId, leaseId);
    assert.equal(payload.fencingToken, fenceToken);
    assert.equal(payload.ttlMs, 30000);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

// === Ticket Status Transition Tests ===

test("claimExecution transitions execution from created to executing", () => {
  const workspace = createTempWorkspace("aa-handshake-");
  try {
    const { db, store, handshakeService } = setupDatabase(workspace);
    const now = nowIso();
    const taskId = newId("task");
    const executionId = newId("exec");
    const workerId = "worker-status-1";
    const ticketId = newId("ticket");

    createTaskAndExecution(store, taskId, executionId, {
      taskStatus: "in_progress",
      executionStatus: "created",
    });
    const { leaseId, fenceToken } = createWorkerAndLease(store, workerId, taskId, executionId, ticketId, {
      fenceToken: 1,
      ticketStatus: "claimed",
    });

    const result = handshakeService.claimExecution({
      ticketId,
      workerId,
      leaseId,
      fencingToken: fenceToken,
      occurredAt: now,
    });

    assert.equal(result.accepted, true);

    // Verify execution status changed
    const execution = store.getExecution(executionId);
    assert.equal(execution?.status, "executing");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("claimExecution does not re-transition execution that is already executing", () => {
  const workspace = createTempWorkspace("aa-handshake-");
  try {
    const { db, store, handshakeService } = setupDatabase(workspace);
    const now = nowIso();
    const taskId = newId("task");
    const executionId = newId("exec");
    const workerId = "worker-status-2";
    const ticketId = newId("ticket");

    createTaskAndExecution(store, taskId, executionId, {
      taskStatus: "in_progress",
      executionStatus: "executing", // Already executing
    });
    const { leaseId, fenceToken } = createWorkerAndLease(store, workerId, taskId, executionId, ticketId, {
      fenceToken: 1,
      ticketStatus: "claimed",
    });

    const result = handshakeService.claimExecution({
      ticketId,
      workerId,
      leaseId,
      fencingToken: fenceToken,
      occurredAt: now,
    });

    assert.equal(result.accepted, true);

    // Verify execution status is still executing (not changed)
    const execution = store.getExecution(executionId);
    assert.equal(execution?.status, "executing");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("claimExecution marks ticket as consumed after successful claim", () => {
  const workspace = createTempWorkspace("aa-handshake-");
  try {
    const { db, store, handshakeService } = setupDatabase(workspace);
    const now = nowIso();
    const taskId = newId("task");
    const executionId = newId("exec");
    const workerId = "worker-consume";
    const ticketId = newId("ticket");

    createTaskAndExecution(store, taskId, executionId, {
      taskStatus: "in_progress",
      executionStatus: "created",
    });
    const { leaseId, fenceToken } = createWorkerAndLease(store, workerId, taskId, executionId, ticketId, {
      fenceToken: 1,
      ticketStatus: "claimed",
    });

    handshakeService.claimExecution({
      ticketId,
      workerId,
      leaseId,
      fencingToken: fenceToken,
      occurredAt: now,
    });

    // Verify ticket was consumed
    const ticket = store.getExecutionTicket(ticketId);
    assert.equal(ticket?.status, "consumed");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

// === Remote Session Handling Tests ===

test("claimExecution accepts healthy remote worker with all checks passing", () => {
  const workspace = createTempWorkspace("aa-handshake-");
  try {
    const { db, store, handshakeService } = setupDatabase(workspace);
    const now = nowIso();
    const taskId = newId("task");
    const executionId = newId("exec");
    const workerId = "remote-worker-healthy";
    const ticketId = newId("ticket");

    createTaskAndExecution(store, taskId, executionId, {
      taskStatus: "in_progress",
      executionStatus: "created",
    });
    const { leaseId, fenceToken } = createWorkerAndLease(store, workerId, taskId, executionId, ticketId, {
      placement: "remote",
      registrationVerifiedAt: now,
      fenceToken: 1,
      ticketStatus: "claimed",
    });

    const result = handshakeService.claimExecution({
      ticketId,
      workerId,
      leaseId,
      fencingToken: fenceToken,
      remoteSessionStatus: "connected",
      lastAcknowledgedStreamOffset: "stream:10",
      sessionConsistencyCheckStatus: "passed",
      workspaceSyncStatus: "aligned",
      occurredAt: now,
    });

    // All checks pass for a healthy remote worker - claim should succeed
    assert.equal(result.accepted, true);
    assert.equal(result.reasonCode, null);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("recordHeartbeat handles remote session degraded status gracefully", () => {
  const workspace = createTempWorkspace("aa-handshake-");
  try {
    const { db, store, handshakeService } = setupDatabase(workspace);
    const now = nowIso();
    const taskId = newId("task");
    const executionId = newId("exec");
    const workerId = "remote-worker-degraded";
    const ticketId = newId("ticket");

    createTaskAndExecution(store, taskId, executionId, {
      taskStatus: "in_progress",
      executionStatus: "executing",
    });
    const { leaseId, fenceToken } = createWorkerAndLease(store, workerId, taskId, executionId, ticketId, {
      placement: "remote",
      registrationVerifiedAt: now,
      fenceToken: 1,
      leaseStatus: "active",
    });

    // Degraded status should still be acceptable
    const result = handshakeService.recordHeartbeat({
      executionId,
      workerId,
      leaseId,
      fencingToken: fenceToken,
      ttlMs: 30000,
      remoteSessionStatus: "degraded",
      lastAcknowledgedStreamOffset: "stream:10",
      sessionConsistencyCheckStatus: "passed",
      workspaceSyncStatus: "aligned",
      occurredAt: now,
    });

    assert.equal(result.accepted, true);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

// === Worker Snapshot Update Tests ===

test("claimExecution updates worker snapshot with running execution", () => {
  const workspace = createTempWorkspace("aa-handshake-");
  try {
    const { db, store, handshakeService } = setupDatabase(workspace);
    const now = nowIso();
    const taskId = newId("task");
    const executionId = newId("exec");
    const workerId = "worker-snapshot";
    const ticketId = newId("ticket");

    createTaskAndExecution(store, taskId, executionId, {
      taskStatus: "in_progress",
      executionStatus: "created",
    });
    const { leaseId, fenceToken } = createWorkerAndLease(store, workerId, taskId, executionId, ticketId, {
      status: "idle",
      fenceToken: 1,
      ticketStatus: "claimed",
    });

    handshakeService.claimExecution({
      ticketId,
      workerId,
      leaseId,
      fencingToken: fenceToken,
      progressMessage: "Starting work",
      occurredAt: now,
    });

    // Verify worker snapshot was updated
    const worker = store.getWorkerSnapshot(workerId);
    assert.ok(worker);
    assert.equal(worker?.status, "busy");
    const runningExecs = JSON.parse(worker?.runningExecutionsJson ?? "[]");
    assert.ok(runningExecs.includes(executionId), "Expected executionId in worker's running executions");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("recordHeartbeat updates worker telemetry", () => {
  const workspace = createTempWorkspace("aa-handshake-");
  try {
    const { db, store, handshakeService } = setupDatabase(workspace);
    const now = nowIso();
    const taskId = newId("task");
    const executionId = newId("exec");
    const workerId = "worker-telemetry";
    const ticketId = newId("ticket");

    createTaskAndExecution(store, taskId, executionId, {
      taskStatus: "in_progress",
      executionStatus: "executing",
    });
    const { leaseId, fenceToken } = createWorkerAndLease(store, workerId, taskId, executionId, ticketId, {
      status: "busy",
      fenceToken: 1,
      leaseStatus: "active",
    });

    handshakeService.recordHeartbeat({
      executionId,
      workerId,
      leaseId,
      fencingToken: fenceToken,
      ttlMs: 30000,
      cpuPct: 75.0,
      memoryMb: 1024,
      saturation: 0.8,
      progressMessage: "Heavy processing",
      occurredAt: now,
    });

    // Verify worker snapshot was updated with new telemetry
    const worker = store.getWorkerSnapshot(workerId);
    assert.ok(worker);
    assert.equal(worker?.cpuPct, 75.0);
    assert.equal(worker?.memoryMb, 1024);
    assert.equal(worker?.saturation, 0.8);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

// === Remote Logs Tests ===

test("claimExecution persists remote logs when provided", () => {
  const workspace = createTempWorkspace("aa-handshake-");
  try {
    const { db, store, handshakeService } = setupDatabase(workspace);
    const now = nowIso();
    const taskId = newId("task");
    const executionId = newId("exec");
    const workerId = "worker-logs";
    const ticketId = newId("ticket");

    createTaskAndExecution(store, taskId, executionId, {
      taskStatus: "in_progress",
      executionStatus: "created",
    });
    const { leaseId, fenceToken } = createWorkerAndLease(store, workerId, taskId, executionId, ticketId, {
      fenceToken: 1,
      ticketStatus: "claimed",
    });

    handshakeService.claimExecution({
      ticketId,
      workerId,
      leaseId,
      fencingToken: fenceToken,
      remoteLogs: [
        { level: "info", message: "Worker started", occurredAt: now },
        { level: "debug", message: "Loading tools", context: { toolCount: 5 }, occurredAt: now },
      ],
      occurredAt: now,
    });

    // Verify remote logs were persisted
    const logs = store.listRemoteLogsByTask(taskId);
    assert.ok(logs.length >= 2, "Expected at least 2 remote log entries");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("recordHeartbeat persists remote logs when provided", () => {
  const workspace = createTempWorkspace("aa-handshake-");
  try {
    const { db, store, handshakeService } = setupDatabase(workspace);
    const now = nowIso();
    const taskId = newId("task");
    const executionId = newId("exec");
    const workerId = "worker-logs-hb";
    const ticketId = newId("ticket");

    createTaskAndExecution(store, taskId, executionId, {
      taskStatus: "in_progress",
      executionStatus: "executing",
    });
    const { leaseId, fenceToken } = createWorkerAndLease(store, workerId, taskId, executionId, ticketId, {
      fenceToken: 1,
      leaseStatus: "active",
    });

    handshakeService.recordHeartbeat({
      executionId,
      workerId,
      leaseId,
      fencingToken: fenceToken,
      ttlMs: 30000,
      remoteLogs: [
        { level: "warn", message: "High memory usage", context: { memoryMb: 2048 }, occurredAt: now },
      ],
      occurredAt: now,
    });

    // Verify remote logs were persisted
    const logs = store.listRemoteLogsByTask(taskId);
    assert.ok(logs.length >= 1, "Expected at least 1 remote log entry");
    const firstLog = logs[0]!;
    assert.equal(firstLog.level, "warn");
    assert.equal(firstLog.message, "High memory usage");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

// === Agent Execution Record Tests ===

test("claimExecution creates agent execution record on success", () => {
  const workspace = createTempWorkspace("aa-handshake-");
  try {
    const { db, store, handshakeService } = setupDatabase(workspace);
    const now = nowIso();
    const taskId = newId("task");
    const executionId = newId("exec");
    const workerId = "worker-agent-record";
    const ticketId = newId("ticket");

    createTaskAndExecution(store, taskId, executionId, {
      taskStatus: "in_progress",
      executionStatus: "created",
    });
    const { leaseId, fenceToken } = createWorkerAndLease(store, workerId, taskId, executionId, ticketId, {
      fenceToken: 1,
      ticketStatus: "claimed",
    });

    handshakeService.claimExecution({
      ticketId,
      workerId,
      leaseId,
      fencingToken: fenceToken,
      toolCallCount: 10,
      currentStepId: "step-1",
      progressMessage: "Initializing",
      occurredAt: now,
    });

    // Verify agent execution record was created
    const agentExec = store.getAgentExecutionRecord(executionId);
    assert.ok(agentExec, "Expected agent execution record to be created");
    assert.equal(agentExec?.agentId, workerId);
    assert.equal(agentExec?.executionId, executionId);
    assert.equal(agentExec?.toolCallCount, 10);
    assert.equal(agentExec?.currentStepId, "step-1");
    assert.equal(agentExec?.progressMessage, "Initializing");
    assert.ok(agentExec?.startedAt, "Expected startedAt to be set");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("recordHeartbeat updates existing agent execution record", () => {
  const workspace = createTempWorkspace("aa-handshake-");
  try {
    const { db, store, handshakeService } = setupDatabase(workspace);
    const now = nowIso();
    const taskId = newId("task");
    const executionId = newId("exec");
    const workerId = "worker-agent-update";
    const ticketId = newId("ticket");

    createTaskAndExecution(store, taskId, executionId, {
      taskStatus: "in_progress",
      executionStatus: "executing",
    });
    const { leaseId, fenceToken } = createWorkerAndLease(store, workerId, taskId, executionId, ticketId, {
      fenceToken: 1,
      leaseStatus: "active",
    });

    // First heartbeat
    handshakeService.recordHeartbeat({
      executionId,
      workerId,
      leaseId,
      fencingToken: fenceToken,
      ttlMs: 30000,
      toolCallCount: 5,
      currentStepId: "step-1",
      progressMessage: "Step 1 complete",
      occurredAt: now,
    });

    // Second heartbeat with updates (same fencing token since it doesn't change on heartbeat)
    const later = plusMs(now, 5000);
    handshakeService.recordHeartbeat({
      executionId,
      workerId,
      leaseId,
      fencingToken: fenceToken,
      ttlMs: 30000,
      toolCallCount: 15,
      currentStepId: "step-2",
      progressMessage: "Step 2 complete",
      occurredAt: later,
    });

    // Verify agent execution record was updated
    const agentExec = store.getAgentExecutionRecord(executionId);
    assert.ok(agentExec);
    assert.equal(agentExec?.toolCallCount, 15);
    assert.equal(agentExec?.currentStepId, "step-2");
    assert.equal(agentExec?.progressMessage, "Step 2 complete");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});
