import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { ExecutionDispatchService } from "../../../../src/platform/execution/dispatcher/execution-dispatch-service.js";
import { ExecutionLeaseService } from "../../../../src/platform/execution/lease/execution-lease-service.js";
import { ExecutionResourceCeilingGuard } from "../../../../src/platform/execution/dispatcher/execution-resource-ceiling-guard.js";
import { ExecutionWorkerHandshakeService } from "../../../../src/platform/execution/worker-pool/execution-worker-handshake-service.js";
import { ExecutionWorkerWritebackService } from "../../../../src/platform/execution/worker-pool/execution-worker-writeback-service.js";
import { WorkerRegistryService } from "../../../../src/platform/execution/worker-pool/worker-registry-service.js";
import { AuthoritativeTaskStore } from "../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { nowIso } from "../../../../src/platform/contracts/types/ids.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";

function seedClaimedExecution(
  db: SqliteDatabase,
  store: AuthoritativeTaskStore,
  workerOverrides: Partial<Parameters<WorkerRegistryService["recordHeartbeat"]>[0]> = {},
  claimOverrides: Partial<Parameters<ExecutionWorkerHandshakeService["claimExecution"]>[0]> = {},
): { leaseId: string } {
  const workers = new WorkerRegistryService(store);
  const dispatch = new ExecutionDispatchService(db, store);
  const handshake = new ExecutionWorkerHandshakeService(db, store);
  const now = nowIso();

  db.transaction(() => {
    store.insertTask({
      id: "task-worker-writeback",
      parentId: null,
      rootId: "task-worker-writeback",
      divisionId: "general_ops",
      title: "Worker writeback task",
      status: "in_progress",
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
      id: "exec-worker-writeback",
      taskId: "task-worker-writeback",
      workflowId: "single_agent_minimal",
      parentExecutionId: null,
      agentId: "agent-worker-writeback",
      roleId: "general_executor",
      runKind: "task_run",
      status: "created",
      inputRef: null,
      traceId: "trace-worker-writeback",
      attempt: 1,
      timeoutMs: 1_000,
      budgetUsdLimit: 1,
      requiresApproval: 0,
      sandboxMode: "workspace_write",
      allowedToolsJson: "[]",
      allowedPathsJson: "[]",
      maxRetries: 0,
      retryBackoff: "none",
      lastErrorCode: null,
      lastErrorMessage: null,
      startedAt: now,
      finishedAt: null,
      createdAt: now,
      updatedAt: now,
    });
    store.insertWorkflowState({
      taskId: "task-worker-writeback",
      divisionId: "general_ops",
      workflowId: "single_agent_minimal",
      currentStepIndex: 0,
      status: "running",
      outputsJson: "{}",
      lastErrorCode: null,
      retryCount: 0,
      resumableFromStep: null,
      startedAt: now,
      updatedAt: now,
    });
    store.insertSession({
      id: "sess-worker-writeback",
      taskId: "task-worker-writeback",
      channel: "cli",
      status: "streaming",
      externalSessionId: null,
      createdAt: now,
      updatedAt: now,
    });
  });

  workers.recordHeartbeat({
    workerId: "worker-writeback",
    status: "idle",
    placement: "local",
    capabilities: ["bash"],
    runningExecutionIds: [],
    maxConcurrency: 1,
    queueAffinity: "default",
    runtimeInstanceId: "runtime-writeback-1",
    occurredAt: "2026-04-04T12:00:00.000Z",
    ...workerOverrides,
  });
  const created = dispatch.createTicket({
    executionId: "exec-worker-writeback",
    queueName: "default",
    requiredCapabilities: ["bash"],
    occurredAt: "2026-04-04T12:00:05.000Z",
  });
  const dispatched = dispatch.dispatchNext({
    queueName: "default",
    leaseTtlMs: 30_000,
    occurredAt: "2026-04-04T12:00:06.000Z",
  });
  handshake.claimExecution({
    ticketId: created.ticket.id,
    workerId: "worker-writeback",
    leaseId: dispatched.leaseId ?? "",
    fencingToken: 1,
    runtimeInstanceId: "runtime-writeback-1",
    occurredAt: "2026-04-04T12:00:07.000Z",
    ...claimOverrides,
  });

  return {
    leaseId: dispatched.leaseId ?? "",
  };
}

