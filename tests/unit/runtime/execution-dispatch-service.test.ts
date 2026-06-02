import test from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";

import { ExecutionDispatchService } from "../../../src/platform/five-plane-execution/dispatcher/execution-dispatch-service.js";
import { AuthoritativeTaskStore } from "../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { WorkerRegistryService, type RegisteredWorkerView } from "../../../src/platform/five-plane-execution/worker-pool/worker-registry-service.js";
import { cleanupPath, createTempWorkspace } from "../../helpers/fs.js";
import { newId, nowIso } from "../../../src/platform/contracts/types/ids.js";
import type {
  ExecutionTicketRecord,
  TaskPriority,
  WorkerStatus,
  RemoteSessionStatus,
  WorkerSnapshotRecord,
} from "../../../src/platform/contracts/types/domain.js";
import type { TaskStatus, ExecutionStatus } from "../../../src/platform/contracts/types/status.js";

function createDispatchServiceHarness() {
  const workspace = createTempWorkspace("aa-dispatch-unit-");
  const dbPath = join(workspace, "dispatch.db");
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  // Provide null backpressure and queue availability to avoid HealthService complications
  const service = new ExecutionDispatchService(db, store, () => null, () => null);

  return {
    db,
    store,
    service,
    workerRegistry: new WorkerRegistryService(store),
    close() {
      db.close();
      cleanupPath(workspace);
    },
  };
}

function seedTaskAndExecution(
  store: AuthoritativeTaskStore,
  db: SqliteDatabase,
  input: {
    taskId: string;
    executionId: string;
    traceId?: string;
    priority?: TaskPriority;
    status?: TaskStatus;
    executionStatus?: ExecutionStatus;
  },
): void {
  const now = nowIso();
  db.transaction(() => {
    store.insertTask({
      id: input.taskId,
      parentId: null,
      rootId: input.taskId,
      divisionId: "general-ops",
      title: "Test task",
      status: input.status ?? "in_progress",
      source: "user",
      priority: input.priority ?? "normal",
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
      id: input.executionId,
      taskId: input.taskId,
      workflowId: "single_agent_minimal",
      parentExecutionId: null,
      harnessRunId: null,
      agentId: "agent-1",
      roleId: "general_executor",
      runKind: "task_run",
      status: input.executionStatus ?? "executing",
      inputRef: null,
      traceId: input.traceId ?? "trace-test",
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
      startedAt: now,
      finishedAt: null,
      createdAt: now,
      updatedAt: now,
    });
    store.insertWorkflowState({
      taskId: input.taskId,
      divisionId: "general-ops",
      workflowId: "single_agent_minimal",
      currentStepIndex: 0,
      status: "running",
      outputsJson: "[]",
      lastErrorCode: null,
      retryCount: 0,
      resumableFromStep: "step-1",
      startedAt: now,
      updatedAt: now,
    });
  });
}

function registerWorker(
  workerRegistry: WorkerRegistryService,
  input: {
    workerId: string;
    status?: WorkerStatus;
    placement?: "local" | "remote";
    capabilities?: string[];
    maxConcurrency?: number;
    queueAffinity?: string | null;
    isolationLevel?: "standard" | "hardened" | "strict";
    repoVersion?: string | null;
    remoteSessionStatus?: RemoteSessionStatus;
    activeLeaseCount?: number;
    runningExecutionIds?: string[];
    saturation?: number | null;
    cpuPct?: number | null;
    toolBacklogCount?: number;
    lastAcknowledgedStreamOffset?: string | null;
    sessionConsistencyCheckStatus?: "passed" | "unknown" | "mismatch";
    workspaceSyncStatus?: "aligned" | "unknown" | "conflict";
    registrationVerifiedAt?: string | null;
  },
): void {
  // For remote workers, lastAcknowledgedStreamOffset must be a non-empty string for dispatch
  const isRemote = input.placement === "remote";
  const defaultStreamOffset =
    isRemote && input.lastAcknowledgedStreamOffset == null
      ? "stream:0"
      : (input.lastAcknowledgedStreamOffset ?? null);

  workerRegistry.recordHeartbeat({
    workerId: input.workerId,
    status: (input.status ?? "idle") as WorkerSnapshotRecord["status"],
    placement: input.placement ?? "local",
    capabilities: input.capabilities ?? ["bash", "edit"],
    maxConcurrency: input.maxConcurrency ?? 4,
    queueAffinity: input.queueAffinity ?? null,
    isolationLevel: input.isolationLevel ?? "standard",
    repoVersion: input.repoVersion ?? null,
    remoteSessionStatus: input.remoteSessionStatus ?? "connected",
    lastAcknowledgedStreamOffset: defaultStreamOffset,
    sessionConsistencyCheckStatus: input.sessionConsistencyCheckStatus ?? "passed",
    workspaceSyncStatus: input.workspaceSyncStatus ?? "aligned",
    saturation: input.saturation ?? null,
    activeLeaseCount: input.activeLeaseCount ?? 0,
    runningExecutionIds: input.runningExecutionIds ?? [],
    cpuPct: input.cpuPct ?? null,
    toolBacklogCount: input.toolBacklogCount ?? 0,
    registrationVerifiedAt:
      input.registrationVerifiedAt === undefined
        ? (isRemote ? nowIso() : null)
        : input.registrationVerifiedAt,
    occurredAt: nowIso(),
  });
}

function createActiveLease(
  store: AuthoritativeTaskStore,
  db: SqliteDatabase,
  input: {
    leaseId: string;
    executionId: string;
    workerId: string;
    queueName?: string | null;
    occurredAt?: string;
    expiresAt?: string;
  },
): void {
  const occurredAt = input.occurredAt ?? nowIso();
  db.transaction(() => {
    store.worker.insertExecutionLease({
      id: input.leaseId,
      executionId: input.executionId,
      workerId: input.workerId,
      attempt: 1,
      fencingToken: 1,
      queueName: input.queueName ?? "default",
      status: "active",
      leasedAt: occurredAt,
      expiresAt: input.expiresAt ?? new Date(Date.now() + 60_000).toISOString(),
      lastHeartbeatAt: occurredAt,
      releasedAt: null,
      reasonCode: null,
    });
  });
}

// ============================================================================
// createTicket Tests
// ============================================================================

test("createTicket creates a new ticket for execution [execution-dispatch-service]", () => {
  const harness = createDispatchServiceHarness();
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    seedTaskAndExecution(harness.store, harness.db, { taskId, executionId });

    const decision = harness.service.createTicket({
      executionId,
      priority: "high",
      queueName: "default",
      requiredCapabilities: ["bash"],
    });

    assert.equal(decision.outcome, "created");
    assert.ok(decision.ticket.id.startsWith("ticket_"));
    assert.equal(decision.ticket.executionId, executionId);
    assert.equal(decision.ticket.taskId, taskId);
    assert.equal(decision.ticket.priority, "high");
    assert.equal(decision.ticket.queueName, "default");
    assert.equal(decision.ticket.status, "pending");
    assert.equal(decision.ticket.assignedWorkerId, null);
    assert.equal(decision.ticket.leaseId, null);
  } finally {
    harness.close();
  }
});

