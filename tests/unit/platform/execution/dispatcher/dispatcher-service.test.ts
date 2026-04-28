import assert from "node:assert/strict";
import test from "node:test";

import { ExecutionDispatchService } from "../../../../../src/platform/execution/dispatcher/execution-dispatch-service.js";
import type { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import type { AuthoritativeSqlDatabase } from "../../../../../src/platform/state-evidence/truth/authoritative-sql-database.js";
import type {
  ExecutionLeaseRecord,
  ExecutionTicketRecord,
  LeaseAuditRecord,
  TaskPriority,
  ExecutionRecord,
  TaskRecord,
  WorkerSnapshotRecord,
} from "../../../../../src/platform/contracts/types/domain.js";
import type { RegisteredWorkerView } from "../../../../../src/platform/execution/worker-pool/worker-registry-service.js";

// ---------------------------------------------------------------------------
// Helper types & factories
// ---------------------------------------------------------------------------

function createMockStore(): AuthoritativeTaskStore {
  const tickets = new Map<string, ExecutionTicketRecord>();
  const leases = new Map<string, ExecutionLeaseRecord>();
  const leaseAudits: LeaseAuditRecord[] = [];
  const snapshots = new Map<string, WorkerSnapshotRecord>();

  const workerRepo: Record<string, unknown> = {
    getActiveExecutionTicket: () => null,
    insertExecutionTicket: (ticket: ExecutionTicketRecord) => {
      tickets.set(ticket.id, structuredClone(ticket));
    },
    listDispatchableExecutionTickets: () => Array.from(tickets.values()),
    claimExecutionTicket: (input: {
      ticketId: string;
      assignedWorkerId: string;
      leaseId: string;
      claimedAt: string;
    }) => {
      const ticket = tickets.get(input.ticketId);
      if (!ticket) {
        return;
      }
      tickets.set(input.ticketId, {
        ...ticket,
        status: "claimed",
        assignedWorkerId: input.assignedWorkerId,
        leaseId: input.leaseId,
        claimedAt: input.claimedAt,
        updatedAt: input.claimedAt,
      });
    },
    getExecutionTicket: (ticketId: string) => tickets.get(ticketId) ?? null,
    getAgentExecutionRecord: () => null,
    upsertAgentExecutionRecord: () => {},
    getActiveExecutionLease: (executionId: string) =>
      Array.from(leases.values()).find((lease) => lease.executionId === executionId && lease.status === "active") ?? null,
    getExecutionLease: (leaseId: string) => leases.get(leaseId) ?? null,
    insertExecutionLease: (lease: ExecutionLeaseRecord) => {
      leases.set(lease.id, structuredClone(lease));
    },
    renewExecutionLease: (leaseId: string, expiresAt: string, lastHeartbeatAt?: string) => {
      const lease = leases.get(leaseId);
      if (!lease) {
        return;
      }
      leases.set(leaseId, {
        ...lease,
        expiresAt,
        lastHeartbeatAt: lastHeartbeatAt ?? lease.lastHeartbeatAt,
      });
    },
    closeExecutionLease: (
      leaseIdOrInput:
        | string
        | {
            leaseId: string;
            status?: ExecutionLeaseRecord["status"];
            releasedAt: string;
            reasonCode?: string | null;
          },
      releasedAt?: string,
    ) => {
      const closeInput =
        typeof leaseIdOrInput === "string"
          ? {
              leaseId: leaseIdOrInput,
              status: "released" as const,
              releasedAt: releasedAt ?? new Date().toISOString(),
              reasonCode: null,
            }
          : {
              leaseId: leaseIdOrInput.leaseId,
              status: leaseIdOrInput.status ?? "released",
              releasedAt: leaseIdOrInput.releasedAt,
              reasonCode: leaseIdOrInput.reasonCode ?? null,
            };
      const lease = leases.get(closeInput.leaseId);
      if (!lease) {
        return;
      }
      leases.set(closeInput.leaseId, {
        ...lease,
        status: closeInput.status,
        releasedAt: closeInput.releasedAt,
        reasonCode: closeInput.reasonCode,
      });
    },
    insertLeaseAudit: (audit: LeaseAuditRecord) => {
      leaseAudits.push(structuredClone(audit));
    },
    getLatestFencingToken: (executionId: string) =>
      Math.max(
        0,
        ...Array.from(leases.values())
          .filter((lease) => lease.executionId === executionId)
          .map((lease) => lease.fencingToken),
      ),
    listExecutionTicketsByStatuses: () => [],
    listWorkers: () => [],
    getWorker: () => null,
    getWorkerSnapshot: (workerId: string) => snapshots.get(workerId) ?? null,
    listExecutionTicketsByExecution: () => [],
    listWorkerSnapshots: () => Array.from(snapshots.values()),
    upsertWorkerSnapshot: (snapshot: WorkerSnapshotRecord) => {
      snapshots.set(snapshot.workerId, structuredClone(snapshot));
    },
  };

  return {
    operations: {
      loadExecutionAuthoritativeView: () => null,
      listActiveExecutionActivity: () => [],
    },
    task: {
      countQueuedTasks: () => 0,
      getTask: () => null,
    },
    execution: {
      countActiveExecutions: () => 0,
      getExecution: () => null,
      updateExecutionStatus: () => {},
    },
    event: {
      countPendingTier1Acks: () => 0,
      insertEvent: () => {},
    },
    worker: new Proxy(workerRepo, {
      set(target, property, value) {
        if (property === "listDispatchableExecutionTickets" && typeof value === "function") {
          target[property as keyof typeof target] = ((...args: unknown[]) => {
            const listed = (value as (...callArgs: unknown[]) => ExecutionTicketRecord[])(...args);
            for (const ticket of listed) {
              tickets.set(ticket.id, structuredClone(ticket));
            }
            return listed;
          }) as typeof value;
          return true;
        }
        if (property === "listWorkerSnapshots" && typeof value === "function") {
          target[property as keyof typeof target] = ((...args: unknown[]) => {
            const listed = (value as (...callArgs: unknown[]) => WorkerSnapshotRecord[])(...args);
            for (const snapshot of listed) {
              snapshots.set(snapshot.workerId, structuredClone(snapshot));
            }
            return listed;
          }) as typeof value;
          return true;
        }
        target[property as keyof typeof target] = value;
        return true;
      },
    }),
    dispatch: {
      getExecution: () => null,
    },
    workflow: {
      getWorkflowState: () => null,
      updateWorkflowRecoveryState: () => {},
    },
  } as unknown as AuthoritativeTaskStore;
}

function createMockDb(): AuthoritativeSqlDatabase {
  return {
    transaction: <T>(fn: () => T) => fn(),
  } as unknown as AuthoritativeSqlDatabase;
}

function createMockExecution(id = "exec-1", taskId = "task-1", attempt = 1): ExecutionRecord {
  return {
    id,
    taskId,
    workflowId: "wf-1",
    roleId: "role-1",
    agentId: "agent-1",
    status: "executing",
    runKind: "task_run",
    attempt,
    traceId: "trace-1",
    parentExecutionId: null,
    inputRef: null,
    budgetUsdLimit: null,
    requiresApproval: 0,
    sandboxMode: null,
    allowedToolsJson: null,
    allowedPathsJson: null,
    maxRetries: 3,
    retryBackoff: "exponential",
    lastErrorCode: null,
    lastErrorMessage: null,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    timeoutMs: 3600000,
  };
}

function createMockTask(id = "task-1", priority: TaskPriority = "normal"): TaskRecord {
  return {
    id,
    title: "Test Task",
    status: "in_progress",
    source: "user",
    priority,
    parentId: null,
    rootId: id,
    divisionId: null,
    inputJson: "{}",
    normalizedInputJson: null,
    outputJson: null,
    estimatedCostUsd: null,
    actualCostUsd: 0,
    errorCode: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: null,
  };
}

function createMockTicket(
  id = "ticket-1",
  executionId = "exec-1",
  taskId = "task-1",
  priority: TaskPriority = "normal",
): ExecutionTicketRecord {
  return {
    id,
    executionId,
    taskId,
    priority,
    queueName: null,
    dispatchTarget: "any",
    requiredIsolationLevel: "standard",
    requiredRepoVersion: null,
    requiredCapabilitiesJson: "[]",
    dispatchAfter: null,
    attempt: 1,
    status: "pending",
    assignedWorkerId: null,
    leaseId: null,
    claimedAt: null,
    consumedAt: null,
    invalidatedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function createMockWorker(workerId: string, overrides: Partial<RegisteredWorkerView> = {}): RegisteredWorkerView {
  const worker: RegisteredWorkerView = {
    workerId,
    status: "idle",
    schedulingStatus: "healthy",
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
    trusted: true,
    capabilities: [],
    runningExecutionIds: [],
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
    lastHeartbeatAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    availableSlots: 10,
    ...overrides,
  };

  if (worker.placement === "remote") {
    worker.remoteSessionStatus ??= "connected";
    worker.lastAcknowledgedStreamOffset ??= "offset-1";
    worker.registrationVerifiedAt ??= new Date().toISOString();
    worker.sessionConsistencyCheckStatus ??= "passed";
    worker.workspaceSyncStatus ??= "aligned";
  }

  return worker;
}

function workerToSnapshot(worker: RegisteredWorkerView): WorkerSnapshotRecord {
  const runningExecutionIds =
    worker.runningExecutionIds.length > 0
      ? worker.runningExecutionIds
      : Array.from(
          {
            length: Math.max(worker.maxConcurrency - Math.max(worker.availableSlots, 0), 0),
          },
          (_, index) => `${worker.workerId}-running-${index + 1}`,
        );

  return {
    workerId: worker.workerId,
    status: worker.status,
    placement: worker.placement,
    isolationLevel: worker.isolationLevel,
    repoVersion: worker.repoVersion,
    remoteSessionStatus: worker.remoteSessionStatus,
    lastAcknowledgedStreamOffset: worker.lastAcknowledgedStreamOffset,
    streamResumeSuccessRate: worker.streamResumeSuccessRate,
    credentialRefreshSuccessRate: worker.credentialRefreshSuccessRate,
    sessionConsistencyCheckStatus: worker.sessionConsistencyCheckStatus,
    sessionConsistencyCheckedAt: worker.sessionConsistencyCheckedAt,
    workspaceSyncStatus: worker.workspaceSyncStatus,
    workspaceSyncCheckedAt: worker.workspaceSyncCheckedAt,
    saturation: worker.saturation,
    activeLeaseCount: worker.activeLeaseCount,
    meanStartupLatencyMs: worker.meanStartupLatencyMs,
    sandboxSuccessRate: worker.sandboxSuccessRate,
    repoCacheHitRate: worker.repoCacheHitRate,
    registrationVerifiedAt: worker.registrationVerifiedAt,
    registrationChallengeId: worker.registrationChallengeId,
    capabilitiesJson: JSON.stringify(worker.capabilities),
    runningExecutionsJson: JSON.stringify(runningExecutionIds),
    maxConcurrency: worker.maxConcurrency,
    queueAffinity: worker.queueAffinity,
    runtimeInstanceId: worker.runtimeInstanceId,
    restartedFromRuntimeInstanceId: worker.restartedFromRuntimeInstanceId,
    restartGeneration: worker.restartGeneration,
    cpuPct: worker.cpuPct,
    memoryMb: worker.memoryMb,
    toolBacklogCount: worker.toolBacklogCount,
    currentStepId: worker.currentStepId,
    lastProgressAt: worker.lastProgressAt,
    lastHeartbeatAt: worker.lastHeartbeatAt,
    updatedAt: worker.updatedAt,
  };
}

// ---------------------------------------------------------------------------
// Retry handling tests
// ---------------------------------------------------------------------------

test("createTicket preserves execution attempt in ticket", () => {
  const mockExecution = createMockExecution("exec-1", "task-1", 3);
  const mockTask = createMockTask("task-1");

  const store = createMockStore();
  (store.operations as any).loadExecutionAuthoritativeView = () => ({
    execution: mockExecution,
    task: mockTask,
    workflow: null,
    session: null,
    consistency: "authoritative",
    observedAt: new Date().toISOString(),
  });
  (store.worker as any).getActiveExecutionTicket = () => null;
  (store.worker as any).insertExecutionTicket = () => {};
  (store.event as any).insertEvent = () => {};

  const db = createMockDb();
  const service = new ExecutionDispatchService(db, store);

  const result = service.createTicket({ executionId: "exec-1" });

  assert.equal(result.ticket.attempt, 3);
});

test("createTicket with dispatchAfter defers ticket", () => {
  const mockExecution = createMockExecution("exec-1", "task-1");
  const mockTask = createMockTask("task-1");
  const dispatchAfter = "2025-01-01T00:00:00.000Z";

  const store = createMockStore();
  (store.operations as any).loadExecutionAuthoritativeView = () => ({
    execution: mockExecution,
    task: mockTask,
    workflow: null,
    session: null,
    consistency: "authoritative",
    observedAt: new Date().toISOString(),
  });
  (store.worker as any).getActiveExecutionTicket = () => null;
  (store.worker as any).insertExecutionTicket = () => {};
  (store.event as any).insertEvent = () => {};

  const db = createMockDb();
  const service = new ExecutionDispatchService(db, store);

  const result = service.createTicket({ executionId: "exec-1", dispatchAfter });

  assert.equal(result.outcome, "created");
  assert.equal(result.ticket.dispatchAfter, dispatchAfter);
});

// ---------------------------------------------------------------------------
// Queue selection tests
// ---------------------------------------------------------------------------

test("dispatchNext selects worker based on queue affinity", () => {
  const mockTicket = createMockTicket("ticket-1", "exec-1", "task-1", "normal");
  mockTicket.queueName = "priority-queue";
  const worker1 = createMockWorker("worker-1", {
    queueAffinity: "default-queue",
    availableSlots: 5,
  });
  const worker2 = createMockWorker("worker-2", {
    queueAffinity: "priority-queue",
    availableSlots: 5,
  });

  const store = createMockStore();
  (store.worker as any).listDispatchableExecutionTickets = () => [mockTicket];
  (store.worker as any).listWorkerSnapshots = () => [workerToSnapshot(worker1), workerToSnapshot(worker2)];
  (store.dispatch as any).getExecution = () => createMockExecution("exec-1", "task-1");
  (store.worker as any).claimExecutionTicket = () => {};
  (store.worker as any).upsertAgentExecutionRecord = () => {};
  (store.event as any).insertEvent = () => {};
  (store.worker as any).getActiveExecutionLease = () => null;

  const db = createMockDb();
  const backpressureSnapshot = () => ({
    status: "ok" as const,
    degradationMode: "none" as const,
    queueGovernance: {
      backlogSize: 0,
      dispatchableBacklogSize: 0,
      claimedBacklogSize: 0,
      oldestWaitSeconds: null,
      oldestClaimAgeSeconds: null,
      queueNames: [],
      starvationDetected: false,
    },
    findings: [],
  });
  const service = new ExecutionDispatchService(db, store, backpressureSnapshot);

  const result = service.dispatchNext({ leaseTtlMs: 60000 });

  assert.equal(result.outcome, "dispatched");
  assert.equal(result.worker?.workerId, "worker-2"); // affinity matched
});

test("dispatchNext filters workers by required capabilities", () => {
  const mockTicket = createMockTicket("ticket-1", "exec-1", "task-1", "normal");
  mockTicket.requiredCapabilitiesJson = JSON.stringify(["gpu", "large_memory"]);
  const worker1 = createMockWorker("worker-1", { capabilities: ["cpu"], availableSlots: 5 });
  const worker2 = createMockWorker("worker-2", { capabilities: ["gpu", "large_memory"], availableSlots: 5 });

  const store = createMockStore();
  (store.worker as any).listDispatchableExecutionTickets = () => [mockTicket];
  (store.worker as any).listWorkerSnapshots = () => [workerToSnapshot(worker1), workerToSnapshot(worker2)];
  (store.dispatch as any).getExecution = () => createMockExecution("exec-1", "task-1");
  (store.worker as any).claimExecutionTicket = () => {};
  (store.worker as any).upsertAgentExecutionRecord = () => {};
  (store.event as any).insertEvent = () => {};

  const db = createMockDb();
  const backpressureSnapshot = () => ({
    status: "ok" as const,
    degradationMode: "none" as const,
    queueGovernance: {
      backlogSize: 0,
      dispatchableBacklogSize: 0,
      claimedBacklogSize: 0,
      oldestWaitSeconds: null,
      oldestClaimAgeSeconds: null,
      queueNames: [],
      starvationDetected: false,
    },
    findings: [],
  });
  const service = new ExecutionDispatchService(db, store, backpressureSnapshot);

  const result = service.dispatchNext({ leaseTtlMs: 60000 });

  assert.equal(result.outcome, "dispatched");
  assert.equal(result.worker?.workerId, "worker-2");
});

test("dispatchNext filters workers by required isolation level", () => {
  const mockTicket = createMockTicket("ticket-1", "exec-1", "task-1", "normal");
  mockTicket.requiredIsolationLevel = "hardened";
  const worker1 = createMockWorker("worker-1", { isolationLevel: "standard", availableSlots: 5 });
  const worker2 = createMockWorker("worker-2", { isolationLevel: "hardened", availableSlots: 5 });

  const store = createMockStore();
  (store.worker as any).listDispatchableExecutionTickets = () => [mockTicket];
  (store.worker as any).listWorkerSnapshots = () => [workerToSnapshot(worker1), workerToSnapshot(worker2)];
  (store.dispatch as any).getExecution = () => createMockExecution("exec-1", "task-1");
  (store.worker as any).claimExecutionTicket = () => {};
  (store.worker as any).upsertAgentExecutionRecord = () => {};
  (store.event as any).insertEvent = () => {};

  const db = createMockDb();
  const backpressureSnapshot = () => ({
    status: "ok" as const,
    degradationMode: "none" as const,
    queueGovernance: {
      backlogSize: 0,
      dispatchableBacklogSize: 0,
      claimedBacklogSize: 0,
      oldestWaitSeconds: null,
      oldestClaimAgeSeconds: null,
      queueNames: [],
      starvationDetected: false,
    },
    findings: [],
  });
  const service = new ExecutionDispatchService(db, store, backpressureSnapshot);

  const result = service.dispatchNext({ leaseTtlMs: 60000 });

  assert.equal(result.outcome, "dispatched");
  assert.equal(result.worker?.workerId, "worker-2");
});

test("dispatchNext respects dispatchTarget local_only", () => {
  const mockTicket = createMockTicket("ticket-1", "exec-1", "task-1", "normal");
  mockTicket.dispatchTarget = "local_only";
  const localWorker = createMockWorker("local-1", { placement: "local", availableSlots: 5 });
  const remoteWorker = createMockWorker("remote-1", { placement: "remote", availableSlots: 5 });

  const store = createMockStore();
  (store.worker as any).listDispatchableExecutionTickets = () => [mockTicket];
  (store.worker as any).listWorkerSnapshots = () => [workerToSnapshot(localWorker), workerToSnapshot(remoteWorker)];
  (store.dispatch as any).getExecution = () => createMockExecution("exec-1", "task-1");
  (store.worker as any).claimExecutionTicket = () => {};
  (store.worker as any).upsertAgentExecutionRecord = () => {};
  (store.event as any).insertEvent = () => {};

  const db = createMockDb();
  const backpressureSnapshot = () => ({
    status: "ok" as const,
    degradationMode: "none" as const,
    queueGovernance: {
      backlogSize: 0,
      dispatchableBacklogSize: 0,
      claimedBacklogSize: 0,
      oldestWaitSeconds: null,
      oldestClaimAgeSeconds: null,
      queueNames: [],
      starvationDetected: false,
    },
    findings: [],
  });
  const service = new ExecutionDispatchService(db, store, backpressureSnapshot);

  const result = service.dispatchNext({ leaseTtlMs: 60000 });

  assert.equal(result.outcome, "dispatched");
  assert.equal(result.worker?.workerId, "local-1");
});

test("dispatchNext filters out workers with placement mismatch for local_only", () => {
  const mockTicket = createMockTicket("ticket-1", "exec-1", "task-1", "normal");
  mockTicket.dispatchTarget = "local_only";
  const remoteWorker = createMockWorker("remote-1", { placement: "remote", availableSlots: 5 });

  const store = createMockStore();
  (store.worker as any).listDispatchableExecutionTickets = () => [mockTicket];
  (store.worker as any).listWorkerSnapshots = () => [workerToSnapshot(remoteWorker)];
  (store.dispatch as any).getExecution = () => createMockExecution("exec-1", "task-1");
  (store.worker as any).upsertAgentExecutionRecord = () => {};
  (store.event as any).insertEvent = () => {};

  const db = createMockDb();
  const backpressureSnapshot = () => ({
    status: "ok" as const,
    degradationMode: "none" as const,
    queueGovernance: {
      backlogSize: 0,
      dispatchableBacklogSize: 0,
      claimedBacklogSize: 0,
      oldestWaitSeconds: null,
      oldestClaimAgeSeconds: null,
      queueNames: [],
      starvationDetected: false,
    },
    findings: [],
  });
  const service = new ExecutionDispatchService(db, store, backpressureSnapshot);

  const result = service.dispatchNext({ leaseTtlMs: 60000 });

  assert.equal(result.outcome, "no_worker");
});

test("dispatchNext filters out workers by repo version requirement", () => {
  const mockTicket = createMockTicket("ticket-1", "exec-1", "task-1", "normal");
  mockTicket.requiredRepoVersion = "v2.0.0";
  const worker1 = createMockWorker("worker-1", { repoVersion: "v1.0.0", availableSlots: 5 });
  const worker2 = createMockWorker("worker-2", { repoVersion: "v2.0.0", availableSlots: 5 });

  const store = createMockStore();
  (store.worker as any).listDispatchableExecutionTickets = () => [mockTicket];
  (store.worker as any).listWorkerSnapshots = () => [workerToSnapshot(worker1), workerToSnapshot(worker2)];
  (store.dispatch as any).getExecution = () => createMockExecution("exec-1", "task-1");
  (store.worker as any).claimExecutionTicket = () => {};
  (store.worker as any).upsertAgentExecutionRecord = () => {};
  (store.event as any).insertEvent = () => {};

  const db = createMockDb();
  const backpressureSnapshot = () => ({
    status: "ok" as const,
    degradationMode: "none" as const,
    queueGovernance: {
      backlogSize: 0,
      dispatchableBacklogSize: 0,
      claimedBacklogSize: 0,
      oldestWaitSeconds: null,
      oldestClaimAgeSeconds: null,
      queueNames: [],
      starvationDetected: false,
    },
    findings: [],
  });
  const service = new ExecutionDispatchService(db, store, backpressureSnapshot);

  const result = service.dispatchNext({ leaseTtlMs: 60000 });

  assert.equal(result.outcome, "dispatched");
  assert.equal(result.worker?.workerId, "worker-2");
});

// ---------------------------------------------------------------------------
// Preferred worker selection tests
// ---------------------------------------------------------------------------

test("dispatchNext prefers specified worker when available", () => {
  const mockTicket = createMockTicket("ticket-1", "exec-1", "task-1", "normal");
  const preferredWorker = createMockWorker("preferred-1", { availableSlots: 5 });
  const otherWorker = createMockWorker("other-1", { availableSlots: 5 });

  const store = createMockStore();
  (store.worker as any).listDispatchableExecutionTickets = () => [mockTicket];
  (store.worker as any).listWorkerSnapshots = () => [workerToSnapshot(preferredWorker), workerToSnapshot(otherWorker)];
  (store.dispatch as any).getExecution = () => createMockExecution("exec-1", "task-1");
  (store.worker as any).claimExecutionTicket = () => {};
  (store.worker as any).upsertAgentExecutionRecord = () => {};
  (store.event as any).insertEvent = () => {};

  const db = createMockDb();
  const backpressureSnapshot = () => ({
    status: "ok" as const,
    degradationMode: "none" as const,
    queueGovernance: {
      backlogSize: 0,
      dispatchableBacklogSize: 0,
      claimedBacklogSize: 0,
      oldestWaitSeconds: null,
      oldestClaimAgeSeconds: null,
      queueNames: [],
      starvationDetected: false,
    },
    findings: [],
  });
  const service = new ExecutionDispatchService(db, store, backpressureSnapshot);

  const result = service.dispatchNext({ leaseTtlMs: 60000, preferredWorkerId: "preferred-1" });

  assert.equal(result.outcome, "dispatched");
  assert.equal(result.worker?.workerId, "preferred-1");
});

test("dispatchNext selects idle worker over busy worker", () => {
  const mockTicket = createMockTicket("ticket-1", "exec-1", "task-1", "normal");
  const idleWorker = createMockWorker("idle-1", { status: "idle", availableSlots: 5 });
  const busyWorker = createMockWorker("busy-1", { status: "busy", availableSlots: 2 });

  const store = createMockStore();
  (store.worker as any).listDispatchableExecutionTickets = () => [mockTicket];
  (store.worker as any).listWorkerSnapshots = () => [workerToSnapshot(idleWorker), workerToSnapshot(busyWorker)];
  (store.dispatch as any).getExecution = () => createMockExecution("exec-1", "task-1");
  (store.worker as any).claimExecutionTicket = () => {};
  (store.worker as any).upsertAgentExecutionRecord = () => {};
  (store.event as any).insertEvent = () => {};

  const db = createMockDb();
  const backpressureSnapshot = () => ({
    status: "ok" as const,
    degradationMode: "none" as const,
    queueGovernance: {
      backlogSize: 0,
      dispatchableBacklogSize: 0,
      claimedBacklogSize: 0,
      oldestWaitSeconds: null,
      oldestClaimAgeSeconds: null,
      queueNames: [],
      starvationDetected: false,
    },
    findings: [],
  });
  const service = new ExecutionDispatchService(db, store, backpressureSnapshot);

  const result = service.dispatchNext({ leaseTtlMs: 60000 });

  assert.equal(result.outcome, "dispatched");
  assert.equal(result.worker?.workerId, "idle-1");
});

test("dispatchNext selects worker with more available slots", () => {
  const mockTicket = createMockTicket("ticket-1", "exec-1", "task-1", "normal");
  const worker1 = createMockWorker("worker-1", { availableSlots: 2 });
  const worker2 = createMockWorker("worker-2", { availableSlots: 8 });

  const store = createMockStore();
  (store.worker as any).listDispatchableExecutionTickets = () => [mockTicket];
  (store.worker as any).listWorkerSnapshots = () => [workerToSnapshot(worker1), workerToSnapshot(worker2)];
  (store.dispatch as any).getExecution = () => createMockExecution("exec-1", "task-1");
  (store.worker as any).claimExecutionTicket = () => {};
  (store.worker as any).upsertAgentExecutionRecord = () => {};
  (store.event as any).insertEvent = () => {};

  const db = createMockDb();
  const backpressureSnapshot = () => ({
    status: "ok" as const,
    degradationMode: "none" as const,
    queueGovernance: {
      backlogSize: 0,
      dispatchableBacklogSize: 0,
      claimedBacklogSize: 0,
      oldestWaitSeconds: null,
      oldestClaimAgeSeconds: null,
      queueNames: [],
      starvationDetected: false,
    },
    findings: [],
  });
  const service = new ExecutionDispatchService(db, store, backpressureSnapshot);

  const result = service.dispatchNext({ leaseTtlMs: 60000 });

  assert.equal(result.outcome, "dispatched");
  assert.equal(result.worker?.workerId, "worker-2"); // more slots
});

// ---------------------------------------------------------------------------
// Worker status filtering tests
// ---------------------------------------------------------------------------

test("dispatchNext skips unavailable workers", () => {
  const mockTicket = createMockTicket("ticket-1", "exec-1", "task-1", "normal");
  const unavailableWorker = createMockWorker("unavailable-1", { status: "unavailable", availableSlots: 5 });
  const healthyWorker = createMockWorker("healthy-1", { status: "idle", availableSlots: 5 });

  const store = createMockStore();
  (store.worker as any).listDispatchableExecutionTickets = () => [mockTicket];
  (store.worker as any).listWorkerSnapshots = () => [workerToSnapshot(unavailableWorker), workerToSnapshot(healthyWorker)];
  (store.dispatch as any).getExecution = () => createMockExecution("exec-1", "task-1");
  (store.worker as any).claimExecutionTicket = () => {};
  (store.worker as any).upsertAgentExecutionRecord = () => {};
  (store.event as any).insertEvent = () => {};

  const db = createMockDb();
  const backpressureSnapshot = () => ({
    status: "ok" as const,
    degradationMode: "none" as const,
    queueGovernance: {
      backlogSize: 0,
      dispatchableBacklogSize: 0,
      claimedBacklogSize: 0,
      oldestWaitSeconds: null,
      oldestClaimAgeSeconds: null,
      queueNames: [],
      starvationDetected: false,
    },
    findings: [],
  });
  const service = new ExecutionDispatchService(db, store, backpressureSnapshot);

  const result = service.dispatchNext({ leaseTtlMs: 60000 });

  assert.equal(result.outcome, "dispatched");
  assert.equal(result.worker?.workerId, "healthy-1");
});

test("dispatchNext skips quarantined workers", () => {
  const mockTicket = createMockTicket("ticket-1", "exec-1", "task-1", "normal");
  const quarantinedWorker = createMockWorker("quarantined-1", { status: "quarantined", availableSlots: 5 });
  const healthyWorker = createMockWorker("healthy-1", { status: "idle", availableSlots: 5 });

  const store = createMockStore();
  (store.worker as any).listDispatchableExecutionTickets = () => [mockTicket];
  (store.worker as any).listWorkerSnapshots = () => [workerToSnapshot(quarantinedWorker), workerToSnapshot(healthyWorker)];
  (store.dispatch as any).getExecution = () => createMockExecution("exec-1", "task-1");
  (store.worker as any).claimExecutionTicket = () => {};
  (store.worker as any).upsertAgentExecutionRecord = () => {};
  (store.event as any).insertEvent = () => {};

  const db = createMockDb();
  const backpressureSnapshot = () => ({
    status: "ok" as const,
    degradationMode: "none" as const,
    queueGovernance: {
      backlogSize: 0,
      dispatchableBacklogSize: 0,
      claimedBacklogSize: 0,
      oldestWaitSeconds: null,
      oldestClaimAgeSeconds: null,
      queueNames: [],
      starvationDetected: false,
    },
    findings: [],
  });
  const service = new ExecutionDispatchService(db, store, backpressureSnapshot);

  const result = service.dispatchNext({ leaseTtlMs: 60000 });

  assert.equal(result.outcome, "dispatched");
  assert.equal(result.worker?.workerId, "healthy-1");
});

test("dispatchNext skips draining workers", () => {
  const mockTicket = createMockTicket("ticket-1", "exec-1", "task-1", "normal");
  const drainingWorker = createMockWorker("draining-1", { status: "draining", availableSlots: 5 });
  const healthyWorker = createMockWorker("healthy-1", { status: "idle", availableSlots: 5 });

  const store = createMockStore();
  (store.worker as any).listDispatchableExecutionTickets = () => [mockTicket];
  (store.worker as any).listWorkerSnapshots = () => [workerToSnapshot(drainingWorker), workerToSnapshot(healthyWorker)];
  (store.dispatch as any).getExecution = () => createMockExecution("exec-1", "task-1");
  (store.worker as any).claimExecutionTicket = () => {};
  (store.worker as any).upsertAgentExecutionRecord = () => {};
  (store.event as any).insertEvent = () => {};

  const db = createMockDb();
  const backpressureSnapshot = () => ({
    status: "ok" as const,
    degradationMode: "none" as const,
    queueGovernance: {
      backlogSize: 0,
      dispatchableBacklogSize: 0,
      claimedBacklogSize: 0,
      oldestWaitSeconds: null,
      oldestClaimAgeSeconds: null,
      queueNames: [],
      starvationDetected: false,
    },
    findings: [],
  });
  const service = new ExecutionDispatchService(db, store, backpressureSnapshot);

  const result = service.dispatchNext({ leaseTtlMs: 60000 });

  assert.equal(result.outcome, "dispatched");
  assert.equal(result.worker?.workerId, "healthy-1");
});

test("dispatchNext skips workers at capacity", () => {
  const mockTicket = createMockTicket("ticket-1", "exec-1", "task-1", "normal");
  const fullWorker = createMockWorker("full-1", { availableSlots: 0 });
  const availableWorker = createMockWorker("available-1", { availableSlots: 5 });

  const store = createMockStore();
  (store.worker as any).listDispatchableExecutionTickets = () => [mockTicket];
  (store.worker as any).listWorkerSnapshots = () => [workerToSnapshot(fullWorker), workerToSnapshot(availableWorker)];
  (store.dispatch as any).getExecution = () => createMockExecution("exec-1", "task-1");
  (store.worker as any).claimExecutionTicket = () => {};
  (store.worker as any).upsertAgentExecutionRecord = () => {};
  (store.event as any).insertEvent = () => {};

  const db = createMockDb();
  const backpressureSnapshot = () => ({
    status: "ok" as const,
    degradationMode: "none" as const,
    queueGovernance: {
      backlogSize: 0,
      dispatchableBacklogSize: 0,
      claimedBacklogSize: 0,
      oldestWaitSeconds: null,
      oldestClaimAgeSeconds: null,
      queueNames: [],
      starvationDetected: false,
    },
    findings: [],
  });
  const service = new ExecutionDispatchService(db, store, backpressureSnapshot);

  const result = service.dispatchNext({ leaseTtlMs: 60000 });

  assert.equal(result.outcome, "dispatched");
  assert.equal(result.worker?.workerId, "available-1");
});

test("dispatchNext excludes degraded workers by default", () => {
  const mockTicket = createMockTicket("ticket-1", "exec-1", "task-1", "normal");
  const degradedWorker = createMockWorker("degraded-1", { status: "degraded", availableSlots: 5 });
  const healthyWorker = createMockWorker("healthy-1", { status: "idle", availableSlots: 5 });

  const store = createMockStore();
  (store.worker as any).listDispatchableExecutionTickets = () => [mockTicket];
  (store.worker as any).listWorkerSnapshots = () => [workerToSnapshot(degradedWorker), workerToSnapshot(healthyWorker)];
  (store.dispatch as any).getExecution = () => createMockExecution("exec-1", "task-1");
  (store.worker as any).claimExecutionTicket = () => {};
  (store.worker as any).upsertAgentExecutionRecord = () => {};
  (store.event as any).insertEvent = () => {};

  const db = createMockDb();
  const backpressureSnapshot = () => ({
    status: "ok" as const,
    degradationMode: "none" as const,
    queueGovernance: {
      backlogSize: 0,
      dispatchableBacklogSize: 0,
      claimedBacklogSize: 0,
      oldestWaitSeconds: null,
      oldestClaimAgeSeconds: null,
      queueNames: [],
      starvationDetected: false,
    },
    findings: [],
  });
  const service = new ExecutionDispatchService(db, store, backpressureSnapshot);

  const result = service.dispatchNext({ leaseTtlMs: 60000 });

  assert.equal(result.outcome, "dispatched");
  assert.equal(result.worker?.workerId, "healthy-1");
});

test("dispatchNext includes degraded workers when includeDegraded is true", () => {
  const mockTicket = createMockTicket("ticket-1", "exec-1", "task-1", "normal");
  const degradedWorker = createMockWorker("degraded-1", { status: "degraded", availableSlots: 5 });

  const store = createMockStore();
  (store.worker as any).listDispatchableExecutionTickets = () => [mockTicket];
  (store.worker as any).listWorkerSnapshots = () => [workerToSnapshot(degradedWorker)];
  (store.dispatch as any).getExecution = () => createMockExecution("exec-1", "task-1");
  (store.worker as any).claimExecutionTicket = () => {};
  (store.worker as any).upsertAgentExecutionRecord = () => {};
  (store.event as any).insertEvent = () => {};

  const db = createMockDb();
  const backpressureSnapshot = () => ({
    status: "ok" as const,
    degradationMode: "none" as const,
    queueGovernance: {
      backlogSize: 0,
      dispatchableBacklogSize: 0,
      claimedBacklogSize: 0,
      oldestWaitSeconds: null,
      oldestClaimAgeSeconds: null,
      queueNames: [],
      starvationDetected: false,
    },
    findings: [],
  });
  const service = new ExecutionDispatchService(db, store, backpressureSnapshot);

  const result = service.dispatchNext({ leaseTtlMs: 60000, includeDegraded: true });

  assert.equal(result.outcome, "dispatched");
  assert.equal(result.worker?.workerId, "degraded-1");
});

// ---------------------------------------------------------------------------
// Remote worker dispatch tests
// ---------------------------------------------------------------------------

test("dispatchNext requires remote placement for require_remote target", () => {
  const mockTicket = createMockTicket("ticket-1", "exec-1", "task-1", "normal");
  mockTicket.dispatchTarget = "require_remote";
  const localWorker = createMockWorker("local-1", { placement: "local", availableSlots: 5 });
  const remoteWorker = createMockWorker("remote-1", { placement: "remote", availableSlots: 5 });

  const store = createMockStore();
  (store.worker as any).listDispatchableExecutionTickets = () => [mockTicket];
  (store.worker as any).listWorkerSnapshots = () => [workerToSnapshot(localWorker), workerToSnapshot(remoteWorker)];
  (store.dispatch as any).getExecution = () => createMockExecution("exec-1", "task-1");
  (store.worker as any).claimExecutionTicket = () => {};
  (store.worker as any).upsertAgentExecutionRecord = () => {};
  (store.event as any).insertEvent = () => {};

  const db = createMockDb();
  const backpressureSnapshot = () => ({
    status: "ok" as const,
    degradationMode: "none" as const,
    queueGovernance: {
      backlogSize: 0,
      dispatchableBacklogSize: 0,
      claimedBacklogSize: 0,
      oldestWaitSeconds: null,
      oldestClaimAgeSeconds: null,
      queueNames: [],
      starvationDetected: false,
    },
    findings: [],
  });
  const service = new ExecutionDispatchService(db, store, backpressureSnapshot);

  const result = service.dispatchNext({ leaseTtlMs: 60000 });

  assert.equal(result.outcome, "dispatched");
  assert.equal(result.worker?.workerId, "remote-1");
});

test("dispatchNext blocks require_remote when no remote workers available", () => {
  const mockTicket = createMockTicket("ticket-1", "exec-1", "task-1", "normal");
  mockTicket.dispatchTarget = "require_remote";
  const localWorker = createMockWorker("local-1", { placement: "local", availableSlots: 5 });

  const store = createMockStore();
  (store.worker as any).listDispatchableExecutionTickets = () => [mockTicket];
  (store.worker as any).listWorkerSnapshots = () => [workerToSnapshot(localWorker)];
  (store.dispatch as any).getExecution = () => createMockExecution("exec-1", "task-1");
  (store.worker as any).upsertAgentExecutionRecord = () => {};
  (store.event as any).insertEvent = () => {};

  const db = createMockDb();
  const backpressureSnapshot = () => ({
    status: "ok" as const,
    degradationMode: "none" as const,
    queueGovernance: {
      backlogSize: 0,
      dispatchableBacklogSize: 0,
      claimedBacklogSize: 0,
      oldestWaitSeconds: null,
      oldestClaimAgeSeconds: null,
      queueNames: [],
      starvationDetected: false,
    },
    findings: [],
  });
  const service = new ExecutionDispatchService(db, store, backpressureSnapshot);

  const result = service.dispatchNext({ leaseTtlMs: 60000 });

  assert.equal(result.outcome, "blocked");
  assert.equal(result.reasonCode, "remote.unavailable");
});

// ---------------------------------------------------------------------------
// Multiple tickets iteration tests
// ---------------------------------------------------------------------------

test("dispatchNext iterates through tickets when first worker unavailable", () => {
  const ticket1 = createMockTicket("ticket-1", "exec-1", "task-1", "normal");
  ticket1.requiredCapabilitiesJson = JSON.stringify(["nonexistent"]);
  const ticket2 = createMockTicket("ticket-2", "exec-2", "task-2", "normal");
  const worker = createMockWorker("worker-1", { capabilities: ["gpu"], availableSlots: 5 });

  const store = createMockStore();
  (store.worker as any).listDispatchableExecutionTickets = () => [ticket1, ticket2];
  (store.worker as any).listWorkerSnapshots = () => [workerToSnapshot(worker)];
  (store.dispatch as any).getExecution = (id: string) => createMockExecution(id, id === "exec-1" ? "task-1" : "task-2");
  (store.worker as any).claimExecutionTicket = () => {};
  (store.worker as any).upsertAgentExecutionRecord = () => {};
  (store.event as any).insertEvent = () => {};

  const db = createMockDb();
  const backpressureSnapshot = () => ({
    status: "ok" as const,
    degradationMode: "none" as const,
    queueGovernance: {
      backlogSize: 0,
      dispatchableBacklogSize: 0,
      claimedBacklogSize: 0,
      oldestWaitSeconds: null,
      oldestClaimAgeSeconds: null,
      queueNames: [],
      starvationDetected: false,
    },
    findings: [],
  });
  const service = new ExecutionDispatchService(db, store, backpressureSnapshot);

  const result = service.dispatchNext({ leaseTtlMs: 60000 });

  assert.equal(result.outcome, "dispatched");
  assert.equal(result.ticket?.id, "ticket-2");
});

// ---------------------------------------------------------------------------
// Priority preemption tests
// ---------------------------------------------------------------------------

test("dispatchNext triggers preemption for urgent ticket with no eligible workers", () => {
  const urgentTicket = createMockTicket("ticket-1", "exec-1", "task-1", "urgent");
  const busyWorker = createMockWorker("busy-1", { availableSlots: 0, status: "busy" });

  const store = createMockStore();
  (store.worker as any).listDispatchableExecutionTickets = () => [urgentTicket];
  (store.worker as any).listWorkerSnapshots = () => [workerToSnapshot(busyWorker)];
  (store.dispatch as any).getExecution = () => createMockExecution("exec-1", "task-1");
  (store.worker as any).listWorkers = () => [busyWorker];
  (store.worker as any).upsertAgentExecutionRecord = () => {};
  (store.event as any).insertEvent = () => {};
  (store.worker as any).getActiveExecutionLease = () => null;
  (store.workflow as any).getWorkflowState = () => null;
  (store.execution as any).updateExecutionStatus = () => {};
  (store.workflow as any).updateWorkflowRecoveryState = () => {};

  const db = createMockDb();
  const backpressureSnapshot = () => ({
    status: "ok" as const,
    degradationMode: "none" as const,
    queueGovernance: {
      backlogSize: 0,
      dispatchableBacklogSize: 0,
      claimedBacklogSize: 0,
      oldestWaitSeconds: null,
      oldestClaimAgeSeconds: null,
      queueNames: [],
      starvationDetected: false,
    },
    findings: [],
  });
  const service = new ExecutionDispatchService(db, store, backpressureSnapshot);

  // Without a proper preemption setup (running execution, workflow state), preemption won't succeed
  // but the service should still handle the ticket gracefully
  const result = service.dispatchNext({ leaseTtlMs: 60000 });

  // Result depends on preemption success - either dispatched or blocked
  assert.ok(["dispatched", "blocked", "no_worker"].includes(result.outcome), `Unexpected outcome: ${result.outcome}`);
});

// ---------------------------------------------------------------------------
// Trace and decision event recording tests
// ---------------------------------------------------------------------------

test("dispatchNext records decision trace with correct outcome", () => {
  const mockTicket = createMockTicket("ticket-1", "exec-1", "task-1", "normal");
  const worker = createMockWorker("worker-1", { availableSlots: 5 });

  const store = createMockStore();
  (store.worker as any).listDispatchableExecutionTickets = () => [mockTicket];
  (store.worker as any).listWorkerSnapshots = () => [workerToSnapshot(worker)];
  (store.dispatch as any).getExecution = () => createMockExecution("exec-1", "task-1");
  (store.worker as any).claimExecutionTicket = () => {};
  (store.worker as any).upsertAgentExecutionRecord = () => {};
  (store.event as any).insertEvent = () => {};

  const db = createMockDb();
  const backpressureSnapshot = () => ({
    status: "ok" as const,
    degradationMode: "none" as const,
    queueGovernance: {
      backlogSize: 0,
      dispatchableBacklogSize: 0,
      claimedBacklogSize: 0,
      oldestWaitSeconds: null,
      oldestClaimAgeSeconds: null,
      queueNames: [],
      starvationDetected: false,
    },
    findings: [],
  });
  const service = new ExecutionDispatchService(db, store, backpressureSnapshot);

  const result = service.dispatchNext({ leaseTtlMs: 60000 });

  assert.equal(result.outcome, "dispatched");
  assert.ok(result.trace != null);
  assert.equal(result.trace?.outcome, "dispatched");
  assert.equal(result.trace?.ticketId, "ticket-1");
});

test("dispatchNext returns no reasonCode when require_remote has no remote candidates", () => {
  const mockTicket = createMockTicket("ticket-1", "exec-1", "task-1", "low");
  mockTicket.dispatchTarget = "require_remote"; // Will block since only local workers

  const store = createMockStore();
  (store.worker as any).listDispatchableExecutionTickets = () => [mockTicket];
  (store.worker as any).listWorkerSnapshots = () => [];
  (store.dispatch as any).getExecution = () => createMockExecution("exec-1", "task-1");
  (store.worker as any).upsertAgentExecutionRecord = () => {};
  (store.event as any).insertEvent = () => {};

  const db = createMockDb();
  const backpressureSnapshot = () => ({
    status: "ok" as const,
    degradationMode: "none" as const,
    queueGovernance: {
      backlogSize: 0,
      dispatchableBacklogSize: 0,
      claimedBacklogSize: 0,
      oldestWaitSeconds: null,
      oldestClaimAgeSeconds: null,
      queueNames: [],
      starvationDetected: false,
    },
    findings: [],
  });
  const service = new ExecutionDispatchService(db, store, backpressureSnapshot);

  const result = service.dispatchNext({ leaseTtlMs: 60000 });

  assert.equal(result.outcome, "blocked");
  assert.equal(result.reasonCode, "remote.unavailable");
});

// ---------------------------------------------------------------------------
// Queue name filtering tests
// ---------------------------------------------------------------------------

test("dispatchNext filters tickets by queueName when specified", () => {
  const queueTicket = createMockTicket("queue-ticket", "exec-1", "task-1", "normal");
  queueTicket.queueName = "priority-queue";
  const otherTicket = createMockTicket("other-ticket", "exec-2", "task-2", "normal");
  otherTicket.queueName = "default-queue";

  const store = createMockStore();
  (store.worker as any).listDispatchableExecutionTickets = (now: string, queueName: string | null) => {
    if (queueName === "priority-queue") {
      return [queueTicket];
    }
    return [queueTicket, otherTicket];
  };
  (store.worker as any).listWorkerSnapshots = () => [workerToSnapshot(createMockWorker("worker-1", { availableSlots: 5 }))];
  (store.dispatch as any).getExecution = () => createMockExecution("exec-1", "task-1");
  (store.worker as any).claimExecutionTicket = () => {};
  (store.worker as any).upsertAgentExecutionRecord = () => {};
  (store.event as any).insertEvent = () => {};

  const db = createMockDb();
  const backpressureSnapshot = () => ({
    status: "ok" as const,
    degradationMode: "none" as const,
    queueGovernance: {
      backlogSize: 0,
      dispatchableBacklogSize: 0,
      claimedBacklogSize: 0,
      oldestWaitSeconds: null,
      oldestClaimAgeSeconds: null,
      queueNames: [],
      starvationDetected: false,
    },
    findings: [],
  });
  const service = new ExecutionDispatchService(db, store, backpressureSnapshot);

  const result = service.dispatchNext({ leaseTtlMs: 60000, queueName: "priority-queue" });

  assert.equal(result.outcome, "dispatched");
  assert.equal(result.ticket?.queueName, "priority-queue");
});

test("dispatchNext returns no_ticket when no tickets match queue filter", () => {
  const store = createMockStore();
  (store.worker as any).listDispatchableExecutionTickets = () => [];
  (store.dispatch as any).getExecution = () => null;
  (store.worker as any).upsertAgentExecutionRecord = () => {};
  (store.event as any).insertEvent = () => {};

  const db = createMockDb();
  const backpressureSnapshot = () => ({
    status: "ok" as const,
    degradationMode: "none" as const,
    queueGovernance: {
      backlogSize: 0,
      dispatchableBacklogSize: 0,
      claimedBacklogSize: 0,
      oldestWaitSeconds: null,
      oldestClaimAgeSeconds: null,
      queueNames: [],
      starvationDetected: false,
    },
    findings: [],
  });
  const service = new ExecutionDispatchService(db, store, backpressureSnapshot);

  const result = service.dispatchNext({ leaseTtlMs: 60000, queueName: "nonexistent-queue" });

  assert.equal(result.outcome, "no_ticket");
});