test("execution worker writeback service records authoritative terminal writeback and releases the lease", () => {
  const workspace = createTempWorkspace("aa-worker-writeback-");
  const dbPath = join(workspace, "worker-writeback-complete.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const writeback = new ExecutionWorkerWritebackService(db, store);
    const seeded = seedClaimedExecution(db, store);

    const decision = writeback.recordWriteback({
      executionId: "exec-worker-writeback",
      workerId: "worker-writeback",
      leaseId: seeded.leaseId,
      fencingToken: 1,
      runtimeInstanceId: "runtime-writeback-2",
      terminalStatus: "done",
      lastToolName: "edit.apply",
      toolCallCount: 4,
      taskOutputJson: JSON.stringify({ result: "ok" }),
      outputsJson: JSON.stringify({ final: { result: "ok" } }),
      progressMessage: "worker finished",
      remoteLogs: [
        {
          level: "info",
          message: "remote worker flushed final stdout and uploaded terminal artifacts",
          context: { stage: "writeback" },
        },
      ],
      occurredAt: "2026-04-04T12:00:10.000Z",
    });
    const snapshot = store.loadTaskSnapshot("task-worker-writeback");
    const lease = store.getExecutionLease(seeded.leaseId);
    const worker = store.getWorkerSnapshot("worker-writeback");
    const heartbeats = store.listHeartbeatSnapshotsByExecution("exec-worker-writeback");
    const agentExecution = store.getAgentExecutionRecord("exec-worker-writeback");
    const events = store.listEventsForTask("task-worker-writeback");
    const remoteLogs = store.listRemoteLogsByExecution("exec-worker-writeback");
    db.close();

    assert.equal(decision.accepted, true);
    assert.equal(snapshot.task.status, "done");
    assert.equal(snapshot.workflow?.status, "completed");
    assert.equal(snapshot.session?.status, "completed");
    assert.equal(snapshot.execution?.status, "succeeded");
    assert.equal(snapshot.task.outputJson, JSON.stringify({ result: "ok" }));
    assert.equal(lease?.status, "released");
    assert.equal(lease?.reasonCode, "worker_writeback_done");
    assert.equal(worker?.status, "idle");
    assert.equal(worker?.runningExecutionsJson, "[]");
    assert.equal(worker?.runtimeInstanceId, "runtime-writeback-2");
    assert.equal(worker?.restartedFromRuntimeInstanceId, "runtime-writeback-1");
    assert.equal(worker?.restartGeneration, 1);
    assert.equal(agentExecution?.status, "succeeded");
    assert.equal(agentExecution?.lastToolName, "edit.apply");
    assert.equal(agentExecution?.toolCallCount, 4);
    assert.equal(agentExecution?.completedAt, "2026-04-04T12:00:10.000Z");
    assert.equal(heartbeats.at(-1)?.status, "succeeded");
    assert.equal(heartbeats.at(-1)?.progressMessage, "worker finished");
    assert.equal(heartbeats.at(-1)?.runtimeInstanceId, "runtime-writeback-2");
    assert.equal(heartbeats.at(-1)?.restartGeneration, 1);
    assert.ok(events.some((event) => event.eventType === "worker:writeback_recorded"));
    assert.ok(events.some((event) => event.eventType === "worker:lease_released_after_writeback"));
    assert.equal(remoteLogs.length, 1);
    assert.equal(remoteLogs[0]?.runtimeInstanceId, "runtime-writeback-2");
    assert.match(remoteLogs[0]?.message ?? "", /uploaded terminal artifacts/i);
  } finally {
    cleanupPath(workspace);
  }
});

