import assert from "node:assert/strict";
import test from "node:test";

import { ExecutionDispatchService } from "../../../../../src/platform/execution/dispatcher/execution-dispatch-service.js";
import type { AuthoritativeSqlDatabase } from "../../../../../src/platform/state-evidence/truth/authoritative-sql-database.js";
import type { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";

function createMockDb(): AuthoritativeSqlDatabase {
  return {
    transaction: <T>(fn: () => T) => fn(),
  } as unknown as AuthoritativeSqlDatabase;
}

function createMockStore(): AuthoritativeTaskStore {
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
    worker: {
      getActiveExecutionTicket: () => null,
      insertExecutionTicket: () => {},
      listDispatchableExecutionTickets: () => [],
      claimExecutionTicket: () => {},
      getExecutionTicket: () => null,
      getAgentExecutionRecord: () => null,
      upsertAgentExecutionRecord: () => {},
      getActiveExecutionLease: () => null,
      listExecutionTicketsByStatuses: () => [],
      listWorkers: () => [],
      getWorker: () => null,
      getWorkerSnapshot: () => null,
      listExecutionTicketsByExecution: () => [],
      listWorkerSnapshots: () => [],
      upsertWorkerSnapshot: () => {},
    },
    dispatch: {
      getExecution: () => null,
    },
  } as unknown as AuthoritativeTaskStore;
}

function buildDlqStub(occurredAt: string, sink: Array<{ errorCode: string; payloadJson: string }>) {
  return {
    enqueue: (input: {
      sourceEventId: string;
      consumerId: string;
      errorCode: string;
      payloadJson: string;
      originalTimestamp?: string | null;
      failureCategory?: string | null;
    }) => {
      sink.push({ errorCode: input.errorCode, payloadJson: input.payloadJson });
      return {
        deadLetterId: `dlq:${input.errorCode}`,
        sourceEventId: input.sourceEventId,
        consumerId: input.consumerId,
        errorCode: input.errorCode,
        payloadJson: input.payloadJson,
        status: "pending",
        retryCount: 0,
        nextRetryAt: null,
        createdAt: occurredAt,
        updatedAt: occurredAt,
        originalTimestamp: input.originalTimestamp ?? null,
        failureCategory: input.failureCategory ?? null,
        retryExhaustedAt: null,
      };
    },
  };
}

test("dispatchNext records scheduler snapshot and DLQ for backpressure-blocked tickets", () => {
  const occurredAt = "2026-05-01T00:00:00.000Z";
  const store = createMockStore();
  const events: string[] = [];
  const enqueued: Array<{ errorCode: string; payloadJson: string }> = [];

  (store.worker as any).listDispatchableExecutionTickets = () => [
    {
      id: "ticket-backpressure",
      executionId: "exec-backpressure",
      taskId: "task-backpressure",
      priority: "low",
      queueName: "default",
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
      createdAt: occurredAt,
      updatedAt: occurredAt,
    },
  ];
  (store.dispatch as any).getExecution = () => ({
    id: "exec-backpressure",
    taskId: "task-backpressure",
    traceId: "trace-backpressure",
    attempt: 1,
  });
  (store.event as any).insertEvent = (event: { eventType: string }) => {
    events.push(event.eventType);
  };

  const service = new ExecutionDispatchService(
    createMockDb(),
    store,
    () => ({
      status: "degraded",
      degradationMode: "queue_only",
      queueGovernance: { starvationDetected: true },
      findings: [],
    }),
    null,
    null,
    buildDlqStub(occurredAt, enqueued),
  );

  const result = service.dispatchNext({ queueName: "default", leaseTtlMs: 30_000, occurredAt });
  assert.equal(result.outcome, "blocked");
  assert.equal(result.trace?.reasonCode, "backpressure.starvation_protection");
  assert.deepEqual(result.trace?.readySet, ["ticket-backpressure"]);
  assert.deepEqual(result.trace?.selectedNodeIds, []);
  assert.equal(result.trace?.orderingPolicyVersion, "dispatch.partial-deterministic.v2");
  assert.equal(result.trace?.workerPoolSnapshotRef, "worker_pool://dispatch/default/snapshot/2026-05-01T00:00:00.000Z");
  assert.equal(enqueued.length, 1);
  assert.equal(enqueued[0]?.errorCode, "backpressure.starvation_protection");
  assert.ok(events.includes("dispatch.backpressure_rejected"));
  assert.ok(events.includes("dispatch.dlq_enqueue"));
});

test("dispatchNext records scheduler snapshot on remote-blocked paths", () => {
  const occurredAt = "2026-05-01T00:10:00.000Z";
  const store = createMockStore();
  const events: string[] = [];
  const enqueued: Array<{ errorCode: string; payloadJson: string }> = [];

  (store.worker as any).listDispatchableExecutionTickets = () => [
    {
      id: "ticket-remote",
      executionId: "exec-remote",
      taskId: "task-remote",
      priority: "normal",
      queueName: "default",
      dispatchTarget: "require_remote",
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
      createdAt: occurredAt,
      updatedAt: occurredAt,
    },
  ];
  const localWorker = {
    workerId: "worker-local",
    status: "idle",
    schedulingStatus: "healthy",
    placement: "local",
    isolationLevel: "standard",
    repoVersion: null,
    remoteSessionStatus: null,
    lastAcknowledgedStreamOffset: null,
    sessionConsistencyCheckStatus: null,
    workspaceSyncStatus: null,
    queueAffinity: null,
    availableSlots: 1,
    capabilities: [],
    trusted: true,
    runningExecutionIds: [],
    maxConcurrency: 1,
    activeLeaseCount: 0,
    saturation: 0,
    toolBacklogCount: 0,
    cpuPct: 0,
  };
  (store.worker as any).listWorkers = () => [localWorker];
  (store.worker as any).getWorker = () => localWorker;
  (store.dispatch as any).getExecution = () => ({
    id: "exec-remote",
    taskId: "task-remote",
    traceId: "trace-remote",
    attempt: 1,
  });
  (store.event as any).insertEvent = (event: { eventType: string }) => {
    events.push(event.eventType);
  };

  const service = new ExecutionDispatchService(
    createMockDb(),
    store,
    () => ({
      status: "ok",
      degradationMode: "none",
      queueGovernance: { starvationDetected: false },
      findings: [],
    }),
    null,
    null,
    buildDlqStub(occurredAt, enqueued),
  );

  const result = service.dispatchNext({ queueName: "default", leaseTtlMs: 30_000, occurredAt });
  assert.equal(result.outcome, "blocked");
  assert.equal(result.trace?.reasonCode, "remote.unavailable");
  assert.deepEqual(result.trace?.readySet, ["ticket-remote"]);
  assert.deepEqual(result.trace?.selectedNodeIds, []);
  assert.equal(result.trace?.orderingPolicyVersion, "dispatch.partial-deterministic.v2");
  assert.equal(result.trace?.workerPoolSnapshotRef, "worker_pool://dispatch/default/snapshot/2026-05-01T00:10:00.000Z");
  assert.equal(enqueued.length, 1);
  assert.equal(enqueued[0]?.errorCode, "remote.unavailable");
  assert.equal(events.includes("dispatch.backpressure_rejected"), false);
  assert.ok(events.includes("dispatch.dlq_enqueue"));
});
