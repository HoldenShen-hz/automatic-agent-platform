import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { WorkerRepository } from "../../../../../../../src/platform/five-plane-state-evidence/truth/sqlite/repositories/worker-repository.js";
import { SqliteDatabase } from "../../../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../../../../helpers/fs.js";

function createMockConnection() {
  return {
    prepare: () => ({
      run: () => ({ changes: 1 }),
      get: () => undefined,
      all: () => [],
    }),
  } as const;
}

test("WorkerRepository exposes the current worker, ticket, and lease surface", () => {
  const repo = new WorkerRepository(createMockConnection() as never);

  assert.equal(typeof repo.insertHeartbeatSnapshot, "function");
  assert.equal(typeof repo.upsertWorkerSnapshot, "function");
  assert.equal(typeof repo.upsertCoordinatorInstanceSnapshot, "function");
  assert.equal(typeof repo.getWorkerSnapshot, "function");
  assert.equal(typeof repo.listWorkerSnapshots, "function");
  assert.equal(typeof repo.listStaleWorkerSnapshots, "function");
  assert.equal(typeof repo.getCoordinatorInstanceSnapshot, "function");
  assert.equal(typeof repo.listCoordinatorInstanceSnapshots, "function");
  assert.equal(typeof repo.listHeartbeatSnapshotsByExecution, "function");

  assert.equal(typeof repo.insertRemoteLog, "function");
  assert.equal(typeof repo.listRemoteLogsByTask, "function");
  assert.equal(typeof repo.listRemoteLogsByExecution, "function");
  assert.equal(typeof repo.upsertAgentExecutionRecord, "function");
  assert.equal(typeof repo.getAgentExecutionRecord, "function");
  assert.equal(typeof repo.listAgentExecutionRecordsByTask, "function");

  assert.equal(typeof repo.insertWorkerRegistrationChallenge, "function");
  assert.equal(typeof repo.getWorkerRegistrationChallenge, "function");
  assert.equal(typeof repo.consumeWorkerRegistrationChallenge, "function");
  assert.equal(typeof repo.insertExecutionTicket, "function");
  assert.equal(typeof repo.claimExecutionTicket, "function");
  assert.equal(typeof repo.consumeExecutionTicket, "function");
  assert.equal(typeof repo.invalidateExecutionTicket, "function");
  assert.equal(typeof repo.listPendingExecutionTickets, "function");
  assert.equal(typeof repo.getExecutionTicket, "function");
  assert.equal(typeof repo.getActiveExecutionTicket, "function");
  assert.equal(typeof repo.listExecutionTicketsByExecution, "function");
  assert.equal(typeof repo.listExecutionTicketsByStatuses, "function");
  assert.equal(typeof repo.listDispatchableExecutionTickets, "function");

  assert.equal(typeof repo.insertExecutionLease, "function");
  assert.equal(typeof repo.renewExecutionLease, "function");
  assert.equal(typeof repo.closeExecutionLease, "function");
  assert.equal(typeof repo.insertLeaseAudit, "function");
  assert.equal(typeof repo.getExecutionLease, "function");
  assert.equal(typeof repo.getActiveExecutionLease, "function");
  assert.equal(typeof repo.getLatestExecutionLease, "function");
  assert.equal(typeof repo.listExecutionLeases, "function");
  assert.equal(typeof repo.listLeasesByWorker, "function");
  assert.equal(typeof repo.listExecutionLeasesByStatuses, "function");
  assert.equal(typeof repo.listExpiredExecutionLeases, "function");
  assert.equal(typeof repo.getLatestFencingToken, "function");
});

test("WorkerRepository read methods tolerate empty results", () => {
  const repo = new WorkerRepository(createMockConnection() as never);

  assert.equal(repo.getWorkerSnapshot("missing"), undefined);
  assert.equal(repo.getCoordinatorInstanceSnapshot("missing"), undefined);
  assert.equal(repo.getAgentExecutionRecord("missing", null), undefined);
  assert.equal(repo.getWorkerRegistrationChallenge("missing"), undefined);
  assert.equal(repo.getExecutionTicket("missing"), undefined);
  assert.equal(repo.getActiveExecutionTicket("missing", 1), undefined);
  assert.equal(repo.getExecutionLease("missing"), undefined);
  assert.equal(repo.getActiveExecutionLease("missing"), undefined);
  assert.equal(repo.getLatestExecutionLease("missing"), undefined);
  assert.equal(repo.getLatestFencingToken("missing"), 0);

  assert.deepEqual(repo.listWorkerSnapshots(), []);
  assert.deepEqual(repo.listStaleWorkerSnapshots("2026-04-01T00:00:00.000Z"), []);
  assert.deepEqual(repo.listCoordinatorInstanceSnapshots(), []);
  assert.deepEqual(repo.listHeartbeatSnapshotsByExecution("exec-1"), []);
  assert.deepEqual(repo.listRemoteLogsByTask("task-1"), []);
  assert.deepEqual(repo.listRemoteLogsByExecution("exec-1"), []);
  assert.deepEqual(repo.listAgentExecutionRecordsByTask("task-1", null), []);
  assert.deepEqual(repo.listPendingExecutionTickets(), []);
  assert.deepEqual(repo.listExecutionTicketsByExecution("exec-1"), []);
  assert.deepEqual(repo.listExecutionTicketsByStatuses(["pending", "claimed"]), []);
  assert.deepEqual(repo.listDispatchableExecutionTickets("2026-04-27T10:00:00.000Z", "default"), []);
  assert.deepEqual(repo.listExecutionLeases("exec-1"), []);
  assert.deepEqual(repo.listLeasesByWorker("worker-1"), []);
  assert.deepEqual(repo.listExecutionLeasesByStatuses(["active"]), []);
  assert.deepEqual(repo.listExpiredExecutionLeases("2026-04-27T10:00:00.000Z"), []);
});

test("WorkerRepository integration persists current worker snapshot contract", () => {
  const workspace = createTempWorkspace("worker-repo-integration-");
  const dbPath = join(workspace, "worker-integration.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new WorkerRepository(db.connection);
    const now = "2026-04-27T10:00:00.000Z";

    repo.upsertWorkerSnapshot({
      workerId: "integration-worker-001",
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
      serviceIdentity: null,
      mtlsPeerFingerprint: null,
      allowedNodeRunTenants: null,
      capabilitiesJson: "[]",
      runningExecutionsJson: "[]",
      maxConcurrency: 1,
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
      version: 1,
    });

    const workerSnapshot = repo.getWorkerSnapshot("integration-worker-001");
    assert.ok(workerSnapshot);
    assert.equal(workerSnapshot.workerId, "integration-worker-001");
    assert.equal(workerSnapshot.status, "idle");
  } finally {
    cleanupPath(workspace);
  }
});