test("execution worker writeback service rejects duplicate writeback after the execution is terminal", () => {
  const workspace = createTempWorkspace("aa-worker-writeback-");
  const dbPath = join(workspace, "worker-writeback-duplicate.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const writeback = new ExecutionWorkerWritebackService(db, store);
    const seeded = seedClaimedExecution(db, store);

    writeback.recordWriteback({
      executionId: "exec-worker-writeback",
      workerId: "worker-writeback",
      leaseId: seeded.leaseId,
      fencingToken: 1,
      runtimeInstanceId: "runtime-writeback-1",
      terminalStatus: "done",
      occurredAt: "2026-04-04T12:00:10.000Z",
    });
    const duplicate = writeback.recordWriteback({
      executionId: "exec-worker-writeback",
      workerId: "worker-writeback",
      leaseId: seeded.leaseId,
      fencingToken: 1,
      runtimeInstanceId: "runtime-writeback-1",
      terminalStatus: "done",
      occurredAt: "2026-04-04T12:00:11.000Z",
    });
    const events = store.listEventsForTask("task-worker-writeback");
    db.close();

    assert.equal(duplicate.accepted, false);
    assert.equal(duplicate.reasonCode, "execution_not_executing");
    assert.ok(events.some((event) => event.eventType === "worker:writeback_rejected"));
  } finally {
    cleanupPath(workspace);
  }
});

test("execution worker writeback service rejects terminal writeback that exceeds execution resource ceilings", () => {
  const workspace = createTempWorkspace("aa-worker-writeback-");
  const dbPath = join(workspace, "worker-writeback-resource-limit.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const writeback = new ExecutionWorkerWritebackService(db, store, {
      resourceCeilingGuard: new ExecutionResourceCeilingGuard({
        maxToolCalls: null,
        maxMemoryMb: 128,
        maxElapsedMs: null,
      }),
    });
    const seeded = seedClaimedExecution(db, store);

    const decision = writeback.recordWriteback({
      executionId: "exec-worker-writeback",
      workerId: "worker-writeback",
      leaseId: seeded.leaseId,
      fencingToken: 1,
      terminalStatus: "done",
      memoryMb: 256,
      occurredAt: "2026-04-04T12:00:10.000Z",
    });
    const snapshot = store.loadTaskSnapshot("task-worker-writeback");
    const lease = store.getExecutionLease(seeded.leaseId);
    const heartbeats = store.listHeartbeatSnapshotsByExecution("exec-worker-writeback");
    const agentExecution = store.getAgentExecutionRecord("exec-worker-writeback");
    const events = store.listEventsForTask("task-worker-writeback");
    db.close();

    assert.equal(decision.accepted, false);
    assert.equal(decision.reasonCode, "resource_limit_exceeded");
    assert.equal(snapshot.task.status, "in_progress");
    assert.equal(lease?.status, "active");
    assert.equal(heartbeats.length, 1);
    assert.equal(agentExecution?.lastErrorCode, "agent.resource_limit.memory_exceeded");
    assert.ok(
      events.some((event) => {
        if (event.eventType !== "worker:writeback_rejected") {
          return false;
        }
        const payload = JSON.parse(event.payloadJson) as {
          reasonCode?: string | null;
          resourceLimit?: { reasonCode?: string | null };
        };
        return (
          payload.reasonCode === "resource_limit_exceeded"
          && payload.resourceLimit?.reasonCode === "agent.resource_limit.memory_exceeded"
        );
      }),
    );
  } finally {
    cleanupPath(workspace);
  }
});