test("createTicket reuses existing active ticket [execution-dispatch-service]", () => {
  const harness = createDispatchServiceHarness();
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    seedTaskAndExecution(harness.store, harness.db, { taskId, executionId });

    const first = harness.service.createTicket({ executionId, priority: "high" });
    const second = harness.service.createTicket({ executionId, priority: "normal" });

    assert.equal(first.outcome, "created");
    assert.equal(second.outcome, "exists");
    assert.equal(second.ticket.id, first.ticket.id);
    assert.equal(second.ticket.priority, "high"); // Original priority preserved
  } finally {
    harness.close();
  }
});

test("createTicket throws when execution not found [execution-dispatch-service]", () => {
  const harness = createDispatchServiceHarness();
  try {
    assert.throws(() => {
      harness.service.createTicket({ executionId: "nonexistent-exec" });
    }, /Execution not found/);
  } finally {
    harness.close();
  }
});

test("createTicket applies dispatchTarget defaults correctly [execution-dispatch-service]", () => {
  const harness = createDispatchServiceHarness();
  try {
    const taskId1 = newId("task");
    const executionId1 = newId("exec");
    const taskId2 = newId("task");
    const executionId2 = newId("exec");
    const taskId3 = newId("task");
    const executionId3 = newId("exec");
    seedTaskAndExecution(harness.store, harness.db, { taskId: taskId1, executionId: executionId1 });
    seedTaskAndExecution(harness.store, harness.db, { taskId: taskId2, executionId: executionId2 });
    seedTaskAndExecution(harness.store, harness.db, { taskId: taskId3, executionId: executionId3 });

    const ticketAny = harness.service.createTicket({ executionId: executionId1 });
    assert.equal(ticketAny.ticket.dispatchTarget, "any");

    const ticketLocal = harness.service.createTicket({
      executionId: executionId2,
      dispatchTarget: "local_only",
    });
    assert.equal(ticketLocal.ticket.dispatchTarget, "local_only");

    const ticketRemote = harness.service.createTicket({
      executionId: executionId3,
      dispatchTarget: "prefer_remote",
    });
    assert.equal(ticketRemote.ticket.dispatchTarget, "prefer_remote");
  } finally {
    harness.close();
  }
});

test("createTicket normalizes and deduplicates capabilities [execution-dispatch-service]", () => {
  const harness = createDispatchServiceHarness();
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    seedTaskAndExecution(harness.store, harness.db, { taskId, executionId });

    const ticket = harness.service.createTicket({
      executionId,
      requiredCapabilities: ["  bash  ", "edit", "bash", "  python  "],
    });

    // Should be trimmed, deduplicated, and sorted (case-sensitive)
    const caps = JSON.parse(ticket.ticket.requiredCapabilitiesJson);
    assert.deepEqual(caps, ["bash", "edit", "python"]);
  } finally {
    harness.close();
  }
});

test("createTicket sets isolation level correctly [execution-dispatch-service]", () => {
  const harness = createDispatchServiceHarness();
  try {
    const taskId1 = newId("task");
    const executionId1 = newId("exec");
    const taskId2 = newId("task");
    const executionId2 = newId("exec");
    const taskId3 = newId("task");
    const executionId3 = newId("exec");
    seedTaskAndExecution(harness.store, harness.db, { taskId: taskId1, executionId: executionId1 });
    seedTaskAndExecution(harness.store, harness.db, { taskId: taskId2, executionId: executionId2 });
    seedTaskAndExecution(harness.store, harness.db, { taskId: taskId3, executionId: executionId3 });

    const ticketStandard = harness.service.createTicket({ executionId: executionId1 });
    assert.equal(ticketStandard.ticket.requiredIsolationLevel, "standard");

    const ticketHardened = harness.service.createTicket({
      executionId: executionId2,
      requiredIsolationLevel: "hardened",
    });
    assert.equal(ticketHardened.ticket.requiredIsolationLevel, "hardened");

    const ticketStrict = harness.service.createTicket({
      executionId: executionId3,
      requiredIsolationLevel: "strict",
    });
    assert.equal(ticketStrict.ticket.requiredIsolationLevel, "strict");
  } finally {
    harness.close();
  }
});

test("createTicket handles dispatchAfter timestamp [execution-dispatch-service]", () => {
  const harness = createDispatchServiceHarness();
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    seedTaskAndExecution(harness.store, harness.db, { taskId, executionId });

    const futureTime = "2099-01-01T00:00:00.000Z";
    const ticket = harness.service.createTicket({
      executionId,
      dispatchAfter: futureTime,
    });

    assert.equal(ticket.ticket.dispatchAfter, futureTime);
  } finally {
    harness.close();
  }
});

// ============================================================================
// dispatchNext Tests
// ============================================================================

test("dispatchNext returns no_ticket when no dispatchable tickets exist [execution-dispatch-service]", () => {
  const harness = createDispatchServiceHarness();
  try {
    const decision = harness.service.dispatchNext({ leaseTtlMs: 30000 });
    assert.equal(decision.outcome, "no_ticket");
    assert.equal(decision.ticket, null);
    assert.equal(decision.worker, null);
    assert.equal(decision.leaseId, null);
  } finally {
    harness.close();
  }
});

test("dispatchNext dispatches ticket to eligible worker [execution-dispatch-service]", () => {
  const harness = createDispatchServiceHarness();
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    seedTaskAndExecution(harness.store, harness.db, { taskId, executionId });
    registerWorker(harness.workerRegistry, { workerId: "worker-1" });

    harness.service.createTicket({ executionId });
    const decision = harness.service.dispatchNext({ leaseTtlMs: 30000 });

    assert.equal(decision.outcome, "dispatched");
    assert.ok(decision.ticket);
    assert.equal(decision.ticket.status, "claimed");
    assert.equal(decision.worker?.workerId, "worker-1");
    assert.ok(decision.leaseId);
    assert.ok(decision.trace);
    assert.equal(decision.trace?.outcome, "dispatched");
  } finally {
    harness.close();
  }
});

test("dispatchNext selects worker based on load balancing score [execution-dispatch-service]", () => {
  const harness = createDispatchServiceHarness();
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    seedTaskAndExecution(harness.store, harness.db, { taskId, executionId });

    registerWorker(harness.workerRegistry, {
      workerId: "worker-high-load",
      maxConcurrency: 4,
      activeLeaseCount: 3,
      runningExecutionIds: ["exec-1", "exec-2", "exec-3"],
      saturation: 0.9,
      toolBacklogCount: 15,
    });
    registerWorker(harness.workerRegistry, {
      workerId: "worker-low-load",
      maxConcurrency: 4,
      activeLeaseCount: 1,
      runningExecutionIds: ["exec-4"],
      saturation: 0.1,
      toolBacklogCount: 1,
    });

    harness.service.createTicket({ executionId });
    const decision = harness.service.dispatchNext({ leaseTtlMs: 30000 });

    assert.equal(decision.outcome, "dispatched");
    assert.equal(decision.worker?.workerId, "worker-low-load");
    const highLoad = decision.trace?.evaluations.find((item) => item.workerId === "worker-high-load");
    const lowLoad = decision.trace?.evaluations.find((item) => item.workerId === "worker-low-load");
    assert.ok(highLoad && lowLoad);
    assert.ok((lowLoad.dispatchScore ?? Number.NEGATIVE_INFINITY) > (highLoad.dispatchScore ?? Number.NEGATIVE_INFINITY));
  } finally {
    harness.close();
  }
});

