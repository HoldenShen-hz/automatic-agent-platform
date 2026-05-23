import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { SqliteDatabase } from "../../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { SqliteAsyncAdapter } from "../../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-async-adapter.js";
import { AsyncWorkerRepository } from "../../../../../../src/platform/five-plane-state-evidence/truth/async-repositories/worker-repository.js";
import { AsyncTaskRepository } from "../../../../../../src/platform/five-plane-state-evidence/truth/async-repositories/task-repository.js";
import { AsyncExecutionRepository } from "../../../../../../src/platform/five-plane-state-evidence/truth/async-repositories/execution-repository.js";
import { createTempWorkspace, cleanupPath } from "../../../../../helpers/fs.js";
import type {
  TaskRecord,
  ExecutionRecord,
  ExecutionTicketRecord,
  ExecutionLeaseRecord,
  HeartbeatSnapshotRecord,
  WorkerSnapshotRecord,
} from "../../../../../../src/platform/contracts/types/domain.js";

test.describe("AsyncWorkerRepository", () => {
  let harness: {
    workspace: string;
    dbPath: string;
    db: SqliteDatabase;
    adapter: SqliteAsyncAdapter;
    workerRepo: AsyncWorkerRepository;
    taskRepo: AsyncTaskRepository;
    executionRepo: AsyncExecutionRepository;
    cleanup: () => void;
  };

  test.beforeEach(async () => {
    const workspace = createTempWorkspace("aa-async-worker-repo-");
    const dbPath = join(workspace, "worker-repo.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const adapter = new SqliteAsyncAdapter(db);
    const workerRepo = new AsyncWorkerRepository(adapter.asyncConnection);
    const taskRepo = new AsyncTaskRepository(adapter.asyncConnection);
    const executionRepo = new AsyncExecutionRepository(adapter.asyncConnection);

    harness = {
      workspace,
      dbPath,
      db,
      adapter,
      workerRepo,
      taskRepo,
      executionRepo,
      cleanup() {
        db.close();
        cleanupPath(workspace);
      },
    };
  });

  test.afterEach(() => {
    harness.cleanup();
  });

  async function insertTestTask(taskId: string, tenantId: string): Promise<void> {
    const task: TaskRecord = {
      id: taskId,
      parentId: null,
      rootId: taskId,
      divisionId: "general_ops",
      tenantId,
      title: "Test Task",
      status: "queued",
      source: "user",
      priority: "normal",
      inputJson: "{}",
      normalizedInputJson: "{}",
      outputJson: null,
      estimatedCostUsd: 0,
      actualCostUsd: 0,
      errorCode: null,
      createdAt: "2026-04-23T10:00:00.000Z",
      updatedAt: "2026-04-23T10:00:00.000Z",
      completedAt: null,
    };
    await harness.taskRepo.insertTask(task);
  }

  async function insertTestExecution(executionId: string, taskId: string, tenantId: string): Promise<void> {
    await insertTestTask(taskId, tenantId);
    const execution: ExecutionRecord = {
      id: executionId,
      taskId,
      workflowId: "single_agent_minimal",
      parentExecutionId: null,
      harnessRunId: null,
      agentId: "agent-001",
      roleId: "general_executor",
      runKind: "task_run",
      status: "created",
      inputRef: null,
      traceId: `trace-${executionId}`,
      attempt: 1,
      timeoutMs: 60000,
      budgetUsdLimit: 1,
      budgetReservationId: null,
      budgetLedgerId: null,
      requiresApproval: 0,
      sandboxMode: "workspace_write",
      allowedToolsJson: "[]",
      allowedPathsJson: "[]",
      maxRetries: 0,
      retryBackoff: "none",
      lastErrorCode: null,
      lastErrorMessage: null,
      startedAt: null,
      finishedAt: null,
      createdAt: "2026-04-23T10:00:00.000Z",
      updatedAt: "2026-04-23T10:00:00.000Z",
    };
    await harness.executionRepo.insertExecution(execution);
  }

  test("insertHeartbeatSnapshot and listHeartbeatSnapshotsByExecution roundtrip", async () => {
    await insertTestExecution("exec-hb-001", "task-hb-001", "tenant-hb");
    const snapshot: HeartbeatSnapshotRecord = {
      id: "heartbeat-001",
      executionId: "exec-hb-001",
      agentId: "agent-hb-001",
      runtimeInstanceId: "instance-001",
      restartGeneration: 0,
      status: "running",
      progressMessage: "Processing step 1",
      cpuPct: 45.5,
      memoryMb: 256,
      sampledAt: "2026-04-23T10:05:00.000Z",
    };

    await harness.workerRepo.insertHeartbeatSnapshot(snapshot);

    const listed = await harness.workerRepo.listHeartbeatSnapshotsByExecution("exec-hb-001");
    assert.equal(listed.length, 1);
    assert.equal(listed[0]!.executionId, "exec-hb-001");
    assert.equal(listed[0]!.cpuPct, 45.5);
  });

  test("upsertWorkerSnapshot and getWorkerSnapshot roundtrip", async () => {
    const snapshot: WorkerSnapshotRecord = {
      workerId: "worker-001",
      status: "busy",
      placement: "local" as const,
      isolationLevel: "standard" as const,
      repoVersion: "v1.0.0",
      remoteSessionStatus: null,
      lastAcknowledgedStreamOffset: null,
      streamResumeSuccessRate: null,
      credentialRefreshSuccessRate: null,
      sessionConsistencyCheckStatus: null,
      sessionConsistencyCheckedAt: null,
      workspaceSyncStatus: null,
      workspaceSyncCheckedAt: null,
      saturation: 0.5,
      activeLeaseCount: 2,
      meanStartupLatencyMs: 1500,
      sandboxSuccessRate: 0.98,
      repoCacheHitRate: 0.85,
      registrationVerifiedAt: null,
      registrationChallengeId: null,
      capabilitiesJson: '{"tools":["bash","edit"]}',
      runningExecutionsJson: '["exec-1","exec-2"]',
      maxConcurrency: 5,
      queueAffinity: null,
      runtimeInstanceId: "runtime-001",
      restartedFromRuntimeInstanceId: null,
      restartGeneration: 0,
      cpuPct: 30.0,
      memoryMb: 512,
      toolBacklogCount: 0,
      currentStepId: "step-5",
      lastProgressAt: "2026-04-23T10:30:00.000Z",
      lastHeartbeatAt: "2026-04-23T10:30:00.000Z",
      updatedAt: "2026-04-23T10:30:00.000Z",
      version: 1,
    };

    await harness.workerRepo.upsertWorkerSnapshot(snapshot);

    const retrieved = await harness.workerRepo.getWorkerSnapshot("worker-001");
    assert.equal(retrieved?.workerId, "worker-001");
    assert.equal(retrieved?.status, "busy");
    assert.equal(retrieved?.saturation, 0.5);
    assert.equal(retrieved?.maxConcurrency, 5);
  });

  test("upsertWorkerSnapshot updates existing record", async () => {
    const snapshot: WorkerSnapshotRecord = {
      workerId: "worker-update-001",
      status: "idle",
      placement: "local" as const,
      isolationLevel: "standard" as const,
      repoVersion: null,
      remoteSessionStatus: null,
      lastAcknowledgedStreamOffset: null,
      streamResumeSuccessRate: null,
      credentialRefreshSuccessRate: null,
      sessionConsistencyCheckStatus: null,
      sessionConsistencyCheckedAt: null,
      workspaceSyncStatus: null,
      workspaceSyncCheckedAt: null,
      saturation: 0.3,
      activeLeaseCount: 1,
      meanStartupLatencyMs: null,
      sandboxSuccessRate: null,
      repoCacheHitRate: null,
      registrationVerifiedAt: null,
      registrationChallengeId: null,
      capabilitiesJson: "[]",
      runningExecutionsJson: "[]",
      maxConcurrency: 3,
      queueAffinity: null,
      runtimeInstanceId: "runtime-update",
      restartedFromRuntimeInstanceId: null,
      restartGeneration: 0,
      cpuPct: 20.0,
      memoryMb: 256,
      toolBacklogCount: 0,
      currentStepId: null,
      lastProgressAt: null,
      lastHeartbeatAt: "2026-04-23T10:00:00.000Z",
      updatedAt: "2026-04-23T10:00:00.000Z",
      version: 1,
    };

    await harness.workerRepo.upsertWorkerSnapshot(snapshot);

    const updatedSnapshot: WorkerSnapshotRecord = {
      ...snapshot,
      saturation: 0.8,
      activeLeaseCount: 5,
      lastHeartbeatAt: "2026-04-23T11:00:00.000Z",
      updatedAt: "2026-04-23T11:00:00.000Z",
    };
    await harness.workerRepo.upsertWorkerSnapshot(updatedSnapshot);

    const retrieved = await harness.workerRepo.getWorkerSnapshot("worker-update-001");
    assert.equal(retrieved?.saturation, 0.8);
    assert.equal(retrieved?.activeLeaseCount, 5);
  });

  test("listWorkerSnapshots returns all workers when no filter", async () => {
    const workers = ["worker-list-1", "worker-list-2", "worker-list-3"];
    for (const workerId of workers) {
      await harness.workerRepo.upsertWorkerSnapshot({
        workerId,
        status: "idle",
        placement: "local" as const,
        isolationLevel: "standard" as const,
        repoVersion: null,
        remoteSessionStatus: null,
        lastAcknowledgedStreamOffset: null,
        streamResumeSuccessRate: null,
        credentialRefreshSuccessRate: null,
        sessionConsistencyCheckStatus: null,
        sessionConsistencyCheckedAt: null,
        workspaceSyncStatus: null,
        workspaceSyncCheckedAt: null,
        saturation: 0.5,
        activeLeaseCount: 1,
        meanStartupLatencyMs: null,
        sandboxSuccessRate: null,
        repoCacheHitRate: null,
        registrationVerifiedAt: null,
        registrationChallengeId: null,
        capabilitiesJson: "[]",
        runningExecutionsJson: "[]",
        maxConcurrency: 5,
        queueAffinity: null,
        runtimeInstanceId: `runtime-${workerId}`,
        restartedFromRuntimeInstanceId: null,
        restartGeneration: 0,
        cpuPct: 50.0,
        memoryMb: 512,
        toolBacklogCount: 0,
        currentStepId: null,
        lastProgressAt: null,
        lastHeartbeatAt: "2026-04-23T10:00:00.000Z",
        updatedAt: "2026-04-23T10:00:00.000Z",
        version: 1,
      });
    }

    const listed = await harness.workerRepo.listWorkerSnapshots();
    assert.equal(listed.length, 3);
  });

  test("listWorkerSnapshots filters by status", async () => {
    await harness.workerRepo.upsertWorkerSnapshot({
      workerId: "worker-status-active",
      status: "idle",
      placement: "local" as const,
      isolationLevel: "standard" as const,
      repoVersion: null,
      remoteSessionStatus: null,
      lastAcknowledgedStreamOffset: null,
      streamResumeSuccessRate: null,
      credentialRefreshSuccessRate: null,
      sessionConsistencyCheckStatus: null,
      sessionConsistencyCheckedAt: null,
      workspaceSyncStatus: null,
      workspaceSyncCheckedAt: null,
      saturation: 0.5,
      activeLeaseCount: 0,
      meanStartupLatencyMs: null,
      sandboxSuccessRate: null,
      repoCacheHitRate: null,
      registrationVerifiedAt: null,
      registrationChallengeId: null,
      capabilitiesJson: "[]",
      runningExecutionsJson: "[]",
      maxConcurrency: 5,
      queueAffinity: null,
      runtimeInstanceId: "runtime-active",
      restartedFromRuntimeInstanceId: null,
      restartGeneration: 0,
      cpuPct: 10.0,
      memoryMb: 128,
      toolBacklogCount: 0,
      currentStepId: null,
      lastProgressAt: null,
      lastHeartbeatAt: "2026-04-23T10:00:00.000Z",
      updatedAt: "2026-04-23T10:00:00.000Z",
      version: 1,
    });

    await harness.workerRepo.upsertWorkerSnapshot({
      workerId: "worker-status-draining",
      status: "draining",
      placement: "local" as const,
      isolationLevel: "standard" as const,
      repoVersion: null,
      remoteSessionStatus: null,
      lastAcknowledgedStreamOffset: null,
      streamResumeSuccessRate: null,
      credentialRefreshSuccessRate: null,
      sessionConsistencyCheckStatus: null,
      sessionConsistencyCheckedAt: null,
      workspaceSyncStatus: null,
      workspaceSyncCheckedAt: null,
      saturation: 0.0,
      activeLeaseCount: 0,
      meanStartupLatencyMs: null,
      sandboxSuccessRate: null,
      repoCacheHitRate: null,
      registrationVerifiedAt: null,
      registrationChallengeId: null,
      capabilitiesJson: "[]",
      runningExecutionsJson: "[]",
      maxConcurrency: 5,
      queueAffinity: null,
      runtimeInstanceId: "runtime-draining",
      restartedFromRuntimeInstanceId: null,
      restartGeneration: 0,
      cpuPct: 5.0,
      memoryMb: 64,
      toolBacklogCount: 0,
      currentStepId: null,
      lastProgressAt: null,
      lastHeartbeatAt: "2026-04-23T10:00:00.000Z",
      updatedAt: "2026-04-23T10:00:00.000Z",
      version: 1,
    });

    const idleWorkers = await harness.workerRepo.listWorkerSnapshots("idle");
    assert.equal(idleWorkers.length, 1);
    assert.equal(idleWorkers[0]!.workerId, "worker-status-active");

    const drainingWorkers = await harness.workerRepo.listWorkerSnapshots("draining");
    assert.equal(drainingWorkers.length, 1);
    assert.equal(drainingWorkers[0]!.workerId, "worker-status-draining");
  });

  test("insertExecutionTicket and getExecutionTicket roundtrip", async () => {
    await insertTestExecution("exec-ticket-001", "task-ticket-001", "tenant-ticket");

    const ticket: ExecutionTicketRecord = {
      id: "ticket-001",
      executionId: "exec-ticket-001",
      taskId: "task-ticket-001",
      tenantId: "tenant-ticket",
      priority: "high",
      queueName: "default",
      dispatchTarget: "any",
      requiredIsolationLevel: "standard",
      requiredRepoVersion: null,
      requiredCapabilitiesJson: "[]",
      dispatchAfter: "2026-04-23T10:30:00.000Z",
      attempt: 1,
      status: "pending",
      assignedWorkerId: null,
      leaseId: null,
      claimedAt: null,
      consumedAt: null,
      invalidatedAt: null,
      createdAt: "2026-04-23T10:00:00.000Z",
      updatedAt: "2026-04-23T10:00:00.000Z",
    };

    await harness.workerRepo.insertExecutionTicket(ticket);

    const retrieved = await harness.workerRepo.getExecutionTicket("ticket-001");
    assert.equal(retrieved?.id, "ticket-001");
    assert.equal(retrieved?.executionId, "exec-ticket-001");
    assert.equal(retrieved?.priority, "high");
    assert.equal(retrieved?.status, "pending");
  });

  test("claimExecutionTicket updates ticket status", async () => {
    await insertTestExecution("exec-ticket-claim", "task-ticket-claim", "tenant-ticket-claim");

    const ticket: ExecutionTicketRecord = {
      id: "ticket-claim-001",
      executionId: "exec-ticket-claim",
      taskId: "task-ticket-claim",
      tenantId: "tenant-ticket-claim",
      priority: "normal",
      queueName: "default",
      dispatchTarget: "any",
      requiredIsolationLevel: "standard",
      requiredRepoVersion: null,
      requiredCapabilitiesJson: "[]",
      dispatchAfter: "2026-04-23T10:30:00.000Z",
      attempt: 1,
      status: "pending",
      assignedWorkerId: null,
      leaseId: null,
      claimedAt: null,
      consumedAt: null,
      invalidatedAt: null,
      createdAt: "2026-04-23T10:00:00.000Z",
      updatedAt: "2026-04-23T10:00:00.000Z",
    };

    await harness.workerRepo.insertExecutionTicket(ticket);

    await harness.workerRepo.claimExecutionTicket({
      ticketId: "ticket-claim-001",
      assignedWorkerId: "worker-claim-001",
      leaseId: "lease-claim-001",
      claimedAt: "2026-04-23T10:35:00.000Z",
    });

    const retrieved = await harness.workerRepo.getExecutionTicket("ticket-claim-001");
    assert.equal(retrieved?.status, "claimed");
    assert.equal(retrieved?.assignedWorkerId, "worker-claim-001");
  });

  test("consumeExecutionTicket marks ticket as consumed", async () => {
    await insertTestExecution("exec-ticket-consume", "task-ticket-consume", "tenant-ticket-consume");

    const ticket: ExecutionTicketRecord = {
      id: "ticket-consume-001",
      executionId: "exec-ticket-consume",
      taskId: "task-ticket-consume",
      tenantId: "tenant-ticket-consume",
      priority: "low",
      queueName: "default",
      dispatchTarget: "any",
      requiredIsolationLevel: "standard",
      requiredRepoVersion: null,
      requiredCapabilitiesJson: "[]",
      dispatchAfter: "2026-04-23T10:30:00.000Z",
      attempt: 1,
      status: "pending",
      assignedWorkerId: null,
      leaseId: null,
      claimedAt: null,
      consumedAt: null,
      invalidatedAt: null,
      createdAt: "2026-04-23T10:00:00.000Z",
      updatedAt: "2026-04-23T10:00:00.000Z",
    };

    await harness.workerRepo.insertExecutionTicket(ticket);
    await harness.workerRepo.claimExecutionTicket({
      ticketId: "ticket-consume-001",
      assignedWorkerId: "worker-consume",
      leaseId: "lease-consume",
      claimedAt: "2026-04-23T10:35:00.000Z",
    });

    await harness.workerRepo.consumeExecutionTicket("ticket-consume-001", "2026-04-23T11:00:00.000Z");

    const retrieved = await harness.workerRepo.getExecutionTicket("ticket-consume-001");
    assert.equal(retrieved?.status, "consumed");
  });

  test("insertExecutionLease and getExecutionLease roundtrip", async () => {
    await insertTestExecution("exec-lease-001", "task-lease-001", "tenant-lease");
    const now = new Date().toISOString();
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    const lease: ExecutionLeaseRecord = {
      id: "lease-001",
      executionId: "exec-lease-001",
      workerId: "worker-lease-001",
      attempt: 1,
      fencingToken: 1,
      queueName: "default",
      status: "active",
      leasedAt: now,
      expiresAt: future,
      lastHeartbeatAt: now,
      releasedAt: null,
      reasonCode: null,
    };

    await harness.workerRepo.insertExecutionLease(lease);

    const retrieved = await harness.workerRepo.getExecutionLease("lease-001");
    assert.equal(retrieved?.id, "lease-001");
    assert.equal(retrieved?.executionId, "exec-lease-001");
    assert.equal(retrieved?.status, "active");
  });

  test("getActiveExecutionLease returns active lease for execution", async () => {
    await insertTestExecution("exec-lease-active", "task-lease-active", "tenant-lease-active");
    const now = new Date().toISOString();
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    const lease: ExecutionLeaseRecord = {
      id: "lease-active-001",
      executionId: "exec-lease-active",
      workerId: "worker-active",
      attempt: 1,
      fencingToken: 1,
      queueName: "default",
      status: "active",
      leasedAt: now,
      expiresAt: future,
      lastHeartbeatAt: now,
      releasedAt: null,
      reasonCode: null,
    };

    await harness.workerRepo.insertExecutionLease(lease);

    const activeLease = await harness.workerRepo.getActiveExecutionLease("exec-lease-active");
    assert.equal(activeLease?.id, "lease-active-001");
  });

  test("renewExecutionLease updates expiration", async () => {
    await insertTestExecution("exec-lease-renew", "task-lease-renew", "tenant-lease-renew");
    const now = new Date().toISOString();
    const initialExpiry = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const renewedExpiry = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const heartbeatAt = new Date(Date.now() + 45 * 60 * 1000).toISOString();

    const lease: ExecutionLeaseRecord = {
      id: "lease-renew-001",
      executionId: "exec-lease-renew",
      workerId: "worker-renew",
      attempt: 1,
      fencingToken: 1,
      queueName: "default",
      status: "active",
      leasedAt: now,
      expiresAt: initialExpiry,
      lastHeartbeatAt: now,
      releasedAt: null,
      reasonCode: null,
    };

    await harness.workerRepo.insertExecutionLease(lease);

    await harness.workerRepo.renewExecutionLease("lease-renew-001", renewedExpiry, heartbeatAt);

    const retrieved = await harness.workerRepo.getExecutionLease("lease-renew-001");
    assert.equal(retrieved?.expiresAt, renewedExpiry);
  });

  test("closeExecutionLease releases the lease", async () => {
    await insertTestExecution("exec-lease-close", "task-lease-close", "tenant-lease-close");
    const now = new Date().toISOString();
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    const lease: ExecutionLeaseRecord = {
      id: "lease-close-001",
      executionId: "exec-lease-close",
      workerId: "worker-close",
      attempt: 1,
      fencingToken: 1,
      queueName: "default",
      status: "active",
      leasedAt: now,
      expiresAt: future,
      lastHeartbeatAt: now,
      releasedAt: null,
      reasonCode: null,
    };

    await harness.workerRepo.insertExecutionLease(lease);

    await harness.workerRepo.closeExecutionLease({
      leaseId: "lease-close-001",
      status: "released",
      releasedAt: "2026-04-23T10:45:00.000Z",
      reasonCode: "task_completed",
    });

    const retrieved = await harness.workerRepo.getExecutionLease("lease-close-001");
    assert.equal(retrieved?.status, "released");
    assert.equal(retrieved?.reasonCode, "task_completed");
  });

  test("getLatestFencingToken returns token for execution", async () => {
    await insertTestExecution("exec-fence", "task-fencing", "tenant-fencing");
    const now = Date.now();
    await harness.workerRepo.insertExecutionLease({
      id: "fence-003",
      executionId: "exec-fence",
      workerId: "worker-3",
      attempt: 1,
      fencingToken: 3,
      queueName: "default",
      status: "active",
      leasedAt: new Date(now).toISOString(),
      expiresAt: new Date(now + 40 * 60 * 1000).toISOString(),
      lastHeartbeatAt: new Date(now).toISOString(),
      releasedAt: null,
      reasonCode: null,
    });

    const latestToken = await harness.workerRepo.getLatestFencingToken("exec-fence");
    assert.equal(latestToken, 3);
  });
});
