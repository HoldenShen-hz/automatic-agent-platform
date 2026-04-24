import assert from "node:assert/strict";
import test from "node:test";

import { ExecutionDispatchService } from "../../src/platform/execution/dispatcher/execution-dispatch-service.js";
import { WorkerRegistryService } from "../../src/platform/execution/worker-pool/worker-registry-service.js";
import { ExecutionWorkerHandshakeServiceAsync } from "../../src/scale-ecosystem/runtime-services/execution-worker-handshake-service-async.js";
import { ExecutionWorkerWritebackServiceAsync } from "../../src/scale-ecosystem/runtime-services/execution-worker-writeback-service-async.js";
import { nowIso } from "../../src/platform/contracts/types/ids.js";
import { createE2EHarness } from "../helpers/e2e-harness.js";

function seedClaimableExecution() {
  return {
    taskId: "task-worker-runtime-e2e",
    executionId: "exec-worker-runtime-e2e",
    sessionId: "sess-worker-runtime-e2e",
    traceId: "trace-worker-runtime-e2e",
    workerId: "worker-runtime-e2e",
  };
}

function insertClaimableRuntimeState(
  harness: ReturnType<typeof createE2EHarness>,
  seeded: ReturnType<typeof seedClaimableExecution>,
): { ticketId: string; leaseId: string } {
  const dispatch = new ExecutionDispatchService(harness.db, harness.store);
  const workers = new WorkerRegistryService(harness.store);
  const now = nowIso();

  harness.db.transaction(() => {
    harness.store.insertTask({
      id: seeded.taskId,
      parentId: null,
      rootId: seeded.taskId,
      divisionId: "general_ops",
      title: "Worker runtime lifecycle task",
      status: "in_progress",
      source: "user",
      priority: "normal",
      inputJson: JSON.stringify({ request: "execute runtime async lifecycle" }),
      normalizedInputJson: JSON.stringify({ request: "execute runtime async lifecycle" }),
      outputJson: null,
      estimatedCostUsd: 0,
      actualCostUsd: 0,
      errorCode: null,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
    });
    harness.store.insertExecution({
      id: seeded.executionId,
      taskId: seeded.taskId,
      workflowId: "single_agent_minimal",
      parentExecutionId: null,
      agentId: "agent-runtime-e2e",
      roleId: "general_executor",
      runKind: "task_run",
      status: "created",
      inputRef: null,
      traceId: seeded.traceId,
      attempt: 1,
      timeoutMs: 60_000,
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
    harness.store.insertWorkflowState({
      taskId: seeded.taskId,
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
    harness.store.insertSession({
      id: seeded.sessionId,
      taskId: seeded.taskId,
      channel: "cli",
      status: "streaming",
      externalSessionId: null,
      createdAt: now,
      updatedAt: now,
    });
  });

  workers.recordHeartbeat({
    workerId: seeded.workerId,
    status: "idle",
    placement: "local",
    capabilities: ["bash"],
    runningExecutionIds: [],
    maxConcurrency: 1,
    queueAffinity: "default",
    runtimeInstanceId: "runtime-worker-e2e-1",
    occurredAt: "2026-04-24T15:00:00.000Z",
  });
  const created = dispatch.createTicket({
    executionId: seeded.executionId,
    queueName: "default",
    requiredCapabilities: ["bash"],
    occurredAt: "2026-04-24T15:00:01.000Z",
  });
  const dispatched = dispatch.dispatchNext({
    queueName: "default",
    leaseTtlMs: 30_000,
    occurredAt: "2026-04-24T15:00:02.000Z",
  });

  return {
    ticketId: created.ticket.id,
    leaseId: dispatched.leaseId ?? "",
  };
}

test("E2E: async worker handshake and writeback services drive a full execution lifecycle", async () => {
  const harness = createE2EHarness("aa-e2e-worker-runtime-");
  const seeded = seedClaimableExecution();

  try {
    const { ticketId, leaseId } = insertClaimableRuntimeState(harness, seeded);
    const handshake = new ExecutionWorkerHandshakeServiceAsync(harness.db, harness.store);
    const writeback = new ExecutionWorkerWritebackServiceAsync(harness.db, harness.store);

    const claimEvents: string[] = [];
    const writebackEvents: string[] = [];
    handshake.on("operation_complete", (event) => claimEvents.push(`${event.operation}:${event.success}`));
    writeback.on("writeback_complete", (event) => writebackEvents.push(`${event.executionId}:${event.accepted}`));

    const claim = await handshake.claimExecution({
      ticketId,
      workerId: seeded.workerId,
      leaseId,
      fencingToken: 1,
      runtimeInstanceId: "runtime-worker-e2e-1",
      remoteLogs: [
        {
          level: "info",
          message: "runtime worker connected and ready to accept execution",
          context: { stage: "claim" },
        },
      ],
      occurredAt: "2026-04-24T15:00:03.000Z",
    });
    const heartbeat = await handshake.enqueueHeartbeat({
      executionId: seeded.executionId,
      workerId: seeded.workerId,
      leaseId,
      fencingToken: 1,
      ttlMs: 30_000,
      runtimeInstanceId: "runtime-worker-e2e-2",
      progressMessage: "worker still running",
      lastToolName: "bash.exec",
      toolCallCount: 3,
      cpuPct: 47.5,
      memoryMb: 192,
      toolBacklogCount: 2,
      currentStepId: "analyze_request",
      remoteLogs: [
        {
          level: "warn",
          message: "runtime worker observed transient sync lag",
          context: { lagMs: 1200 },
        },
      ],
      occurredAt: "2026-04-24T15:00:05.000Z",
    });
    const acceptedWriteback = await writeback.recordWriteback({
      executionId: seeded.executionId,
      workerId: seeded.workerId,
      leaseId,
      fencingToken: 1,
      runtimeInstanceId: "runtime-worker-e2e-3",
      terminalStatus: "done",
      lastToolName: "edit.apply",
      toolCallCount: 4,
      taskOutputJson: JSON.stringify({ result: "worker runtime complete" }),
      outputsJson: JSON.stringify({ analysis: { result: "worker runtime complete" } }),
      progressMessage: "worker finished",
      remoteLogs: [
        {
          level: "info",
          message: "runtime worker uploaded final artifacts and terminal output",
          context: { stage: "writeback" },
        },
      ],
      occurredAt: "2026-04-24T15:00:08.000Z",
    });
    const duplicateWriteback = await writeback.recordWriteback({
      executionId: seeded.executionId,
      workerId: seeded.workerId,
      leaseId,
      fencingToken: 1,
      runtimeInstanceId: "runtime-worker-e2e-3",
      terminalStatus: "done",
      occurredAt: "2026-04-24T15:00:09.000Z",
    });

    const snapshot = harness.store.loadTaskSnapshot(seeded.taskId);
    const worker = harness.store.getWorkerSnapshot(seeded.workerId);
    const lease = harness.store.getExecutionLease(leaseId);
    const heartbeats = harness.store.listHeartbeatSnapshotsByExecution(seeded.executionId);
    const events = harness.store.listEventsForTask(seeded.taskId).map((event) => event.eventType);
    const remoteLogs = harness.store.listRemoteLogsByExecution(seeded.executionId);
    const handshakeMetrics = handshake.getMetrics();
    const writebackMetrics = writeback.getMetrics();

    assert.equal(claim.accepted, true);
    assert.equal(heartbeat.accepted, true);
    assert.equal(acceptedWriteback.accepted, true);
    assert.equal(duplicateWriteback.accepted, false);
    assert.equal(duplicateWriteback.reasonCode, "execution_not_executing");
    assert.equal(snapshot.task.status, "done");
    assert.equal(snapshot.execution?.status, "succeeded");
    assert.equal(snapshot.workflow?.status, "completed");
    assert.equal(snapshot.session?.status, "completed");
    assert.equal(snapshot.task.outputJson, JSON.stringify({ result: "worker runtime complete" }));
    assert.equal(worker?.status, "idle");
    assert.equal(worker?.runtimeInstanceId, "runtime-worker-e2e-3");
    assert.equal(worker?.restartedFromRuntimeInstanceId, "runtime-worker-e2e-2");
    assert.equal(worker?.restartGeneration, 2);
    assert.equal(lease?.status, "released");
    assert.equal(heartbeats.length, 3);
    assert.ok(events.includes("worker:claim_accepted"));
    assert.ok(events.includes("worker:heartbeat_recorded"));
    assert.ok(events.includes("worker:writeback_recorded"));
    assert.ok(events.includes("worker:lease_released_after_writeback"));
    assert.equal(remoteLogs.length, 3);
    assert.deepEqual(claimEvents, ["claimExecution:true", "recordHeartbeat:true"]);
    assert.deepEqual(writebackEvents, [`${seeded.executionId}:true`, `${seeded.executionId}:false`]);
    assert.equal(handshakeMetrics.totalOperations, 2);
    assert.equal(handshakeMetrics.successfulOperations, 2);
    assert.equal(handshakeMetrics.failedOperations, 0);
    assert.equal(writebackMetrics.totalWritebacks, 2);
    assert.equal(writebackMetrics.acceptedWritebacks, 1);
    assert.equal(writebackMetrics.rejectedWritebacks, 1);

    handshake.dispose();
    writeback.dispose();
  } finally {
    harness.cleanup();
  }
});

test("E2E: async worker handshake fail-closes untrusted remote workers before execution ownership transfers", async () => {
  const harness = createE2EHarness("aa-e2e-worker-runtime-untrusted-");
  const seeded = seedClaimableExecution();

  try {
    const { ticketId, leaseId } = insertClaimableRuntimeState(harness, seeded);
    const workers = new WorkerRegistryService(harness.store);
    workers.recordHeartbeat({
      workerId: seeded.workerId,
      status: "idle",
      placement: "remote",
      remoteSessionStatus: "connected",
      lastAcknowledgedStreamOffset: "stream:42",
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      queueAffinity: "default",
      runtimeInstanceId: "runtime-worker-e2e-remote",
      occurredAt: "2026-04-24T15:10:00.000Z",
    });

    const handshake = new ExecutionWorkerHandshakeServiceAsync(harness.db, harness.store);
    const decision = await handshake.claimExecution({
      ticketId,
      workerId: seeded.workerId,
      leaseId,
      fencingToken: 1,
      runtimeInstanceId: "runtime-worker-e2e-remote",
      occurredAt: "2026-04-24T15:10:01.000Z",
    });

    const ticket = harness.store.getExecutionTicket(ticketId);
    const execution = harness.store.getExecution(seeded.executionId);
    const events = harness.store.listEventsForTask(seeded.taskId);

    assert.equal(decision.accepted, false);
    assert.equal(decision.reasonCode, "worker_not_trusted");
    assert.equal(ticket?.status, "claimed");
    assert.equal(execution?.status, "created");
    assert.ok(
      events.some((event) => {
        if (event.eventType !== "worker:claim_rejected") {
          return false;
        }
        const payload = JSON.parse(event.payloadJson) as { reasonCode?: string };
        return payload.reasonCode === "worker_not_trusted";
      }),
    );

    handshake.dispose();
  } finally {
    harness.cleanup();
  }
});