test("dispatchNext applies queue affinity bonus [execution-dispatch-service]", () => {
  const harness = createDispatchServiceHarness();
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    seedTaskAndExecution(harness.store, harness.db, { taskId, executionId });

    // Worker with matching queue affinity
    registerWorker(harness.workerRegistry, {
      workerId: "worker-other-queue",
      maxConcurrency: 4,
      queueAffinity: "other-queue",
    });
    registerWorker(harness.workerRegistry, {
      workerId: "worker-default-queue",
      maxConcurrency: 4,
      queueAffinity: "default",
    });

    harness.service.createTicket({
      executionId,
      queueName: "default",
    });
    const decision = harness.service.dispatchNext({
      leaseTtlMs: 30000,
      queueName: "default",
    });

    assert.equal(decision.outcome, "dispatched");
    assert.equal(decision.worker?.workerId, "worker-default-queue");
  } finally {
    harness.close();
  }
});

test("dispatchNext filters workers by required capabilities [execution-dispatch-service]", () => {
  const harness = createDispatchServiceHarness();
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    seedTaskAndExecution(harness.store, harness.db, { taskId, executionId });

    registerWorker(harness.workerRegistry, {
      workerId: "worker-bash-only",
      capabilities: ["bash"],
    });
    registerWorker(harness.workerRegistry, {
      workerId: "worker-full",
      capabilities: ["bash", "edit", "python"],
    });

    harness.service.createTicket({
      executionId,
      requiredCapabilities: ["python"],
    });
    const decision = harness.service.dispatchNext({ leaseTtlMs: 30000 });

    assert.equal(decision.outcome, "dispatched");
    assert.equal(decision.worker?.workerId, "worker-full");
  } finally {
    harness.close();
  }
});

test("dispatchNext blocks when no worker meets required capabilities [execution-dispatch-service]", () => {
  const harness = createDispatchServiceHarness();
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    seedTaskAndExecution(harness.store, harness.db, { taskId, executionId });

    registerWorker(harness.workerRegistry, {
      workerId: "worker-bash-only",
      capabilities: ["bash"],
    });

    harness.service.createTicket({
      executionId,
      requiredCapabilities: ["python", "rust"],
    });
    const decision = harness.service.dispatchNext({ leaseTtlMs: 30000 });

    assert.equal(decision.outcome, "no_worker");
    assert.ok(decision.trace);
    assert.ok(decision.trace?.evaluations.some(
      (e) => e.workerId === "worker-bash-only" && e.rejectionReason === "missing_capabilities",
    ));
  } finally {
    harness.close();
  }
});

test("dispatchNext rejects unavailable workers [execution-dispatch-service]", () => {
  const harness = createDispatchServiceHarness();
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    seedTaskAndExecution(harness.store, harness.db, { taskId, executionId });

    registerWorker(harness.workerRegistry, {
      workerId: "worker-offline",
      status: "offline",
    });

    harness.service.createTicket({ executionId });
    const decision = harness.service.dispatchNext({ leaseTtlMs: 30000 });

    assert.equal(decision.outcome, "no_worker");
    assert.ok(decision.trace?.evaluations.some(
      (e) => e.workerId === "worker-offline" && e.rejectionReason === "worker_offline",
    ));
  } finally {
    harness.close();
  }
});

test("dispatchNext filters degraded workers by default [execution-dispatch-service]", () => {
  const harness = createDispatchServiceHarness();
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    seedTaskAndExecution(harness.store, harness.db, { taskId, executionId });

    registerWorker(harness.workerRegistry, {
      workerId: "worker-degraded",
      status: "degraded",
    });

    harness.service.createTicket({ executionId });
    const decision = harness.service.dispatchNext({ leaseTtlMs: 30000 });

    assert.equal(decision.outcome, "no_worker");
    assert.ok(decision.trace?.evaluations.some(
      (e) => e.workerId === "worker-degraded" && e.rejectionReason === "worker_degraded_filtered",
    ));
  } finally {
    harness.close();
  }
});

test("dispatchNext includes degraded workers when includeDegraded is true [execution-dispatch-service]", () => {
  const harness = createDispatchServiceHarness();
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    seedTaskAndExecution(harness.store, harness.db, { taskId, executionId });

    registerWorker(harness.workerRegistry, {
      workerId: "worker-degraded",
      status: "degraded",
    });

    harness.service.createTicket({ executionId });
    const decision = harness.service.dispatchNext({
      leaseTtlMs: 30000,
      includeDegraded: true,
    });

    assert.equal(decision.outcome, "dispatched");
    assert.equal(decision.worker?.workerId, "worker-degraded");
  } finally {
    harness.close();
  }
});

test("dispatchNext rejects workers at capacity [execution-dispatch-service]", () => {
  const harness = createDispatchServiceHarness();
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    seedTaskAndExecution(harness.store, harness.db, { taskId, executionId });

    registerWorker(harness.workerRegistry, {
      workerId: "worker-full",
      maxConcurrency: 2,
      runningExecutionIds: ["exec-1", "exec-2"],
      activeLeaseCount: 2,
    });

    harness.service.createTicket({ executionId });
    const decision = harness.service.dispatchNext({ leaseTtlMs: 30000 });

    assert.equal(decision.outcome, "no_worker");
    assert.ok(decision.trace?.evaluations.some(
      (e) => e.workerId === "worker-full" && e.rejectionReason === "worker_capacity_full",
    ));
  } finally {
    harness.close();
  }
});

test("dispatchNext enforces isolation level requirements [execution-dispatch-service]", () => {
  const harness = createDispatchServiceHarness();
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    seedTaskAndExecution(harness.store, harness.db, { taskId, executionId });

    registerWorker(harness.workerRegistry, {
      workerId: "worker-standard",
      isolationLevel: "standard",
    });
    registerWorker(harness.workerRegistry, {
      workerId: "worker-strict",
      isolationLevel: "strict",
    });

    harness.service.createTicket({
      executionId,
      requiredIsolationLevel: "strict",
    });
    const decision = harness.service.dispatchNext({ leaseTtlMs: 30000 });

    assert.equal(decision.outcome, "dispatched");
    assert.equal(decision.worker?.workerId, "worker-strict");
  } finally {
    harness.close();
  }
});

test("dispatchNext blocks on backpressure with read_only_operations_only [execution-dispatch-service]", () => {
  const harness = createDispatchServiceHarness();
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    seedTaskAndExecution(harness.store, harness.db, { taskId, executionId });
    registerWorker(harness.workerRegistry, { workerId: "worker-1" });

    harness.service.createTicket({ executionId });

    const serviceWithBackpressure = new ExecutionDispatchService(
      harness.db,
      harness.store,
      () => ({
        status: "unhealthy",
        degradationMode: "read_only_operations_only",
        queueGovernance: {
          backlogSize: 0,
          dispatchableBacklogSize: 0,
          claimedBacklogSize: 0,
          oldestWaitSeconds: null,
          oldestClaimAgeSeconds: null,
          queueNames: [],
          starvationDetected: false,
        },
        findings: ["db_not_writable"],
      }),
    );

    const decision = serviceWithBackpressure.dispatchNext({ leaseTtlMs: 30000 });

    assert.equal(decision.outcome, "blocked");
    assert.equal(decision.reasonCode, "backpressure.read_only_mode");
  } finally {
    harness.close();
  }
});