test("execution worker writeback service rejects stale fencing tokens after lease failover", () => {
  const workspace = createTempWorkspace("aa-worker-writeback-");
  const dbPath = join(workspace, "worker-writeback-stale.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const writeback = new ExecutionWorkerWritebackService(db, store);
    const leases = new ExecutionLeaseService(db, store);
    const seeded = seedClaimedExecution(db, store);

    leases.reclaimExpiredLeases("2026-04-04T12:01:00.000Z");
    const reacquired = leases.acquireLease({
      executionId: "exec-worker-writeback",
      workerId: "worker-writeback",
      ttlMs: 30_000,
      queueName: "default",
      occurredAt: "2026-04-04T12:01:00.000Z",
    });
    const decision = writeback.recordWriteback({
      executionId: "exec-worker-writeback",
      workerId: "worker-writeback",
      leaseId: seeded.leaseId,
      fencingToken: 1,
      runtimeInstanceId: "runtime-writeback-1",
      terminalStatus: "failed",
      reasonCode: "worker.stale",
      occurredAt: "2026-04-04T12:01:05.000Z",
    });
    db.close();

    assert.equal(reacquired.lease?.fencingToken, 2);
    assert.equal(decision.accepted, false);
    assert.equal(decision.reasonCode, "stale_fencing_token");
  } finally {
    cleanupPath(workspace);
  }
});

test("execution worker writeback service rejects untrusted remote workers before terminal ownership is accepted", () => {
  const workspace = createTempWorkspace("aa-worker-writeback-");
  const dbPath = join(workspace, "worker-writeback-remote-untrusted.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const workers = new WorkerRegistryService(store);
    const writeback = new ExecutionWorkerWritebackService(db, store);
    const seeded = seedClaimedExecution(db, store);

    workers.recordHeartbeat({
      workerId: "worker-writeback",
      status: "busy",
      placement: "remote",
      remoteSessionStatus: "connected",
      lastAcknowledgedStreamOffset: "stream:905",
      capabilities: ["bash"],
      runningExecutionIds: ["exec-worker-writeback"],
      maxConcurrency: 1,
      queueAffinity: "default",
      runtimeInstanceId: "runtime-writeback-1",
      occurredAt: "2026-04-04T12:00:09.000Z",
    });

    const decision = writeback.recordWriteback({
      executionId: "exec-worker-writeback",
      workerId: "worker-writeback",
      leaseId: seeded.leaseId,
      fencingToken: 1,
      terminalStatus: "done",
      occurredAt: "2026-04-04T12:00:10.000Z",
    });
    const execution = store.getExecution("exec-worker-writeback");
    db.close();

    assert.equal(decision.accepted, false);
    assert.equal(decision.reasonCode, "worker_not_trusted");
    assert.equal(execution?.status, "executing");
  } finally {
    cleanupPath(workspace);
  }
});

test("execution worker writeback service rejects authoritative writeback from remote viewer-only sessions", () => {
  const workspace = createTempWorkspace("aa-worker-writeback-");
  const dbPath = join(workspace, "worker-writeback-viewer-only.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const workers = new WorkerRegistryService(store);
    const writeback = new ExecutionWorkerWritebackService(db, store);
    const seeded = seedClaimedExecution(
      db,
      store,
      {
        placement: "remote",
        registrationVerifiedAt: "2026-04-04T12:00:05.000Z",
        remoteSessionStatus: "connected",
        lastAcknowledgedStreamOffset: "stream:910",
        sessionConsistencyCheckStatus: "passed",
      },
      {
        remoteSessionStatus: "connected",
        lastAcknowledgedStreamOffset: "stream:911",
        sessionConsistencyCheckStatus: "passed",
      },
    );
    workers.recordHeartbeat({
      workerId: "worker-writeback",
      status: "busy",
      placement: "remote",
      registrationVerifiedAt: "2026-04-04T12:00:09.000Z",
      remoteSessionStatus: "viewer_only",
      lastAcknowledgedStreamOffset: "stream:912",
      sessionConsistencyCheckStatus: "passed",
      capabilities: ["bash"],
      runningExecutionIds: ["exec-worker-writeback"],
      maxConcurrency: 1,
      queueAffinity: "default",
      runtimeInstanceId: "runtime-writeback-1",
      occurredAt: "2026-04-04T12:00:09.000Z",
    });

    const decision = writeback.recordWriteback({
      executionId: "exec-worker-writeback",
      workerId: "worker-writeback",
      leaseId: seeded.leaseId,
      fencingToken: 1,
      runtimeInstanceId: "runtime-writeback-1",
      terminalStatus: "done",
      occurredAt: "2026-04-04T12:00:10.000Z",
    });
    const snapshot = store.loadTaskSnapshot("task-worker-writeback");
    const lease = store.getExecutionLease(seeded.leaseId);
    const events = store.listEventsForTask("task-worker-writeback");
    db.close();

    assert.equal(decision.accepted, false);
    assert.equal(decision.reasonCode, "remote_session_viewer_only");
    assert.equal(snapshot.execution?.status, "executing");
    assert.equal(lease?.status, "active");
    assert.ok(
      events.some((event) => {
        if (event.eventType !== "worker:writeback_rejected") {
          return false;
        }
        const payload = JSON.parse(event.payloadJson) as { reasonCode?: string | null };
        return payload.reasonCode === "remote_session_viewer_only";
      }),
    );
  } finally {
    cleanupPath(workspace);
  }
});