test("dispatchNext blocks non-critical priority on pause_non_critical backpressure [execution-dispatch-service]", () => {
  const harness = createDispatchServiceHarness();
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    seedTaskAndExecution(harness.store, harness.db, {
      taskId,
      executionId,
      priority: "normal",
    });
    registerWorker(harness.workerRegistry, { workerId: "worker-1" });

    harness.service.createTicket({ executionId, priority: "normal" });

    const serviceWithBackpressure = new ExecutionDispatchService(
      harness.db,
      harness.store,
      () => ({
        status: "overloaded",
        degradationMode: "pause_non_critical",
        queueGovernance: {
          backlogSize: 10,
          dispatchableBacklogSize: 10,
          claimedBacklogSize: 0,
          oldestWaitSeconds: null,
          oldestClaimAgeSeconds: null,
          queueNames: [],
          starvationDetected: false,
        },
        findings: ["tier1_ack_backlog_overloaded"],
      }),
    );

    const decision = serviceWithBackpressure.dispatchNext({ leaseTtlMs: 30000 });

    assert.equal(decision.outcome, "blocked");
    assert.equal(decision.reasonCode, "backpressure.pause_non_critical");
  } finally {
    harness.close();
  }
});

test("dispatchNext allows high priority on pause_non_critical backpressure [execution-dispatch-service]", () => {
  const harness = createDispatchServiceHarness();
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    seedTaskAndExecution(harness.store, harness.db, { taskId, executionId });
    registerWorker(harness.workerRegistry, { workerId: "worker-1" });

    harness.service.createTicket({ executionId, priority: "high" });

    const serviceWithBackpressure = new ExecutionDispatchService(
      harness.db,
      harness.store,
      () => ({
        status: "overloaded",
        degradationMode: "pause_non_critical",
        queueGovernance: {
          backlogSize: 10,
          dispatchableBacklogSize: 10,
          claimedBacklogSize: 0,
          oldestWaitSeconds: null,
          oldestClaimAgeSeconds: null,
          queueNames: [],
          starvationDetected: false,
        },
        findings: ["tier1_ack_backlog_overloaded"],
      }),
    );

    const decision = serviceWithBackpressure.dispatchNext({ leaseTtlMs: 30000 });

    assert.equal(decision.outcome, "dispatched");
  } finally {
    harness.close();
  }
});

test("dispatchNext blocks on queue unavailability [execution-dispatch-service]", () => {
  const harness = createDispatchServiceHarness();
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    seedTaskAndExecution(harness.store, harness.db, { taskId, executionId });
    registerWorker(harness.workerRegistry, { workerId: "worker-1" });

    harness.service.createTicket({ executionId });

    const serviceWithQueueUnavailable = new ExecutionDispatchService(
      harness.db,
      harness.store,
      null,
      () => ({ state: "unavailable", reasonCode: "queue_shutdown" }),
    );

    const decision = serviceWithQueueUnavailable.dispatchNext({ leaseTtlMs: 30000 });

    assert.equal(decision.outcome, "blocked");
    assert.equal(decision.reasonCode, "queue_shutdown");
  } finally {
    harness.close();
  }
});

test("dispatchNext prefers specified worker when preferredWorkerId is set [execution-dispatch-service]", () => {
  const harness = createDispatchServiceHarness();
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    seedTaskAndExecution(harness.store, harness.db, { taskId, executionId });

    registerWorker(harness.workerRegistry, {
      workerId: "worker-preferred",
      maxConcurrency: 4,
    });
    registerWorker(harness.workerRegistry, {
      workerId: "worker-other",
      maxConcurrency: 4,
    });

    harness.service.createTicket({ executionId });
    const decision = harness.service.dispatchNext({
      leaseTtlMs: 30000,
      preferredWorkerId: "worker-preferred",
    });

    assert.equal(decision.outcome, "dispatched");
    assert.equal(decision.worker?.workerId, "worker-preferred");
  } finally {
    harness.close();
  }
});

test("dispatchNext blocks when preferred worker is not eligible [execution-dispatch-service]", () => {
  const harness = createDispatchServiceHarness();
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    seedTaskAndExecution(harness.store, harness.db, { taskId, executionId });

    registerWorker(harness.workerRegistry, {
      workerId: "worker-offline",
      status: "offline",
    });

    harness.service.createTicket({ executionId });
    const decision = harness.service.dispatchNext({
      leaseTtlMs: 30000,
      preferredWorkerId: "worker-offline",
    });

    assert.equal(decision.outcome, "no_worker");
  } finally {
    harness.close();
  }
});

// ============================================================================
// Dispatch Target Tests
// ============================================================================

test("dispatchNext enforces local_only placement [execution-dispatch-service]", () => {
  const harness = createDispatchServiceHarness();
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    seedTaskAndExecution(harness.store, harness.db, { taskId, executionId });

    registerWorker(harness.workerRegistry, {
      workerId: "worker-remote",
      placement: "remote",
      registrationVerifiedAt: nowIso(),
    });
    registerWorker(harness.workerRegistry, {
      workerId: "worker-local",
      placement: "local",
    });

    harness.service.createTicket({
      executionId,
      dispatchTarget: "local_only",
    });
    const decision = harness.service.dispatchNext({ leaseTtlMs: 30000 });

    assert.equal(decision.outcome, "dispatched");
    assert.equal(decision.worker?.workerId, "worker-local");
    assert.equal(decision.worker?.placement, "local");
  } finally {
    harness.close();
  }
});

test("dispatchNext blocks for require_remote when no remote workers exist [execution-dispatch-service]", () => {
  const harness = createDispatchServiceHarness();
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    seedTaskAndExecution(harness.store, harness.db, { taskId, executionId });

    registerWorker(harness.workerRegistry, {
      workerId: "worker-local",
      placement: "local",
    });

    harness.service.createTicket({
      executionId,
      dispatchTarget: "require_remote",
    });
    const decision = harness.service.dispatchNext({ leaseTtlMs: 30000 });

    assert.equal(decision.outcome, "blocked");
    assert.equal(decision.reasonCode, "remote.unavailable");
  } finally {
    harness.close();
  }
});

test("dispatchNext prefer_remote selects remote worker when available [execution-dispatch-service]", () => {
  const harness = createDispatchServiceHarness();
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    seedTaskAndExecution(harness.store, harness.db, { taskId, executionId });

    registerWorker(harness.workerRegistry, { workerId: "worker-local", placement: "local" });
    registerWorker(harness.workerRegistry, {
      workerId: "worker-remote",
      placement: "remote",
      registrationVerifiedAt: nowIso(),
    });

    harness.service.createTicket({
      executionId,
      dispatchTarget: "prefer_remote",
    });
    const decision = harness.service.dispatchNext({ leaseTtlMs: 30000 });

    assert.equal(decision.outcome, "dispatched");
    assert.equal(decision.worker?.workerId, "worker-remote");
    assert.equal(decision.reasonCode, null);
  } finally {
    harness.close();
  }
});

test("dispatchNext prefer_remote falls back to local when no remote workers [execution-dispatch-service]", () => {
  const harness = createDispatchServiceHarness();
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    seedTaskAndExecution(harness.store, harness.db, { taskId, executionId });

    registerWorker(harness.workerRegistry, { workerId: "worker-local", placement: "local" });

    harness.service.createTicket({
      executionId,
      dispatchTarget: "prefer_remote",
    });
    const decision = harness.service.dispatchNext({ leaseTtlMs: 30000 });

    assert.equal(decision.outcome, "dispatched");
    assert.equal(decision.worker?.workerId, "worker-local");
    assert.equal(decision.reasonCode, "remote.fallback_local.unavailable");
    assert.equal(decision.trace?.remoteAvailability, "unavailable");
  } finally {
    harness.close();
  }
});

// ============================================================================
// Remote Worker Trust/Session Tests
// ============================================================================

test("dispatchNext rejects untrusted remote workers [execution-dispatch-service]", () => {
  const harness = createDispatchServiceHarness();
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    seedTaskAndExecution(harness.store, harness.db, { taskId, executionId });

    registerWorker(harness.workerRegistry, {
      workerId: "worker-remote-untrusted",
      placement: "remote",
      registrationVerifiedAt: null,
    });

    harness.service.createTicket({
      executionId,
      dispatchTarget: "require_remote",
    });
    const decision = harness.service.dispatchNext({ leaseTtlMs: 30000 });

    assert.equal(decision.outcome, "blocked");
    assert.equal(decision.reasonCode, "remote.untrusted");
    assert.ok(decision.trace?.evaluations.some(
      (item) => item.workerId === "worker-remote-untrusted" && item.rejectionReason === "worker_untrusted",
    ));
  } finally {
    harness.close();
  }
});

test("dispatchNext rejects remote worker with viewer_only session [execution-dispatch-service]", () => {
  const harness = createDispatchServiceHarness();
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    seedTaskAndExecution(harness.store, harness.db, { taskId, executionId });

    registerWorker(harness.workerRegistry, {
      workerId: "worker-remote-viewer-only",
      placement: "remote",
      remoteSessionStatus: "viewer_only",
      lastAcknowledgedStreamOffset: "stream:50",
    });

    harness.service.createTicket({
      executionId,
      dispatchTarget: "require_remote",
    });
    const decision = harness.service.dispatchNext({ leaseTtlMs: 30000 });

    assert.equal(decision.outcome, "blocked");
    assert.equal(decision.reasonCode, "remote.session_unready");
    assert.ok(decision.trace?.evaluations.some(
      (item) =>
        item.workerId === "worker-remote-viewer-only"
        && item.rejectionReason === "worker_remote_session_unready"
        && item.remoteSessionStatus === "viewer_only",
    ));
  } finally {
    harness.close();
  }
});

test("dispatchNext rejects remote worker with session consistency mismatch [execution-dispatch-service]", () => {
  const harness = createDispatchServiceHarness();
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    seedTaskAndExecution(harness.store, harness.db, { taskId, executionId });

    registerWorker(harness.workerRegistry, {
      workerId: "worker-remote-mismatch",
      placement: "remote",
      remoteSessionStatus: "connected",
      lastAcknowledgedStreamOffset: "stream:61",
      sessionConsistencyCheckStatus: "mismatch",
    });

    harness.service.createTicket({
      executionId,
      dispatchTarget: "require_remote",
    });
    const decision = harness.service.dispatchNext({ leaseTtlMs: 30000 });

    assert.equal(decision.outcome, "blocked");
    assert.equal(decision.reasonCode, "remote.session_unready");
    assert.ok(decision.trace?.evaluations.some(
      (item) =>
        item.workerId === "worker-remote-mismatch"
        && item.rejectionReason === "worker_remote_session_unready"
        && item.sessionConsistencyCheckStatus === "mismatch",
    ));
  } finally {
    harness.close();
  }
});

test("dispatchNext rejects remote worker with workspace sync conflict [execution-dispatch-service]", () => {
  const harness = createDispatchServiceHarness();
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    seedTaskAndExecution(harness.store, harness.db, { taskId, executionId });

    registerWorker(harness.workerRegistry, {
      workerId: "worker-remote-workspace-conflict",
      placement: "remote",
      remoteSessionStatus: "connected",
      lastAcknowledgedStreamOffset: "stream:71",
      workspaceSyncStatus: "conflict",
    });

    harness.service.createTicket({
      executionId,
      dispatchTarget: "require_remote",
    });
    const decision = harness.service.dispatchNext({ leaseTtlMs: 30000 });

    assert.equal(decision.outcome, "blocked");
    assert.equal(decision.reasonCode, "remote.session_unready");
    assert.ok(decision.trace?.evaluations.some(
      (item) =>
        item.workerId === "worker-remote-workspace-conflict"
        && item.rejectionReason === "worker_remote_session_unready"
        && item.workspaceSyncStatus === "conflict",
    ));
  } finally {
    harness.close();
  }
});

test("dispatchNext rejects remote worker missing lastAcknowledgedStreamOffset [execution-dispatch-service]", () => {
  const harness = createDispatchServiceHarness();
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    seedTaskAndExecution(harness.store, harness.db, { taskId, executionId });

    registerWorker(harness.workerRegistry, {
      workerId: "worker-remote-offset-missing",
      placement: "remote",
      remoteSessionStatus: "connected",
      lastAcknowledgedStreamOffset: "",
    });

    harness.service.createTicket({
      executionId,
      dispatchTarget: "require_remote",
    });
    const decision = harness.service.dispatchNext({ leaseTtlMs: 30000 });

    assert.equal(decision.outcome, "blocked");
    assert.equal(decision.reasonCode, "remote.session_unready");
    assert.ok(decision.trace?.evaluations.some(
      (item) =>
        item.workerId === "worker-remote-offset-missing"
        && item.rejectionReason === "worker_remote_session_unready"
        && item.lastAcknowledgedStreamOffset === "",
    ));
  } finally {
    harness.close();
  }
});

// ============================================================================
// Repository Version Mismatch Tests
// ============================================================================

test("dispatchNext blocks on repo version mismatch [execution-dispatch-service]", () => {
  const harness = createDispatchServiceHarness();
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    seedTaskAndExecution(harness.store, harness.db, { taskId, executionId });

    registerWorker(harness.workerRegistry, {
      workerId: "worker-old-repo",
      repoVersion: "v1.0.0",
    });
    registerWorker(harness.workerRegistry, {
      workerId: "worker-new-repo",
      repoVersion: "v2.0.0",
    });

    harness.service.createTicket({
      executionId,
      requiredRepoVersion: "v2.0.0",
    });
    const decision = harness.service.dispatchNext({ leaseTtlMs: 30000 });

    assert.equal(decision.outcome, "dispatched");
    assert.equal(decision.worker?.workerId, "worker-new-repo");
  } finally {
    harness.close();
  }
});