test("execution worker writeback service keeps draining workers out of rotation after terminal release", () => {
  const workspace = createTempWorkspace("aa-worker-writeback-");
  const dbPath = join(workspace, "worker-writeback-draining.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const workers = new WorkerRegistryService(store);
    const writeback = new ExecutionWorkerWritebackService(db, store);
    const seeded = seedClaimedExecution(db, store);

    workers.recordHeartbeat({
      workerId: "worker-writeback",
      status: "draining",
      capabilities: ["bash"],
      runningExecutionIds: ["exec-worker-writeback"],
      maxConcurrency: 1,
      queueAffinity: "default",
      runtimeInstanceId: "runtime-writeback-1",
      toolBacklogCount: 2,
      currentStepId: "step-finalize",
      occurredAt: "2026-04-04T12:00:09.000Z",
    });

    const decision = writeback.recordWriteback({
      executionId: "exec-worker-writeback",
      workerId: "worker-writeback",
      leaseId: seeded.leaseId,
      fencingToken: 1,
      runtimeInstanceId: "runtime-writeback-1",
      terminalStatus: "done",
      occurredAt: "2026-04-04T12:00:10.000Z",
    });
    const worker = store.getWorkerSnapshot("worker-writeback");
    db.close();

    assert.equal(decision.accepted, true);
    assert.equal(worker?.status, "draining");
    assert.equal(worker?.runningExecutionsJson, "[]");
    assert.equal(worker?.toolBacklogCount, 0);
    assert.equal(worker?.currentStepId, null);
  } finally {
    cleanupPath(workspace);
  }
});