test("dispatchNext require_remote blocks on repo version mismatch with all remotes [execution-dispatch-service]", () => {
  const harness = createDispatchServiceHarness();
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    seedTaskAndExecution(harness.store, harness.db, { taskId, executionId });

    registerWorker(harness.workerRegistry, {
      workerId: "worker-remote-old",
      placement: "remote",
      repoVersion: "v1.0.0",
      registrationVerifiedAt: nowIso(),
    });

    harness.service.createTicket({
      executionId,
      dispatchTarget: "require_remote",
      requiredRepoVersion: "v2.0.0",
    });
    const decision = harness.service.dispatchNext({ leaseTtlMs: 30000 });

    assert.equal(decision.outcome, "blocked");
    assert.equal(decision.reasonCode, "remote.repo_version_mismatch");
  } finally {
    harness.close();
  }
});

// ============================================================================
// Worker Status Filtering Tests
// ============================================================================

test("dispatchNext filters out quarantined workers [execution-dispatch-service]", () => {
  const harness = createDispatchServiceHarness();
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    seedTaskAndExecution(harness.store, harness.db, { taskId, executionId });

    registerWorker(harness.workerRegistry, {
      workerId: "worker-quarantined",
      status: "quarantined",
    });

    harness.service.createTicket({ executionId });
    const decision = harness.service.dispatchNext({ leaseTtlMs: 30000 });

    assert.equal(decision.outcome, "no_worker");
    assert.ok(decision.trace?.evaluations.some(
      (e) => e.workerId === "worker-quarantined" && e.rejectionReason === "worker_quarantined",
    ));
  } finally {
    harness.close();
  }
});

test("dispatchNext filters out draining workers [execution-dispatch-service]", () => {
  const harness = createDispatchServiceHarness();
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    seedTaskAndExecution(harness.store, harness.db, { taskId, executionId });

    registerWorker(harness.workerRegistry, {
      workerId: "worker-draining",
      status: "draining",
    });

    harness.service.createTicket({ executionId });
    const decision = harness.service.dispatchNext({ leaseTtlMs: 30000 });

    assert.equal(decision.outcome, "no_worker");
    assert.ok(decision.trace?.evaluations.some(
      (e) => e.workerId === "worker-draining" && e.rejectionReason === "worker_draining",
    ));
  } finally {
    harness.close();
  }
});

test("dispatchNext picks idle worker over busy worker with same capacity [execution-dispatch-service]", () => {
  const harness = createDispatchServiceHarness();
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    seedTaskAndExecution(harness.store, harness.db, { taskId, executionId });

    registerWorker(harness.workerRegistry, {
      workerId: "worker-busy",
      status: "busy",
      maxConcurrency: 4,
      runningExecutionIds: ["exec-other"],
    });
    registerWorker(harness.workerRegistry, {
      workerId: "worker-idle",
      status: "idle",
      maxConcurrency: 4,
      runningExecutionIds: [],
    });

    harness.service.createTicket({ executionId });
    const decision = harness.service.dispatchNext({ leaseTtlMs: 30000 });

    assert.equal(decision.outcome, "dispatched");
    assert.equal(decision.worker?.workerId, "worker-idle");
  } finally {
    harness.close();
  }
});

// ============================================================================
// Queue Affinity Tests
// ============================================================================

test("dispatchNext rejects workers with mismatched queue affinity [execution-dispatch-service]", () => {
  const harness = createDispatchServiceHarness();
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    seedTaskAndExecution(harness.store, harness.db, { taskId, executionId });

    registerWorker(harness.workerRegistry, {
      workerId: "worker-mismatch",
      queueAffinity: "queue-a",
    });

    harness.service.createTicket({
      executionId,
      queueName: "queue-b",
    });
    const decision = harness.service.dispatchNext({ leaseTtlMs: 30000 });

    assert.equal(decision.outcome, "no_worker");
    assert.ok(decision.trace?.evaluations.some(
      (e) => e.workerId === "worker-mismatch" && e.rejectionReason === "queue_affinity_mismatch",
    ));
  } finally {
    harness.close();
  }
});

test("dispatchNext ignores queue affinity when ticket has no queue [execution-dispatch-service]", () => {
  const harness = createDispatchServiceHarness();
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    seedTaskAndExecution(harness.store, harness.db, { taskId, executionId });

    registerWorker(harness.workerRegistry, {
      workerId: "worker-queue-affinity",
      queueAffinity: "some-queue",
      maxConcurrency: 4,
    });

    harness.service.createTicket({ executionId }); // No queue specified
    const decision = harness.service.dispatchNext({ leaseTtlMs: 30000 });

    assert.equal(decision.outcome, "dispatched");
    assert.equal(decision.worker?.workerId, "worker-queue-affinity");
  } finally {
    harness.close();
  }
});

// ============================================================================
// Lease Acquisition Failure Tests
// ============================================================================

test("dispatchNext retries next ticket when lease acquisition fails [execution-dispatch-service]", () => {
  const harness = createDispatchServiceHarness();
  try {
    const blockedTaskId = newId("task");
    const blockedExecutionId = newId("exec");
    const nextTaskId = newId("task");
    const nextExecutionId = newId("exec");

    seedTaskAndExecution(harness.store, harness.db, { taskId: blockedTaskId, executionId: blockedExecutionId });
    seedTaskAndExecution(harness.store, harness.db, { taskId: nextTaskId, executionId: nextExecutionId });
    registerWorker(harness.workerRegistry, { workerId: "worker-1" });

    createActiveLease(harness.store, harness.db, {
      leaseId: newId("lease"),
      executionId: blockedExecutionId,
      workerId: "worker-existing",
    });

    harness.service.createTicket({ executionId: blockedExecutionId, priority: "urgent" });
    harness.service.createTicket({ executionId: nextExecutionId, priority: "normal" });

    const decision = harness.service.dispatchNext({ leaseTtlMs: 30000 });

    assert.equal(decision.outcome, "dispatched");
    assert.equal(decision.ticket?.executionId, nextExecutionId);
    assert.equal(decision.worker?.workerId, "worker-1");
  } finally {
    harness.close();
  }
});

test("dispatchNext blocks when active lease already exists for execution [execution-dispatch-service]", () => {
  const harness = createDispatchServiceHarness();
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    seedTaskAndExecution(harness.store, harness.db, { taskId, executionId });
    registerWorker(harness.workerRegistry, { workerId: "worker-1" });

    createActiveLease(harness.store, harness.db, {
      leaseId: newId("lease"),
      executionId,
      workerId: "worker-existing",
    });
    harness.service.createTicket({ executionId });

    const decision = harness.service.dispatchNext({ leaseTtlMs: 30000 });

    assert.equal(decision.outcome, "blocked");
    assert.equal(decision.reasonCode, "active_lease_exists");
    assert.equal(decision.ticket?.status, "pending");
  } finally {
    harness.close();
  }
});

// ============================================================================
// Multiple Ticket Priority Ordering Tests
// ============================================================================