test("execution worker writeback service rejects terminal writeback when remote workspace sync conflicts are reported", () => {
  const workspace = createTempWorkspace("aa-worker-writeback-");
  const dbPath = join(workspace, "worker-writeback-remote-workspace-conflict.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const workers = new WorkerRegistryService(store);
    const writeback = new ExecutionWorkerWritebackService(db, store);
    const seeded = seedClaimedExecution(db, store);

    workers.recordHeartbeat({
      workerId: "worker-writeback",
      status: "busy",
      placement: "remote",
      registrationVerifiedAt: "2026-04-04T12:00:09.000Z",
      remoteSessionStatus: "connected",
      lastAcknowledgedStreamOffset: "stream:932",
      sessionConsistencyCheckStatus: "passed",
      workspaceSyncStatus: "aligned",
      workspaceSyncCheckedAt: "2026-04-04T12:00:09.000Z",
      capabilities: ["bash"],
      runningExecutionIds: ["exec-worker-writeback"],
      maxConcurrency: 1,
      queueAffinity: "default",
      runtimeInstanceId: "runtime-writeback-1",
      occurredAt: "2026-04-04T12:00:09.000Z",
    });

    const decision = writeback.recordWriteback({
      executionId: "exec-worker-writeback",
      workerId: "worker-writeback",
      leaseId: seeded.leaseId,
      fencingToken: 1,
      runtimeInstanceId: "runtime-writeback-1",
      terminalStatus: "done",
      workspaceSyncStatus: "conflict",
      workspaceSyncCheckedAt: "2026-04-04T12:00:10.000Z",
      occurredAt: "2026-04-04T12:00:10.000Z",
    });
    const snapshot = store.loadTaskSnapshot("task-worker-writeback");
    const lease = store.getExecutionLease(seeded.leaseId);
    const events = store.listEventsForTask("task-worker-writeback");
    db.close();

    assert.equal(decision.accepted, false);
    assert.equal(decision.reasonCode, "remote_workspace_sync_conflict");
    assert.equal(snapshot.execution?.status, "executing");
    assert.equal(lease?.status, "active");
    assert.ok(
      events.some((event) => {
        if (event.eventType !== "worker:writeback_rejected") {
          return false;
        }
        const payload = JSON.parse(event.payloadJson) as { reasonCode?: string | null; workspaceSyncStatus?: string | null };
        return payload.reasonCode === "remote_workspace_sync_conflict" && payload.workspaceSyncStatus === "conflict";
      }),
    );
  } finally {
    cleanupPath(workspace);
  }
});

test("execution worker writeback service fails closed when the authoritative store is temporarily unavailable", () => {
  const workspace = createTempWorkspace("aa-worker-writeback-");
  const dbPath = join(workspace, "worker-writeback-authoritative-store-unavailable.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const writeback = new ExecutionWorkerWritebackService(db, store);
    const seeded = seedClaimedExecution(db, store);

    const transitionService = (writeback as unknown as {
      transitions: { applyTaskTerminalState: (...args: unknown[]) => unknown };
    }).transitions;
    const originalApplyTaskTerminalState = transitionService.applyTaskTerminalState.bind(transitionService);
    transitionService.applyTaskTerminalState = (() => {
      throw new Error("authoritative store unavailable");
    }) as typeof transitionService.applyTaskTerminalState;

    const failed = writeback.recordWriteback({
      executionId: "exec-worker-writeback",
      workerId: "worker-writeback",
      leaseId: seeded.leaseId,
      fencingToken: 1,
      runtimeInstanceId: "runtime-writeback-1",
      terminalStatus: "done",
      occurredAt: "2026-04-04T12:00:10.000Z",
    });

    transitionService.applyTaskTerminalState = originalApplyTaskTerminalState;
    const recovered = writeback.recordWriteback({
      executionId: "exec-worker-writeback",
      workerId: "worker-writeback",
      leaseId: seeded.leaseId,
      fencingToken: 1,
      runtimeInstanceId: "runtime-writeback-1",
      terminalStatus: "done",
      occurredAt: "2026-04-04T12:00:11.000Z",
    });
    const snapshot = store.loadTaskSnapshot("task-worker-writeback");
    const lease = store.getExecutionLease(seeded.leaseId);
    const events = store.listEventsForTask("task-worker-writeback");
    db.close();

    assert.equal(failed.accepted, false);
    assert.equal(failed.reasonCode, "authoritative_store_unavailable");
    assert.equal(recovered.accepted, true);
    assert.equal(snapshot.execution?.status, "succeeded");
    assert.equal(snapshot.task.status, "done");
    assert.equal(lease?.status, "released");
    assert.ok(
      events.some((event) => {
        if (event.eventType !== "worker:writeback_rejected") {
          return false;
        }
        const payload = JSON.parse(event.payloadJson) as { reasonCode?: string | null };
        return payload.reasonCode === "authoritative_store_unavailable";
      }),
    );
  } finally {
    cleanupPath(workspace);
  }
});