test("dispatchNext processes tickets in priority order [execution-dispatch-service]", () => {
  const harness = createDispatchServiceHarness();
  try {
    const taskIdLow = newId("task");
    const executionIdLow = newId("exec");
    const taskIdUrgent = newId("task");
    const executionIdUrgent = newId("exec");

    seedTaskAndExecution(harness.store, harness.db, {
      taskId: taskIdLow,
      executionId: executionIdLow,
      priority: "low",
    });
    seedTaskAndExecution(harness.store, harness.db, {
      taskId: taskIdUrgent,
      executionId: executionIdUrgent,
      priority: "urgent",
    });

    registerWorker(harness.workerRegistry, {
      workerId: "worker-1",
      maxConcurrency: 1,
    });

    harness.service.createTicket({ executionId: executionIdLow, priority: "low" });
    harness.service.createTicket({ executionId: executionIdUrgent, priority: "urgent" });

    // Urgent should be dispatched first
    const decision = harness.service.dispatchNext({ leaseTtlMs: 30000 });
    assert.equal(decision.outcome, "dispatched");
    assert.equal(decision.ticket?.executionId, executionIdUrgent);
  } finally {
    harness.close();
  }
});

test("dispatchNext skips blocked tickets and processes next [execution-dispatch-service]", () => {
  const harness = createDispatchServiceHarness();
  try {
    const blockedTaskId = newId("task");
    const blockedExecutionId = newId("exec");
    const nextTaskId = newId("task");
    const nextExecutionId = newId("exec");

    seedTaskAndExecution(harness.store, harness.db, { taskId: blockedTaskId, executionId: blockedExecutionId });
    seedTaskAndExecution(harness.store, harness.db, { taskId: nextTaskId, executionId: nextExecutionId });
    registerWorker(harness.workerRegistry, { workerId: "worker-local", placement: "local" });

    harness.service.createTicket({
      executionId: blockedExecutionId,
      dispatchTarget: "require_remote",
      priority: "urgent",
    });
    harness.service.createTicket({
      executionId: nextExecutionId,
      priority: "normal",
    });

    const decision = harness.service.dispatchNext({ leaseTtlMs: 30000 });

    assert.equal(decision.outcome, "dispatched");
    assert.equal(decision.ticket?.executionId, nextExecutionId);
    assert.equal(decision.worker?.workerId, "worker-local");
  } finally {
    harness.close();
  }
});

// ============================================================================
// Remote Availability Resolution Tests
// ============================================================================

test("dispatchNext reports remote availability as degraded when workers filtered [execution-dispatch-service]", () => {
  const harness = createDispatchServiceHarness();
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    seedTaskAndExecution(harness.store, harness.db, { taskId, executionId });

    registerWorker(harness.workerRegistry, {
      workerId: "worker-remote-degraded",
      placement: "remote",
      status: "degraded",
    });

    harness.service.createTicket({
      executionId,
      dispatchTarget: "require_remote",
    });
    const decision = harness.service.dispatchNext({ leaseTtlMs: 30000 });

    assert.equal(decision.outcome, "blocked");
    assert.equal(decision.reasonCode, "remote.degraded");
    assert.equal(decision.trace?.remoteAvailability, "degraded");
  } finally {
    harness.close();
  }
});

test("dispatchNext reports remote availability as unavailable when all remote workers unavailable [execution-dispatch-service]", () => {
  const harness = createDispatchServiceHarness();
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    seedTaskAndExecution(harness.store, harness.db, { taskId, executionId });

    registerWorker(harness.workerRegistry, {
      workerId: "worker-remote-offline",
      placement: "remote",
      status: "offline",
    });

    harness.service.createTicket({
      executionId,
      dispatchTarget: "require_remote",
    });
    const decision = harness.service.dispatchNext({ leaseTtlMs: 30000 });

    assert.equal(decision.outcome, "blocked");
    assert.equal(decision.reasonCode, "remote.unavailable");
    assert.equal(decision.trace?.remoteAvailability, "unavailable");
  } finally {
    harness.close();
  }
});

// ============================================================================
// Decision Trace Tests
// ============================================================================

test("dispatchNext records evaluation traces with correct acceptance status [execution-dispatch-service]", () => {
  const harness = createDispatchServiceHarness();
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    seedTaskAndExecution(harness.store, harness.db, { taskId, executionId });

    registerWorker(harness.workerRegistry, {
      workerId: "worker-accepted",
      capabilities: ["bash"],
    });
    registerWorker(harness.workerRegistry, {
      workerId: "worker-rejected",
      capabilities: [], // Missing required bash
    });

    harness.service.createTicket({
      executionId,
      requiredCapabilities: ["bash"],
    });
    const decision = harness.service.dispatchNext({ leaseTtlMs: 30000 });

    assert.ok(decision.trace);
    const accepted = decision.trace!.evaluations.filter((e) => e.accepted);
    const rejected = decision.trace!.evaluations.filter((e) => !e.accepted);

    assert.equal(accepted.length, 1);
    assert.equal(accepted[0]!.workerId, "worker-accepted");
    assert.equal(rejected.length, 1);
    assert.equal(rejected[0]!.workerId, "worker-rejected");
    assert.equal(rejected[0]!.rejectionReason, "missing_capabilities");
  } finally {
    harness.close();
  }
});

test("dispatchNext records dispatch_claimed event on successful dispatch [execution-dispatch-service]", () => {
  const harness = createDispatchServiceHarness();
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    seedTaskAndExecution(harness.store, harness.db, { taskId, executionId });
    registerWorker(harness.workerRegistry, { workerId: "worker-1" });

    harness.service.createTicket({ executionId });
    harness.service.dispatchNext({ leaseTtlMs: 30000 });

    // Check that events were recorded
    const events = harness.store.listEventsForTask(taskId);
    const claimedEvents = events.filter((e) => e.eventType === "dispatch:ticket_claimed");
    assert.ok(claimedEvents.length >= 1);

    const decisionEvents = events.filter((e) => e.eventType === "dispatch:decision_recorded");
    assert.ok(decisionEvents.length >= 1);
  } finally {
    harness.close();
  }
});

test("dispatchNext records ticket_created event when ticket is created [execution-dispatch-service]", () => {
  const harness = createDispatchServiceHarness();
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    seedTaskAndExecution(harness.store, harness.db, { taskId, executionId });

    harness.service.createTicket({ executionId });

    const events = harness.store.listEventsForTask(taskId);
    const ticketCreatedEvents = events.filter((e) => e.eventType === "dispatch:ticket_created");
    assert.ok(ticketCreatedEvents.length >= 1);
  } finally {
    harness.close();
  }
});

test("createTicket persists the ticket even if tier-2 audit event insertion fails [execution-dispatch-service]", () => {
  const harness = createDispatchServiceHarness();
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    seedTaskAndExecution(harness.store, harness.db, { taskId, executionId });

    const originalInsertEvent = harness.store.event.insertEvent.bind(harness.store.event);
    harness.store.event.insertEvent = ((event) => {
      if (event.eventType === "dispatch:ticket_created") {
        throw new Error("simulated event sink failure");
      }
      return originalInsertEvent(event);
    }) as typeof harness.store.event.insertEvent;

    const decision = harness.service.createTicket({ executionId });
    const persisted = harness.store.worker.getActiveExecutionTicket(executionId, 1);

    assert.equal(decision.outcome, "created");
    assert.equal(persisted?.id, decision.ticket.id);
  } finally {
    harness.close();
  }
});

test("dispatchNext keeps the claimed ticket when tier-2 claim audit event insertion fails [execution-dispatch-service]", () => {
  const harness = createDispatchServiceHarness();
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    seedTaskAndExecution(harness.store, harness.db, { taskId, executionId });
    registerWorker(harness.workerRegistry, { workerId: "worker-1" });
    harness.service.createTicket({ executionId });

    const originalInsertEvent = harness.store.event.insertEvent.bind(harness.store.event);
    harness.store.event.insertEvent = ((event) => {
      if (event.eventType === "dispatch:ticket_claimed") {
        throw new Error("simulated event sink failure");
      }
      return originalInsertEvent(event);
    }) as typeof harness.store.event.insertEvent;

    const decision = harness.service.dispatchNext({ leaseTtlMs: 30_000 });
    const persisted = harness.store.worker.getExecutionTicket(decision.ticket!.id);

    assert.equal(decision.outcome, "dispatched");
    assert.equal(persisted?.status, "claimed");
    assert.equal(persisted?.assignedWorkerId, "worker-1");
  } finally {
    harness.close();
  }
});

// ============================================================================
// Load Skew Penalty Tests
// ============================================================================

test("dispatchNext applies load skew penalty to heavily loaded workers [execution-dispatch-service]", () => {
  const harness = createDispatchServiceHarness();
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    seedTaskAndExecution(harness.store, harness.db, { taskId, executionId });

    registerWorker(harness.workerRegistry, {
      workerId: "worker-affinity-hotspot",
      maxConcurrency: 12,
      queueAffinity: "default",
      activeLeaseCount: 9,
      runningExecutionIds: Array.from({ length: 9 }, (_, index) => `exec-hot-${index}`),
      saturation: 0.8,
    });
    registerWorker(harness.workerRegistry, {
      workerId: "worker-general-spare",
      maxConcurrency: 12,
      queueAffinity: "default",
      activeLeaseCount: 1,
      runningExecutionIds: ["exec-spare-1"],
      saturation: 0.1,
    });

    harness.service.createTicket({
      executionId,
      queueName: "default",
    });
    const decision = harness.service.dispatchNext({ leaseTtlMs: 30000 });

    assert.equal(decision.outcome, "dispatched");
    assert.equal(decision.worker?.workerId, "worker-general-spare");
    assert.ok(decision.trace?.evaluations.some(
      (item) =>
        item.workerId === "worker-affinity-hotspot"
        && item.affinityMatched === true
        && item.loadSkewPenaltyApplied === true,
    ));
  } finally {
    harness.close();
  }
});

test("dispatchNext does not apply load skew penalty when no alternative capacity exists [execution-dispatch-service]", () => {
  const harness = createDispatchServiceHarness();
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    seedTaskAndExecution(harness.store, harness.db, { taskId, executionId });

    // Only one worker - should be selected even with high load
    registerWorker(harness.workerRegistry, {
      workerId: "worker-only",
      maxConcurrency: 4,
      runningExecutionIds: ["exec-1", "exec-2"],
      activeLeaseCount: 2,
      saturation: 0.8,
    });

    harness.service.createTicket({ executionId });
    const decision = harness.service.dispatchNext({ leaseTtlMs: 30000 });

    assert.equal(decision.outcome, "dispatched");
    assert.equal(decision.worker?.workerId, "worker-only");
    // Load skew penalty should not be applied since it's the only worker
    assert.equal(decision.trace?.evaluations[0]?.loadSkewPenaltyApplied, false);
  } finally {
    harness.close();
  }
});

// ============================================================================
// dispatchAfter Time-based Filtering Tests
// ============================================================================

test("dispatchNext does not dispatch tickets with future dispatchAfter time [execution-dispatch-service]", () => {
  const harness = createDispatchServiceHarness();
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    seedTaskAndExecution(harness.store, harness.db, { taskId, executionId });
    registerWorker(harness.workerRegistry, { workerId: "worker-1" });

    // Ticket with future dispatch time
    harness.service.createTicket({
      executionId,
      dispatchAfter: "2099-01-01T00:00:00.000Z",
    });

    const decision = harness.service.dispatchNext({
      leaseTtlMs: 30000,
      occurredAt: "2026-04-12T00:00:00.000Z",
    });

    assert.equal(decision.outcome, "no_ticket");
  } finally {
    harness.close();
  }
});

test("dispatchNext dispatches tickets when dispatchAfter time has passed [execution-dispatch-service]", () => {
  const harness = createDispatchServiceHarness();
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    seedTaskAndExecution(harness.store, harness.db, { taskId, executionId });
    registerWorker(harness.workerRegistry, { workerId: "worker-1" });

    harness.service.createTicket({
      executionId,
      dispatchAfter: "2026-04-12T00:00:00.000Z",
    });

    const decision = harness.service.dispatchNext({
      leaseTtlMs: 30000,
      occurredAt: "2026-04-12T00:00:01.000Z",
    });

    assert.equal(decision.outcome, "dispatched");
  } finally {
    harness.close();
  }
});

// ============================================================================
// Execution Ticket Status Transition Tests
// ============================================================================

test("dispatchNext updates ticket status to claimed after successful dispatch [execution-dispatch-service]", () => {
  const harness = createDispatchServiceHarness();
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    seedTaskAndExecution(harness.store, harness.db, { taskId, executionId });
    registerWorker(harness.workerRegistry, { workerId: "worker-1" });

    const { ticket } = harness.service.createTicket({ executionId });
    assert.equal(ticket.status, "pending");

    harness.service.dispatchNext({ leaseTtlMs: 30000 });

    const updatedTicket = harness.store.getExecutionTicket(ticket.id);
    assert.equal(updatedTicket?.status, "claimed");
    assert.equal(updatedTicket?.assignedWorkerId, "worker-1");
    assert.ok(updatedTicket?.leaseId);
    assert.ok(updatedTicket?.claimedAt);
  } finally {
    harness.close();
  }
});

test("createTicket preserves existing ticket status when reusing [execution-dispatch-service]", () => {
  const harness = createDispatchServiceHarness();
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    seedTaskAndExecution(harness.store, harness.db, { taskId, executionId });

    const { ticket } = harness.service.createTicket({ executionId });

    // Simulate the ticket being claimed
    harness.db.transaction(() => {
      harness.store.claimExecutionTicket({
        ticketId: ticket.id,
        assignedWorkerId: "worker-old",
        leaseId: "lease-old",
        claimedAt: nowIso(),
      });
    });

    // Create ticket again - should return existing
    const reused = harness.service.createTicket({ executionId });

    assert.equal(reused.outcome, "exists");
    assert.equal(reused.ticket.id, ticket.id);
    assert.equal(reused.ticket.status, "claimed"); // Status preserved
  } finally {
    harness.close();
  }
});
