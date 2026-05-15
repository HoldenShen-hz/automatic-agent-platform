import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { ExecutionDispatchService } from "../../../../src/platform/five-plane-execution/dispatcher/execution-dispatch-service.js";
import { ExecutionLeaseService } from "../../../../src/platform/five-plane-execution/lease/execution-lease-service.js";
import { WorkerRegistryService } from "../../../../src/platform/five-plane-execution/worker-pool/worker-registry-service.js";
import { AuthoritativeTaskStore } from "../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";
import { seedTaskAndExecution } from "../../../helpers/seed.js";

test("execution dispatch service creates a ticket and dispatches it to an eligible worker with a lease", () => {
  const workspace = createTempWorkspace("aa-execution-dispatch-");
  const dbPath = join(workspace, "execution-dispatch.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const workers = new WorkerRegistryService(store);
    const dispatch = new ExecutionDispatchService(db, store);
    seedTaskAndExecution(db, store, {
      taskId: "task-dispatch",
      executionId: "exec-dispatch",
      traceId: "trace-dispatch",
    });

    db.connection.prepare(`UPDATE executions SET status = ? WHERE id = ?`).run("created", "exec-dispatch");
    workers.recordHeartbeat({
      workerId: "worker-capable",
      status: "idle",
      capabilities: ["bash", "edit"],
      runningExecutionIds: [],
      maxConcurrency: 2,
      queueAffinity: "default",
      occurredAt: "2026-04-04T10:00:00.000Z",
    });
    workers.recordHeartbeat({
      workerId: "worker-basic",
      status: "idle",
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 2,
      queueAffinity: "default",
      occurredAt: "2026-04-04T10:00:00.000Z",
    });

    const created = dispatch.createTicket({
      executionId: "exec-dispatch",
      queueName: "default",
      requiredCapabilities: ["bash", "edit"],
      occurredAt: "2026-04-04T10:00:05.000Z",
    });
    const dispatched = dispatch.dispatchNext({
      queueName: "default",
      leaseTtlMs: 30_000,
      occurredAt: "2026-04-04T10:00:06.000Z",
    });
    const tickets = store.listExecutionTicketsByExecution("exec-dispatch");
    const events = store.listEventsForTask("task-dispatch");
    const decisionEvent = events.find((event) => event.eventType === "dispatch:decision_recorded");
    const decisionPayload = decisionEvent ? (JSON.parse(decisionEvent.payloadJson) as { selectedWorkerId: string | null; evaluations: Array<{ workerId: string; rejectionReason: string | null }> }) : null;
    const lease = dispatched.leaseId ? store.getExecutionLease(dispatched.leaseId) : null;
    db.close();

    assert.equal(created.outcome, "created");
    assert.equal(dispatched.outcome, "dispatched");
    assert.equal(dispatched.worker?.workerId, "worker-capable");
    assert.equal(tickets.length, 1);
    assert.equal(tickets[0]?.status, "claimed");
    assert.equal(tickets[0]?.assignedWorkerId, "worker-capable");
    assert.equal(lease?.workerId, "worker-capable");
    assert.ok(events.some((event) => event.eventType === "dispatch:ticket_created"));
    assert.ok(events.some((event) => event.eventType === "dispatch:ticket_claimed"));
    assert.equal(dispatched.trace?.selectedWorkerId, "worker-capable");
    assert.equal(decisionPayload?.selectedWorkerId, "worker-capable");
    assert.ok(decisionPayload?.evaluations.some((item) => item.workerId === "worker-basic" && item.rejectionReason === "missing_capabilities"));
  } finally {
    cleanupPath(workspace);
  }
});

test("execution dispatch service degrades cleanly when queue delivery is unavailable", () => {
  const workspace = createTempWorkspace("aa-execution-dispatch-");
  const dbPath = join(workspace, "execution-dispatch-queue-unavailable.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const workers = new WorkerRegistryService(store);
    const dispatch = new ExecutionDispatchService(
      db,
      store,
      null,
      () => ({
        state: "unavailable",
        reasonCode: "queue_unavailable",
      }),
    );
    seedTaskAndExecution(db, store, {
      taskId: "task-dispatch-queue-unavailable",
      executionId: "exec-dispatch-queue-unavailable",
      traceId: "trace-dispatch-queue-unavailable",
    });

    db.connection.prepare("UPDATE executions SET status = ? WHERE id = ?").run("created", "exec-dispatch-queue-unavailable");
    workers.recordHeartbeat({
      workerId: "worker-queue-unavailable",
      status: "idle",
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      queueAffinity: "default",
      occurredAt: "2026-04-07T12:00:00.000Z",
    });

    const created = dispatch.createTicket({
      executionId: "exec-dispatch-queue-unavailable",
      queueName: "default",
      requiredCapabilities: ["bash"],
      occurredAt: "2026-04-07T12:00:05.000Z",
    });
    const decision = dispatch.dispatchNext({
      queueName: "default",
      leaseTtlMs: 30_000,
      occurredAt: "2026-04-07T12:00:06.000Z",
    });
    const ticket = store.getExecutionTicket(created.ticket.id);
    const events = store.listEventsForTask("task-dispatch-queue-unavailable");
    db.close();

    assert.equal(decision.outcome, "blocked");
    assert.equal(decision.reasonCode, "queue_unavailable");
    assert.equal(decision.ticket?.id, created.ticket.id);
    assert.equal(ticket?.status, "pending");
    assert.ok(
      events.some((event) => {
        if (event.eventType !== "dispatch:decision_recorded") {
          return false;
        }
        const payload = JSON.parse(event.payloadJson) as { reasonCode?: string | null };
        return payload.reasonCode === "queue_unavailable";
      }),
    );
  } finally {
    cleanupPath(workspace);
  }
});

function seedDispatchPreemptionScenario(
  db: SqliteDatabase,
  store: AuthoritativeTaskStore,
  input: {
    lowExecutionId: string;
    lowTaskId: string;
    urgentExecutionId: string;
    urgentTaskId: string;
    workerCurrentStepId: string | null;
    resumableFromStep: string | null;
  },
): void {
  const dispatch = new ExecutionDispatchService(db, store);
  const leases = new ExecutionLeaseService(db, store);
  const workers = new WorkerRegistryService(store);

  seedTaskAndExecution(db, store, {
    taskId: input.lowTaskId,
    executionId: input.lowExecutionId,
    traceId: `trace-${input.lowExecutionId}`,
  });
  seedTaskAndExecution(db, store, {
    taskId: input.urgentTaskId,
    executionId: input.urgentExecutionId,
    traceId: `trace-${input.urgentExecutionId}`,
  });

  db.connection.prepare(`UPDATE tasks SET priority = ? WHERE id = ?`).run("low", input.lowTaskId);
  db.connection.prepare(`UPDATE tasks SET priority = ? WHERE id = ?`).run("urgent", input.urgentTaskId);
  db.connection.prepare(`UPDATE executions SET status = ? WHERE id = ?`).run("created", input.urgentExecutionId);

  store.insertWorkflowState({
    taskId: input.lowTaskId,
    divisionId: "general_ops",
    workflowId: "single_division_multi_step_orchestration",
    currentStepIndex: 1,
    status: "running",
    outputsJson: JSON.stringify({}),
    lastErrorCode: null,
    retryCount: 0,
    resumableFromStep: input.resumableFromStep,
    startedAt: "2026-04-07T11:00:00.000Z",
    updatedAt: "2026-04-07T11:00:00.000Z",
  });

  const lowTicket = dispatch.createTicket({
    executionId: input.lowExecutionId,
    priority: "low",
    queueName: "default",
    requiredCapabilities: ["bash"],
    occurredAt: "2026-04-07T11:00:05.000Z",
  }).ticket;
  store.consumeExecutionTicket(lowTicket.id, "2026-04-07T11:00:06.000Z");
  const lease = leases.acquireLease({
    executionId: input.lowExecutionId,
    workerId: "worker-dispatch-preempt",
    ttlMs: 30_000,
    queueName: "default",
    occurredAt: "2026-04-07T11:00:07.000Z",
  });
  assert.equal(lease.outcome, "granted");

  workers.recordHeartbeat({
    workerId: "worker-dispatch-preempt",
    status: "busy",
    capabilities: ["bash"],
    runningExecutionIds: [input.lowExecutionId],
    maxConcurrency: 1,
    queueAffinity: "default",
    currentStepId: input.workerCurrentStepId,
    lastProgressAt: "2026-04-07T11:00:08.000Z",
    occurredAt: "2026-04-07T11:00:08.000Z",
  });

  const lowExecution = store.getExecution(input.lowExecutionId);
  assert.ok(lowExecution);
  store.upsertAgentExecutionRecord({
    executionId: input.lowExecutionId,
    taskId: input.lowTaskId,
    agentId: lowExecution.agentId,
    workflowId: lowExecution.workflowId,
    roleId: lowExecution.roleId,
    runKind: lowExecution.runKind,
    runtimeInstanceId: "runtime-dispatch-preempt",
    restartedFromRuntimeInstanceId: null,
    restartGeneration: 0,
    status: "executing",
    planJson: JSON.stringify({ workflowId: lowExecution.workflowId }),
    currentStepId: input.workerCurrentStepId,
    lastToolName: "bash",
    toolCallCount: 1,
    lastDecisionJson: null,
    lastErrorCode: null,
    retryCount: 0,
    progressMessage: "working",
    startedAt: "2026-04-07T11:00:00.000Z",
    createdAt: "2026-04-07T11:00:00.000Z",
    updatedAt: "2026-04-07T11:00:08.000Z",
    completedAt: null,
  });
}

test("execution dispatch service preempts a safe low-priority execution to free capacity for an urgent ticket", () => {
  const workspace = createTempWorkspace("aa-execution-dispatch-");
  const dbPath = join(workspace, "execution-dispatch-preemption.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const dispatch = new ExecutionDispatchService(db, store);

    seedDispatchPreemptionScenario(db, store, {
      lowExecutionId: "exec-dispatch-low-preempt",
      lowTaskId: "task-dispatch-low-preempt",
      urgentExecutionId: "exec-dispatch-urgent-preempt",
      urgentTaskId: "task-dispatch-urgent-preempt",
      workerCurrentStepId: "draft_solution",
      resumableFromStep: "draft_solution",
    });

    dispatch.createTicket({
      executionId: "exec-dispatch-urgent-preempt",
      priority: "urgent",
      queueName: "default",
      requiredCapabilities: ["bash"],
      occurredAt: "2026-04-07T11:00:09.000Z",
    });
    const decision = dispatch.dispatchNext({
      queueName: "default",
      leaseTtlMs: 30_000,
      occurredAt: "2026-04-07T11:00:10.000Z",
    });
    const lowExecution = store.getExecution("exec-dispatch-low-preempt");
    const workflow = store.getWorkflowState("task-dispatch-low-preempt");
    const replacementTickets = store.listExecutionTicketsByExecution("exec-dispatch-low-preempt");
    const events = store.listEventsForTask("task-dispatch-low-preempt");
    db.close();

    assert.equal(decision.outcome, "dispatched");
    assert.equal(decision.worker?.workerId, "worker-dispatch-preempt");
    assert.equal(decision.trace?.preemption?.applied, true);
    assert.equal(decision.trace?.preemption?.preemptedExecutionId, "exec-dispatch-low-preempt");
    assert.equal(decision.trace?.preemption?.recoveryStepId, "draft_solution");
    assert.equal(lowExecution?.status, "blocked");
    assert.equal(workflow?.status, "paused");
    assert.equal(replacementTickets.length, 2);
    assert.equal(replacementTickets.at(-1)?.status, "pending");
    assert.ok(events.some((event) => event.eventType === "dispatch:execution_preempted"));
    assert.ok(events.some((event) => event.eventType === "dispatch:ticket_requeued"));
  } finally {
    cleanupPath(workspace);
  }
});

test("execution dispatch service does not preempt when the running execution has no safe resumable boundary", () => {
  const workspace = createTempWorkspace("aa-execution-dispatch-");
  const dbPath = join(workspace, "execution-dispatch-no-preemption.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const dispatch = new ExecutionDispatchService(db, store);

    seedDispatchPreemptionScenario(db, store, {
      lowExecutionId: "exec-dispatch-low-no-preempt",
      lowTaskId: "task-dispatch-low-no-preempt",
      urgentExecutionId: "exec-dispatch-urgent-no-preempt",
      urgentTaskId: "task-dispatch-urgent-no-preempt",
      workerCurrentStepId: "implement_change",
      resumableFromStep: "draft_solution",
    });

    dispatch.createTicket({
      executionId: "exec-dispatch-urgent-no-preempt",
      priority: "urgent",
      queueName: "default",
      requiredCapabilities: ["bash"],
      occurredAt: "2026-04-07T11:10:09.000Z",
    });
    const decision = dispatch.dispatchNext({
      queueName: "default",
      leaseTtlMs: 30_000,
      occurredAt: "2026-04-07T11:10:10.000Z",
    });
    const lowExecution = store.getExecution("exec-dispatch-low-no-preempt");
    const events = store.listEventsForTask("task-dispatch-low-no-preempt");
    db.close();

    assert.equal(decision.outcome, "blocked");
    assert.equal(decision.reasonCode, "dispatch.no_emergency_worker_available");
    assert.equal(lowExecution?.status, "executing");
    assert.ok(events.every((event) => event.eventType !== "dispatch:execution_preempted"));
  } finally {
    cleanupPath(workspace);
  }
});

test("execution dispatch service prefers a remote worker when dispatch target is prefer_remote", () => {
  const workspace = createTempWorkspace("aa-execution-dispatch-");
  const dbPath = join(workspace, "execution-dispatch-prefer-remote.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const workers = new WorkerRegistryService(store);
    const dispatch = new ExecutionDispatchService(db, store);
    seedTaskAndExecution(db, store, {
      taskId: "task-dispatch-prefer-remote",
      executionId: "exec-dispatch-prefer-remote",
      traceId: "trace-dispatch-prefer-remote",
    });

    db.connection.prepare(`UPDATE executions SET status = ? WHERE id = ?`).run("created", "exec-dispatch-prefer-remote");
    workers.recordHeartbeat({
      workerId: "worker-local",
      status: "idle",
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 2,
      queueAffinity: "default",
      occurredAt: "2026-04-04T10:00:00.000Z",
    });
    workers.recordHeartbeat({
      workerId: "worker-remote",
      status: "idle",
      placement: "remote",
      registrationVerifiedAt: "2026-04-04T10:00:00.000Z",
      remoteSessionStatus: "connected",
      lastAcknowledgedStreamOffset: "stream:10",
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      queueAffinity: "default",
      occurredAt: "2026-04-04T10:00:00.000Z",
    });

    dispatch.createTicket({
      executionId: "exec-dispatch-prefer-remote",
      queueName: "default",
      dispatchTarget: "prefer_remote",
      requiredCapabilities: ["bash"],
      occurredAt: "2026-04-04T10:00:05.000Z",
    });
    const decision = dispatch.dispatchNext({
      queueName: "default",
      leaseTtlMs: 30_000,
      occurredAt: "2026-04-04T10:00:06.000Z",
    });
    db.close();

    assert.equal(decision.outcome, "dispatched");
    assert.equal(decision.worker?.workerId, "worker-remote");
    assert.equal(decision.worker?.placement, "remote");
    assert.equal(decision.reasonCode, null);
    assert.equal(decision.trace?.dispatchTarget, "prefer_remote");
    assert.equal(decision.trace?.remoteAvailability, "healthy");
    assert.equal(decision.trace?.fallbackApplied, false);
  } finally {
    cleanupPath(workspace);
  }
});

test("execution dispatch service falls back to a local worker when prefer_remote cannot reach an eligible remote worker", () => {
  const workspace = createTempWorkspace("aa-execution-dispatch-");
  const dbPath = join(workspace, "execution-dispatch-remote-fallback.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const workers = new WorkerRegistryService(store);
    const dispatch = new ExecutionDispatchService(db, store);
    seedTaskAndExecution(db, store, {
      taskId: "task-dispatch-remote-fallback",
      executionId: "exec-dispatch-remote-fallback",
      traceId: "trace-dispatch-remote-fallback",
    });

    db.connection.prepare(`UPDATE executions SET status = ? WHERE id = ?`).run("created", "exec-dispatch-remote-fallback");
    workers.recordHeartbeat({
      workerId: "worker-local-fallback",
      status: "idle",
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      queueAffinity: "default",
      occurredAt: "2026-04-04T10:05:00.000Z",
    });
    workers.recordHeartbeat({
      workerId: "worker-remote-unavailable",
      status: "unavailable",
      placement: "remote",
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      queueAffinity: "default",
      occurredAt: "2026-04-04T10:05:00.000Z",
    });

    dispatch.createTicket({
      executionId: "exec-dispatch-remote-fallback",
      queueName: "default",
      dispatchTarget: "prefer_remote",
      requiredCapabilities: ["bash"],
      occurredAt: "2026-04-04T10:05:05.000Z",
    });
    const decision = dispatch.dispatchNext({
      queueName: "default",
      leaseTtlMs: 30_000,
      occurredAt: "2026-04-04T10:05:06.000Z",
    });
    db.close();

    assert.equal(decision.outcome, "dispatched");
    assert.equal(decision.worker?.workerId, "worker-local-fallback");
    assert.equal(decision.worker?.placement, "local");
    assert.equal(decision.reasonCode, "remote.fallback_local.unavailable");
    assert.equal(decision.trace?.dispatchTarget, "prefer_remote");
    assert.equal(decision.trace?.remoteAvailability, "unavailable");
    assert.equal(decision.trace?.fallbackApplied, true);
  } finally {
    cleanupPath(workspace);
  }
});

test("execution dispatch service fails closed for untrusted remote workers before granting remote ownership", () => {
  const workspace = createTempWorkspace("aa-execution-dispatch-");
  const dbPath = join(workspace, "execution-dispatch-remote-untrusted.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const workers = new WorkerRegistryService(store);
    const dispatch = new ExecutionDispatchService(db, store);
    seedTaskAndExecution(db, store, {
      taskId: "task-dispatch-remote-untrusted",
      executionId: "exec-dispatch-remote-untrusted",
      traceId: "trace-dispatch-remote-untrusted",
    });

    db.connection.prepare(`UPDATE executions SET status = ? WHERE id = ?`).run("created", "exec-dispatch-remote-untrusted");
    workers.recordHeartbeat({
      workerId: "worker-local-trusted",
      status: "idle",
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      queueAffinity: "default",
      occurredAt: "2026-04-06T12:00:00.000Z",
    });
    workers.recordHeartbeat({
      workerId: "worker-remote-untrusted",
      status: "idle",
      placement: "remote",
      remoteSessionStatus: "connected",
      lastAcknowledgedStreamOffset: "stream:18",
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      queueAffinity: "default",
      occurredAt: "2026-04-06T12:00:00.000Z",
    });

    dispatch.createTicket({
      executionId: "exec-dispatch-remote-untrusted",
      queueName: "default",
      dispatchTarget: "prefer_remote",
      requiredCapabilities: ["bash"],
      occurredAt: "2026-04-06T12:00:05.000Z",
    });
    const decision = dispatch.dispatchNext({
      queueName: "default",
      leaseTtlMs: 30_000,
      occurredAt: "2026-04-06T12:00:06.000Z",
    });
    db.close();

    assert.equal(decision.outcome, "dispatched");
    assert.equal(decision.worker?.workerId, "worker-local-trusted");
    assert.equal(decision.reasonCode, "remote.fallback_local.untrusted");
    assert.ok(
      decision.trace?.evaluations.some(
        (item) => item.workerId === "worker-remote-untrusted" && item.rejectionReason === "worker_untrusted",
      ),
    );
  } finally {
    cleanupPath(workspace);
  }
});

test("execution dispatch service falls back to a repo-matched local worker when prefer_remote sees only remote repo mismatches", () => {
  const workspace = createTempWorkspace("aa-execution-dispatch-");
  const dbPath = join(workspace, "execution-dispatch-remote-repo-fallback.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const workers = new WorkerRegistryService(store);
    const dispatch = new ExecutionDispatchService(db, store);
    seedTaskAndExecution(db, store, {
      taskId: "task-dispatch-remote-repo-fallback",
      executionId: "exec-dispatch-remote-repo-fallback",
      traceId: "trace-dispatch-remote-repo-fallback",
    });

    db.connection.prepare(`UPDATE executions SET status = ? WHERE id = ?`).run("created", "exec-dispatch-remote-repo-fallback");
    workers.recordHeartbeat({
      workerId: "worker-local-repo-match",
      status: "idle",
      repoVersion: "repo-main@abc123",
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      queueAffinity: "default",
      occurredAt: "2026-04-04T10:06:00.000Z",
    });
    workers.recordHeartbeat({
      workerId: "worker-remote-repo-mismatch",
      status: "idle",
      placement: "remote",
      registrationVerifiedAt: "2026-04-04T10:06:00.000Z",
      remoteSessionStatus: "connected",
      lastAcknowledgedStreamOffset: "stream:20",
      repoVersion: "repo-main@def456",
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      queueAffinity: "default",
      occurredAt: "2026-04-04T10:06:00.000Z",
    });

    dispatch.createTicket({
      executionId: "exec-dispatch-remote-repo-fallback",
      queueName: "default",
      dispatchTarget: "prefer_remote",
      requiredRepoVersion: "repo-main@abc123",
      requiredCapabilities: ["bash"],
      occurredAt: "2026-04-04T10:06:05.000Z",
    });
    const decision = dispatch.dispatchNext({
      queueName: "default",
      leaseTtlMs: 30_000,
      occurredAt: "2026-04-04T10:06:06.000Z",
    });
    db.close();

    assert.equal(decision.outcome, "dispatched");
    assert.equal(decision.worker?.workerId, "worker-local-repo-match");
    assert.equal(decision.reasonCode, "remote.fallback_local.repo_version_mismatch");
    assert.equal(decision.trace?.requiredRepoVersion, "repo-main@abc123");
    assert.ok(
      decision.trace?.evaluations.some(
        (item) => item.workerId === "worker-remote-repo-mismatch" && item.rejectionReason === "worker_repo_version_mismatch",
      ),
    );
  } finally {
    cleanupPath(workspace);
  }
});

test("execution dispatch service fail-closes when dispatch target requires a remote worker but remote capacity is unavailable", () => {
  const workspace = createTempWorkspace("aa-execution-dispatch-");
  const dbPath = join(workspace, "execution-dispatch-require-remote.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const workers = new WorkerRegistryService(store);
    const dispatch = new ExecutionDispatchService(db, store);
    seedTaskAndExecution(db, store, {
      taskId: "task-dispatch-require-remote",
      executionId: "exec-dispatch-require-remote",
      traceId: "trace-dispatch-require-remote",
    });

    db.connection.prepare(`UPDATE executions SET status = ? WHERE id = ?`).run("created", "exec-dispatch-require-remote");
    workers.recordHeartbeat({
      workerId: "worker-local-only",
      status: "idle",
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      queueAffinity: "default",
      occurredAt: "2026-04-04T10:08:00.000Z",
    });

    const created = dispatch.createTicket({
      executionId: "exec-dispatch-require-remote",
      queueName: "default",
      dispatchTarget: "require_remote",
      requiredCapabilities: ["bash"],
      occurredAt: "2026-04-04T10:08:05.000Z",
    });
    const decision = dispatch.dispatchNext({
      queueName: "default",
      leaseTtlMs: 30_000,
      occurredAt: "2026-04-04T10:08:06.000Z",
    });
    const ticket = store.getExecutionTicket(created.ticket.id);
    db.close();

    assert.equal(decision.outcome, "blocked");
    assert.equal(decision.reasonCode, "remote.unavailable");
    assert.equal(ticket?.status, "pending");
    assert.equal(decision.trace?.dispatchTarget, "require_remote");
    assert.equal(decision.trace?.remoteAvailability, "unavailable");
    assert.equal(decision.trace?.fallbackApplied, false);
  } finally {
    cleanupPath(workspace);
  }
});

test("execution dispatch service fail-closes when require_remote sees only repo-mismatched remote workers", () => {
  const workspace = createTempWorkspace("aa-execution-dispatch-");
  const dbPath = join(workspace, "execution-dispatch-require-remote-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const workers = new WorkerRegistryService(store);
    const dispatch = new ExecutionDispatchService(db, store);
    seedTaskAndExecution(db, store, {
      taskId: "task-dispatch-require-remote-repo",
      executionId: "exec-dispatch-require-remote-repo",
      traceId: "trace-dispatch-require-remote-repo",
    });

    db.connection.prepare(`UPDATE executions SET status = ? WHERE id = ?`).run("created", "exec-dispatch-require-remote-repo");
    workers.recordHeartbeat({
      workerId: "worker-remote-repo-old",
      status: "idle",
      placement: "remote",
      registrationVerifiedAt: "2026-04-04T10:09:00.000Z",
      remoteSessionStatus: "connected",
      lastAcknowledgedStreamOffset: "stream:30",
      repoVersion: "repo-main@old999",
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      queueAffinity: "default",
      occurredAt: "2026-04-04T10:09:00.000Z",
    });
    workers.recordHeartbeat({
      workerId: "worker-local-repo-match",
      status: "idle",
      repoVersion: "repo-main@abc123",
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      queueAffinity: "default",
      occurredAt: "2026-04-04T10:09:00.000Z",
    });

    const created = dispatch.createTicket({
      executionId: "exec-dispatch-require-remote-repo",
      queueName: "default",
      dispatchTarget: "require_remote",
      requiredRepoVersion: "repo-main@abc123",
      requiredCapabilities: ["bash"],
      occurredAt: "2026-04-04T10:09:05.000Z",
    });
    const decision = dispatch.dispatchNext({
      queueName: "default",
      leaseTtlMs: 30_000,
      occurredAt: "2026-04-04T10:09:06.000Z",
    });
    const ticket = store.getExecutionTicket(created.ticket.id);
    db.close();

    assert.equal(decision.outcome, "blocked");
    assert.equal(decision.reasonCode, "remote.repo_version_mismatch");
    assert.equal(ticket?.status, "pending");
    assert.equal(decision.trace?.requiredRepoVersion, "repo-main@abc123");
    assert.ok(
      decision.trace?.evaluations.some(
        (item) => item.workerId === "worker-remote-repo-old" && item.rejectionReason === "worker_repo_version_mismatch",
      ),
    );
  } finally {
    cleanupPath(workspace);
  }
});

test("execution dispatch service falls back to local when prefer_remote only sees remote sessions that are not dispatch-ready", () => {
  const workspace = createTempWorkspace("aa-execution-dispatch-");
  const dbPath = join(workspace, "execution-dispatch-remote-session-fallback.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const workers = new WorkerRegistryService(store);
    const dispatch = new ExecutionDispatchService(db, store);
    seedTaskAndExecution(db, store, {
      taskId: "task-dispatch-remote-session-fallback",
      executionId: "exec-dispatch-remote-session-fallback",
      traceId: "trace-dispatch-remote-session-fallback",
    });

    db.connection.prepare(`UPDATE executions SET status = ? WHERE id = ?`).run("created", "exec-dispatch-remote-session-fallback");
    workers.recordHeartbeat({
      workerId: "worker-local-session-fallback",
      status: "idle",
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      queueAffinity: "default",
      occurredAt: "2026-04-04T10:11:00.000Z",
    });
    workers.recordHeartbeat({
      workerId: "worker-remote-viewer-only",
      status: "idle",
      placement: "remote",
      registrationVerifiedAt: "2026-04-04T10:11:00.000Z",
      remoteSessionStatus: "viewer_only",
      lastAcknowledgedStreamOffset: "stream:50",
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      queueAffinity: "default",
      occurredAt: "2026-04-04T10:11:00.000Z",
    });

    dispatch.createTicket({
      executionId: "exec-dispatch-remote-session-fallback",
      priority: "high",
      queueName: "default",
      dispatchTarget: "prefer_remote",
      requiredCapabilities: ["bash"],
      occurredAt: "2026-04-04T10:11:05.000Z",
    });
    const decision = dispatch.dispatchNext({
      queueName: "default",
      leaseTtlMs: 30_000,
      occurredAt: "2026-04-04T10:11:06.000Z",
    });
    db.close();

    assert.equal(decision.outcome, "dispatched");
    assert.equal(decision.worker?.workerId, "worker-local-session-fallback");
    assert.equal(decision.reasonCode, "remote.fallback_local.session_unready");
    assert.equal(decision.trace?.remoteAvailability, "degraded");
    assert.ok(
      decision.trace?.evaluations.some(
        (item) =>
          item.workerId === "worker-remote-viewer-only"
          && item.rejectionReason === "worker_remote_session_unready"
          && item.remoteSessionStatus === "viewer_only",
      ),
    );
  } finally {
    cleanupPath(workspace);
  }
});

test("execution dispatch service fail-closes when require_remote only sees remote sessions that are not dispatch-ready", () => {
  const workspace = createTempWorkspace("aa-execution-dispatch-");
  const dbPath = join(workspace, "execution-dispatch-remote-session-blocked.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const workers = new WorkerRegistryService(store);
    const dispatch = new ExecutionDispatchService(db, store);
    seedTaskAndExecution(db, store, {
      taskId: "task-dispatch-remote-session-blocked",
      executionId: "exec-dispatch-remote-session-blocked",
      traceId: "trace-dispatch-remote-session-blocked",
    });

    db.connection.prepare(`UPDATE executions SET status = ? WHERE id = ?`).run("created", "exec-dispatch-remote-session-blocked");
    workers.recordHeartbeat({
      workerId: "worker-remote-reconnecting",
      status: "idle",
      placement: "remote",
      registrationVerifiedAt: "2026-04-04T10:12:00.000Z",
      remoteSessionStatus: "reconnecting",
      lastAcknowledgedStreamOffset: "stream:60",
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      queueAffinity: "default",
      occurredAt: "2026-04-04T10:12:00.000Z",
    });

    const created = dispatch.createTicket({
      executionId: "exec-dispatch-remote-session-blocked",
      priority: "high",
      queueName: "default",
      dispatchTarget: "require_remote",
      requiredCapabilities: ["bash"],
      occurredAt: "2026-04-04T10:12:05.000Z",
    });
    const decision = dispatch.dispatchNext({
      queueName: "default",
      leaseTtlMs: 30_000,
      occurredAt: "2026-04-04T10:12:06.000Z",
    });
    const ticket = store.getExecutionTicket(created.ticket.id);
    db.close();

    assert.equal(decision.outcome, "blocked");
    assert.equal(decision.reasonCode, "remote.session_unready");
    assert.equal(ticket?.status, "pending");
    assert.equal(decision.trace?.remoteAvailability, "degraded");
    assert.ok(
      decision.trace?.evaluations.some(
        (item) =>
          item.workerId === "worker-remote-reconnecting"
          && item.rejectionReason === "worker_remote_session_unready"
          && item.remoteSessionStatus === "reconnecting",
      ),
    );
  } finally {
    cleanupPath(workspace);
  }
});

test("execution dispatch service treats connected remote workers without resume offsets as session-unready", () => {
  const workspace = createTempWorkspace("aa-execution-dispatch-");
  const dbPath = join(workspace, "execution-dispatch-remote-offset-missing.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const workers = new WorkerRegistryService(store);
    const dispatch = new ExecutionDispatchService(db, store);
    seedTaskAndExecution(db, store, {
      taskId: "task-dispatch-remote-offset-missing",
      executionId: "exec-dispatch-remote-offset-missing",
      traceId: "trace-dispatch-remote-offset-missing",
    });

    db.connection.prepare(`UPDATE executions SET status = ? WHERE id = ?`).run("created", "exec-dispatch-remote-offset-missing");
    workers.recordHeartbeat({
      workerId: "worker-local-offset-fallback",
      status: "idle",
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      queueAffinity: "default",
      occurredAt: "2026-04-04T10:13:00.000Z",
    });
    workers.recordHeartbeat({
      workerId: "worker-remote-offset-missing",
      status: "idle",
      placement: "remote",
      registrationVerifiedAt: "2026-04-04T10:13:00.000Z",
      remoteSessionStatus: "connected",
      lastAcknowledgedStreamOffset: null,
      sessionConsistencyCheckStatus: "passed",
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      queueAffinity: "default",
      occurredAt: "2026-04-04T10:13:00.000Z",
    });

    dispatch.createTicket({
      executionId: "exec-dispatch-remote-offset-missing",
      priority: "high",
      queueName: "default",
      dispatchTarget: "prefer_remote",
      requiredCapabilities: ["bash"],
      occurredAt: "2026-04-04T10:13:05.000Z",
    });
    const decision = dispatch.dispatchNext({
      queueName: "default",
      leaseTtlMs: 30_000,
      occurredAt: "2026-04-04T10:13:06.000Z",
    });
    db.close();

    assert.equal(decision.outcome, "dispatched");
    assert.equal(decision.worker?.workerId, "worker-local-offset-fallback");
    assert.equal(decision.reasonCode, "remote.fallback_local.session_unready");
    assert.ok(
      decision.trace?.evaluations.some(
        (item) =>
          item.workerId === "worker-remote-offset-missing"
          && item.rejectionReason === "worker_remote_session_unready"
          && item.remoteSessionStatus === "connected"
          && item.lastAcknowledgedStreamOffset == null,
      ),
    );
  } finally {
    cleanupPath(workspace);
  }
});

test("execution dispatch service blocks require_remote when connected remote workers fail consistency checks", () => {
  const workspace = createTempWorkspace("aa-execution-dispatch-");
  const dbPath = join(workspace, "execution-dispatch-remote-mismatch-blocked.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const workers = new WorkerRegistryService(store);
    const dispatch = new ExecutionDispatchService(db, store);
    seedTaskAndExecution(db, store, {
      taskId: "task-dispatch-remote-mismatch-blocked",
      executionId: "exec-dispatch-remote-mismatch-blocked",
      traceId: "trace-dispatch-remote-mismatch-blocked",
    });

    db.connection.prepare(`UPDATE executions SET status = ? WHERE id = ?`).run("created", "exec-dispatch-remote-mismatch-blocked");
    workers.recordHeartbeat({
      workerId: "worker-remote-mismatch",
      status: "idle",
      placement: "remote",
      registrationVerifiedAt: "2026-04-04T10:14:00.000Z",
      remoteSessionStatus: "connected",
      lastAcknowledgedStreamOffset: "stream:61",
      sessionConsistencyCheckStatus: "mismatch",
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      queueAffinity: "default",
      occurredAt: "2026-04-04T10:14:00.000Z",
    });

    const created = dispatch.createTicket({
      executionId: "exec-dispatch-remote-mismatch-blocked",
      priority: "high",
      queueName: "default",
      dispatchTarget: "require_remote",
      requiredCapabilities: ["bash"],
      occurredAt: "2026-04-04T10:14:05.000Z",
    });
    const decision = dispatch.dispatchNext({
      queueName: "default",
      leaseTtlMs: 30_000,
      occurredAt: "2026-04-04T10:14:06.000Z",
    });
    const ticket = store.getExecutionTicket(created.ticket.id);
    db.close();

    assert.equal(decision.outcome, "blocked");
    assert.equal(decision.reasonCode, "remote.session_unready");
    assert.equal(ticket?.status, "pending");
    assert.ok(
      decision.trace?.evaluations.some(
        (item) =>
          item.workerId === "worker-remote-mismatch"
          && item.rejectionReason === "worker_remote_session_unready"
          && item.sessionConsistencyCheckStatus === "mismatch",
      ),
    );
  } finally {
    cleanupPath(workspace);
  }
});

test("execution dispatch service blocks require_remote when remote workspace sync ownership conflicts", () => {
  const workspace = createTempWorkspace("aa-execution-dispatch-");
  const dbPath = join(workspace, "execution-dispatch-remote-workspace-conflict.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const workers = new WorkerRegistryService(store);
    const dispatch = new ExecutionDispatchService(db, store);
    seedTaskAndExecution(db, store, {
      taskId: "task-dispatch-remote-workspace-conflict",
      executionId: "exec-dispatch-remote-workspace-conflict",
      traceId: "trace-dispatch-remote-workspace-conflict",
    });

    db.connection.prepare(`UPDATE executions SET status = ? WHERE id = ?`).run("created", "exec-dispatch-remote-workspace-conflict");
    workers.recordHeartbeat({
      workerId: "worker-remote-workspace-conflict",
      status: "idle",
      placement: "remote",
      registrationVerifiedAt: "2026-04-07T10:14:00.000Z",
      remoteSessionStatus: "connected",
      lastAcknowledgedStreamOffset: "stream:71",
      sessionConsistencyCheckStatus: "passed",
      workspaceSyncStatus: "conflict",
      workspaceSyncCheckedAt: "2026-04-07T10:14:00.000Z",
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      queueAffinity: "default",
      occurredAt: "2026-04-07T10:14:00.000Z",
    });

    const created = dispatch.createTicket({
      executionId: "exec-dispatch-remote-workspace-conflict",
      priority: "high",
      queueName: "default",
      dispatchTarget: "require_remote",
      requiredCapabilities: ["bash"],
      occurredAt: "2026-04-07T10:14:05.000Z",
    });
    const decision = dispatch.dispatchNext({
      queueName: "default",
      leaseTtlMs: 30_000,
      occurredAt: "2026-04-07T10:14:06.000Z",
    });
    const ticket = store.getExecutionTicket(created.ticket.id);
    db.close();

    assert.equal(decision.outcome, "blocked");
    assert.equal(decision.reasonCode, "remote.session_unready");
    assert.equal(ticket?.status, "pending");
    assert.ok(
      decision.trace?.evaluations.some(
        (item) =>
          item.workerId === "worker-remote-workspace-conflict"
          && item.rejectionReason === "worker_remote_session_unready"
          && item.workspaceSyncStatus === "conflict",
      ),
    );
  } finally {
    cleanupPath(workspace);
  }
});

test("execution dispatch service fail-closes require_remote with an explicit partial_available reason when remote workers exist but none are eligible", () => {
  const workspace = createTempWorkspace("aa-execution-dispatch-");
  const dbPath = join(workspace, "execution-dispatch-require-remote-partial.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const workers = new WorkerRegistryService(store);
    const dispatch = new ExecutionDispatchService(db, store);
    seedTaskAndExecution(db, store, {
      taskId: "task-dispatch-require-remote-partial",
      executionId: "exec-dispatch-require-remote-partial",
      traceId: "trace-dispatch-require-remote-partial",
    });

    db.connection.prepare(`UPDATE executions SET status = ? WHERE id = ?`).run("created", "exec-dispatch-require-remote-partial");
    workers.recordHeartbeat({
      workerId: "worker-remote-capacity-full",
      status: "busy",
      placement: "remote",
      registrationVerifiedAt: "2026-04-06T13:00:00.000Z",
      remoteSessionStatus: "connected",
      lastAcknowledgedStreamOffset: "stream:71",
      capabilities: ["bash"],
      runningExecutionIds: ["exec-other"],
      maxConcurrency: 1,
      queueAffinity: "default",
      occurredAt: "2026-04-06T13:00:00.000Z",
    });
    workers.recordHeartbeat({
      workerId: "worker-remote-missing-capability",
      status: "idle",
      placement: "remote",
      registrationVerifiedAt: "2026-04-06T13:00:00.000Z",
      remoteSessionStatus: "connected",
      lastAcknowledgedStreamOffset: "stream:72",
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      queueAffinity: "default",
      occurredAt: "2026-04-06T13:00:00.000Z",
    });
    workers.recordHeartbeat({
      workerId: "worker-local-ineligible-for-require-remote",
      status: "idle",
      capabilities: ["bash", "edit"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      queueAffinity: "default",
      occurredAt: "2026-04-06T13:00:00.000Z",
    });

    const created = dispatch.createTicket({
      executionId: "exec-dispatch-require-remote-partial",
      queueName: "default",
      dispatchTarget: "require_remote",
      requiredCapabilities: ["bash", "edit"],
      occurredAt: "2026-04-06T13:00:05.000Z",
    });
    const decision = dispatch.dispatchNext({
      queueName: "default",
      leaseTtlMs: 30_000,
      occurredAt: "2026-04-06T13:00:06.000Z",
    });
    const ticket = store.getExecutionTicket(created.ticket.id);
    db.close();

    assert.equal(decision.outcome, "blocked");
    assert.equal(decision.reasonCode, "remote.partial_available");
    assert.equal(ticket?.status, "pending");
    assert.equal(decision.trace?.remoteAvailability, "partial_available");
    assert.ok(
      decision.trace?.evaluations.some(
        (item) => item.workerId === "worker-remote-capacity-full" && item.rejectionReason === "worker_capacity_full",
      ),
    );
    assert.ok(
      decision.trace?.evaluations.some(
        (item) =>
          item.workerId === "worker-remote-missing-capability" && item.rejectionReason === "missing_capabilities",
      ),
    );
  } finally {
    cleanupPath(workspace);
  }
});

test("execution dispatch service routes hardened work only to workers meeting the required isolation level", () => {
  const workspace = createTempWorkspace("aa-execution-dispatch-");
  const dbPath = join(workspace, "execution-dispatch-isolation.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const workers = new WorkerRegistryService(store);
    const dispatch = new ExecutionDispatchService(db, store);
    seedTaskAndExecution(db, store, {
      taskId: "task-dispatch-isolation",
      executionId: "exec-dispatch-isolation",
      traceId: "trace-dispatch-isolation",
    });

    db.connection.prepare(`UPDATE executions SET status = ? WHERE id = ?`).run("created", "exec-dispatch-isolation");
    workers.recordHeartbeat({
      workerId: "worker-standard-isolation",
      status: "idle",
      isolationLevel: "standard",
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      queueAffinity: "default",
      occurredAt: "2026-04-04T10:09:00.000Z",
    });
    workers.recordHeartbeat({
      workerId: "worker-strict-isolation",
      status: "idle",
      isolationLevel: "strict",
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      queueAffinity: "default",
      occurredAt: "2026-04-04T10:09:00.000Z",
    });

    dispatch.createTicket({
      executionId: "exec-dispatch-isolation",
      queueName: "default",
      requiredIsolationLevel: "hardened",
      requiredCapabilities: ["bash"],
      occurredAt: "2026-04-04T10:09:05.000Z",
    });
    const decision = dispatch.dispatchNext({
      queueName: "default",
      leaseTtlMs: 30_000,
      occurredAt: "2026-04-04T10:09:06.000Z",
    });
    db.close();

    assert.equal(decision.outcome, "dispatched");
    assert.equal(decision.worker?.workerId, "worker-strict-isolation");
    assert.equal(decision.trace?.requiredIsolationLevel, "hardened");
    assert.ok(
      decision.trace?.evaluations.some(
        (item) => item.workerId === "worker-standard-isolation" && item.rejectionReason === "worker_isolation_mismatch",
      ),
    );
    assert.ok(
      decision.trace?.evaluations.some(
        (item) => item.workerId === "worker-strict-isolation" && item.rejectionReason === null && item.isolationLevel === "strict",
      ),
    );
  } finally {
    cleanupPath(workspace);
  }
});

test("execution dispatch service leaves a ticket pending when no worker satisfies the required isolation level", () => {
  const workspace = createTempWorkspace("aa-execution-dispatch-");
  const dbPath = join(workspace, "execution-dispatch-isolation-blocked.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const workers = new WorkerRegistryService(store);
    const dispatch = new ExecutionDispatchService(db, store);
    seedTaskAndExecution(db, store, {
      taskId: "task-dispatch-isolation-blocked",
      executionId: "exec-dispatch-isolation-blocked",
      traceId: "trace-dispatch-isolation-blocked",
    });

    db.connection.prepare(`UPDATE executions SET status = ? WHERE id = ?`).run("created", "exec-dispatch-isolation-blocked");
    workers.recordHeartbeat({
      workerId: "worker-standard-only",
      status: "idle",
      isolationLevel: "standard",
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      queueAffinity: "default",
      occurredAt: "2026-04-04T10:10:00.000Z",
    });

    const created = dispatch.createTicket({
      executionId: "exec-dispatch-isolation-blocked",
      queueName: "default",
      requiredIsolationLevel: "strict",
      requiredCapabilities: ["bash"],
      occurredAt: "2026-04-04T10:10:05.000Z",
    });
    const decision = dispatch.dispatchNext({
      queueName: "default",
      leaseTtlMs: 30_000,
      occurredAt: "2026-04-04T10:10:06.000Z",
    });
    const ticket = store.getExecutionTicket(created.ticket.id);
    db.close();

    assert.equal(decision.outcome, "no_worker");
    assert.equal(ticket?.status, "pending");
    assert.equal(decision.trace?.requiredIsolationLevel, "strict");
    assert.ok(
      decision.trace?.evaluations.some(
        (item) => item.workerId === "worker-standard-only" && item.rejectionReason === "worker_isolation_mismatch",
      ),
    );
  } finally {
    cleanupPath(workspace);
  }
});

test("execution dispatch service records quarantined workers as non-eligible administrative state", () => {
  const workspace = createTempWorkspace("aa-execution-dispatch-");
  const dbPath = join(workspace, "execution-dispatch-quarantined.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const workers = new WorkerRegistryService(store);
    const dispatch = new ExecutionDispatchService(db, store);
    seedTaskAndExecution(db, store, {
      taskId: "task-dispatch-quarantined",
      executionId: "exec-dispatch-quarantined",
      traceId: "trace-dispatch-quarantined",
    });

    db.connection.prepare(`UPDATE executions SET status = ? WHERE id = ?`).run("created", "exec-dispatch-quarantined");
    workers.recordHeartbeat({
      workerId: "worker-quarantined",
      status: "quarantined",
      placement: "remote",
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      queueAffinity: "default",
      occurredAt: "2026-04-04T10:09:00.000Z",
    });

    dispatch.createTicket({
      executionId: "exec-dispatch-quarantined",
      queueName: "default",
      requiredCapabilities: ["bash"],
      occurredAt: "2026-04-04T10:09:05.000Z",
    });
    const decision = dispatch.dispatchNext({
      queueName: "default",
      leaseTtlMs: 30_000,
      occurredAt: "2026-04-04T10:09:06.000Z",
    });
    db.close();

    assert.equal(decision.outcome, "no_worker");
    assert.ok(
      decision.trace?.evaluations.some(
        (item) =>
          item.workerId === "worker-quarantined"
          && item.rejectionReason === "worker_quarantined"
          && item.schedulingStatus === "quarantined",
      ),
    );
  } finally {
    cleanupPath(workspace);
  }
});

test("execution dispatch service leaves tickets pending when no worker satisfies the capability contract", () => {
  const workspace = createTempWorkspace("aa-execution-dispatch-");
  const dbPath = join(workspace, "execution-dispatch-no-worker.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const workers = new WorkerRegistryService(store);
    const dispatch = new ExecutionDispatchService(db, store);
    seedTaskAndExecution(db, store, {
      taskId: "task-dispatch-no-worker",
      executionId: "exec-dispatch-no-worker",
      traceId: "trace-dispatch-no-worker",
    });

    db.connection.prepare(`UPDATE executions SET status = ? WHERE id = ?`).run("created", "exec-dispatch-no-worker");
    workers.recordHeartbeat({
      workerId: "worker-basic",
      status: "idle",
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      queueAffinity: "default",
      occurredAt: "2026-04-04T10:00:00.000Z",
    });

    const created = dispatch.createTicket({
      executionId: "exec-dispatch-no-worker",
      queueName: "default",
      requiredCapabilities: ["mcp"],
      occurredAt: "2026-04-04T10:00:05.000Z",
    });
    const dispatched = dispatch.dispatchNext({
      queueName: "default",
      leaseTtlMs: 30_000,
      occurredAt: "2026-04-04T10:00:06.000Z",
    });
    const ticket = store.getExecutionTicket(created.ticket.id);
    const events = store.listEventsForTask("task-dispatch-no-worker");
    const decisionEvent = events.find((event) => event.eventType === "dispatch:decision_recorded");
    const decisionPayload = decisionEvent
      ? (JSON.parse(decisionEvent.payloadJson) as { outcome: string; evaluations: Array<{ workerId: string; rejectionReason: string | null }> })
      : null;
    db.close();

    assert.equal(created.outcome, "created");
    assert.equal(dispatched.outcome, "no_worker");
    assert.equal(ticket?.status, "pending");
    assert.equal(ticket?.assignedWorkerId, null);
    assert.equal(dispatched.trace?.outcome, "no_worker");
    assert.equal(decisionPayload?.outcome, "no_worker");
    assert.ok(decisionPayload?.evaluations.some((item) => item.workerId === "worker-basic" && item.rejectionReason === "missing_capabilities"));
  } finally {
    cleanupPath(workspace);
  }
});

test("execution dispatch service excludes draining workers from new claims while preserving the rejection trace", () => {
  const workspace = createTempWorkspace("aa-execution-dispatch-");
  const dbPath = join(workspace, "execution-dispatch-draining.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const workers = new WorkerRegistryService(store);
    const dispatch = new ExecutionDispatchService(db, store);
    seedTaskAndExecution(db, store, {
      taskId: "task-dispatch-draining",
      executionId: "exec-dispatch-draining",
      traceId: "trace-dispatch-draining",
    });

    db.connection.prepare(`UPDATE executions SET status = ? WHERE id = ?`).run("created", "exec-dispatch-draining");
    workers.recordHeartbeat({
      workerId: "worker-draining",
      status: "draining",
      capabilities: ["bash"],
      runningExecutionIds: ["exec-existing"],
      maxConcurrency: 2,
      queueAffinity: "default",
      occurredAt: "2026-04-04T10:10:00.000Z",
    });

    const created = dispatch.createTicket({
      executionId: "exec-dispatch-draining",
      queueName: "default",
      requiredCapabilities: ["bash"],
      occurredAt: "2026-04-04T10:10:05.000Z",
    });
    const dispatched = dispatch.dispatchNext({
      queueName: "default",
      leaseTtlMs: 30_000,
      occurredAt: "2026-04-04T10:10:06.000Z",
    });
    const ticket = store.getExecutionTicket(created.ticket.id);
    const decisionEvent = store
      .listEventsForTask("task-dispatch-draining")
      .find((event) => event.eventType === "dispatch:decision_recorded");
    const decisionPayload = decisionEvent
      ? (JSON.parse(decisionEvent.payloadJson) as {
          outcome: string;
          evaluations: Array<{ workerId: string; rejectionReason: string | null }>;
        })
      : null;
    db.close();

    assert.equal(dispatched.outcome, "no_worker");
    assert.equal(ticket?.status, "pending");
    assert.equal(decisionPayload?.outcome, "no_worker");
    assert.ok(
      decisionPayload?.evaluations.some(
        (item) => item.workerId === "worker-draining" && item.rejectionReason === "worker_draining",
      ),
    );
    assert.ok(
      dispatched.trace?.evaluations.some(
        (item) =>
          item.workerId === "worker-draining"
          && item.rejectionReason === "worker_draining"
          && item.schedulingStatus === "draining",
      ),
    );
  } finally {
    cleanupPath(workspace);
  }
});

test("execution dispatch service honors dispatch_after before routing tickets", () => {
  const workspace = createTempWorkspace("aa-execution-dispatch-");
  const dbPath = join(workspace, "execution-dispatch-delay.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const workers = new WorkerRegistryService(store);
    const dispatch = new ExecutionDispatchService(db, store);
    seedTaskAndExecution(db, store, {
      taskId: "task-dispatch-delay",
      executionId: "exec-dispatch-delay",
      traceId: "trace-dispatch-delay",
    });

    db.connection.prepare(`UPDATE executions SET status = ? WHERE id = ?`).run("created", "exec-dispatch-delay");
    workers.recordHeartbeat({
      workerId: "worker-delay",
      status: "idle",
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      queueAffinity: "default",
      occurredAt: "2026-04-04T10:00:00.000Z",
    });

    dispatch.createTicket({
      executionId: "exec-dispatch-delay",
      queueName: "default",
      requiredCapabilities: ["bash"],
      dispatchAfter: "2026-04-04T10:05:00.000Z",
      occurredAt: "2026-04-04T10:00:05.000Z",
    });
    const early = dispatch.dispatchNext({
      queueName: "default",
      leaseTtlMs: 30_000,
      occurredAt: "2026-04-04T10:01:00.000Z",
    });
    workers.recordHeartbeat({
      workerId: "worker-delay",
      status: "idle",
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      queueAffinity: "default",
      occurredAt: "2026-04-04T10:05:00.000Z",
    });
    const later = dispatch.dispatchNext({
      queueName: "default",
      leaseTtlMs: 30_000,
      occurredAt: "2026-04-04T10:05:01.000Z",
    });
    const events = store.listEventsForTask("task-dispatch-delay");
    db.close();

    assert.equal(early.outcome, "no_ticket");
    assert.equal(later.outcome, "dispatched");
    assert.equal(later.worker?.workerId, "worker-delay");
    assert.equal(events.filter((event) => event.eventType === "dispatch:decision_recorded").length, 1);
  } finally {
    cleanupPath(workspace);
  }
});

test("execution dispatch service blocks new claims when read-only backpressure mode is active", () => {
  const workspace = createTempWorkspace("aa-execution-dispatch-");
  const dbPath = join(workspace, "execution-dispatch-read-only.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const workers = new WorkerRegistryService(store);
    const dispatch = new ExecutionDispatchService(db, store, () => ({
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
    }));

    seedTaskAndExecution(db, store, {
      taskId: "task-dispatch-read-only",
      executionId: "exec-dispatch-read-only",
      traceId: "trace-dispatch-read-only",
    });
    db.connection.prepare(`UPDATE executions SET status = ? WHERE id = ?`).run("created", "exec-dispatch-read-only");
    workers.recordHeartbeat({
      workerId: "worker-read-only",
      status: "idle",
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      queueAffinity: "default",
      occurredAt: "2026-04-04T10:20:00.000Z",
    });

    const created = dispatch.createTicket({
      executionId: "exec-dispatch-read-only",
      queueName: "default",
      requiredCapabilities: ["bash"],
      occurredAt: "2026-04-04T10:20:05.000Z",
    });
    const decision = dispatch.dispatchNext({
      queueName: "default",
      leaseTtlMs: 30_000,
      occurredAt: "2026-04-04T10:20:06.000Z",
    });
    const ticket = store.getExecutionTicket(created.ticket.id);
    const events = store.listEventsForTask("task-dispatch-read-only");
    const decisionEvent = events.find((event) => event.eventType === "dispatch:decision_recorded");
    const decisionPayload = decisionEvent
      ? (JSON.parse(decisionEvent.payloadJson) as { outcome: string; reasonCode: string | null })
      : null;
    db.close();

    assert.equal(decision.outcome, "blocked");
    assert.equal(decision.reasonCode, "backpressure.read_only_mode");
    assert.equal(ticket?.status, "pending");
    assert.equal(decision.trace?.reasonCode, "backpressure.read_only_mode");
    assert.equal(decisionPayload?.outcome, "blocked");
    assert.equal(decisionPayload?.reasonCode, "backpressure.read_only_mode");
  } finally {
    cleanupPath(workspace);
  }
});

test("execution dispatch service sheds sticky load from an affinity hotspot when healthy general capacity is still available", () => {
  const workspace = createTempWorkspace("aa-execution-dispatch-");
  const dbPath = join(workspace, "execution-dispatch-load-skew.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const workers = new WorkerRegistryService(store);
    const dispatch = new ExecutionDispatchService(db, store);
    seedTaskAndExecution(db, store, {
      taskId: "task-dispatch-load-skew",
      executionId: "exec-dispatch-load-skew",
      traceId: "trace-dispatch-load-skew",
    });

    db.connection.prepare(`UPDATE executions SET status = ? WHERE id = ?`).run("created", "exec-dispatch-load-skew");
    workers.recordHeartbeat({
      workerId: "worker-affinity-hotspot",
      status: "busy",
      capabilities: ["bash"],
      runningExecutionIds: ["exec-other-1"],
      maxConcurrency: 4,
      queueAffinity: "default",
      activeLeaseCount: 3,
      saturation: 0.95,
      cpuPct: 84,
      toolBacklogCount: 3,
      occurredAt: "2026-04-07T18:00:00.000Z",
    });
    workers.recordHeartbeat({
      workerId: "worker-general-spare",
      status: "idle",
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      queueAffinity: null,
      activeLeaseCount: 0,
      saturation: 0.05,
      cpuPct: 9,
      toolBacklogCount: 0,
      occurredAt: "2026-04-07T18:00:00.000Z",
    });

    dispatch.createTicket({
      executionId: "exec-dispatch-load-skew",
      priority: "high",
      queueName: "default",
      requiredCapabilities: ["bash"],
      occurredAt: "2026-04-07T18:00:05.000Z",
    });
    const decision = dispatch.dispatchNext({
      queueName: "default",
      leaseTtlMs: 30_000,
      occurredAt: "2026-04-07T18:00:06.000Z",
    });
    db.close();

    assert.equal(decision.outcome, "dispatched");
    assert.equal(decision.worker?.workerId, "worker-general-spare");
    assert.ok(
      decision.trace?.evaluations.some(
        (item) =>
          item.workerId === "worker-affinity-hotspot" &&
          item.affinityMatched === true &&
          item.loadSkewPenaltyApplied === true &&
          (item.activeLeaseShare ?? 0) > 0.6,
      ),
    );
    assert.ok(
      decision.trace?.evaluations.some(
        (item) =>
          item.workerId === "worker-general-spare" &&
          item.dispatchScore != null &&
          item.loadSkewPenaltyApplied === false,
      ),
    );
  } finally {
    cleanupPath(workspace);
  }
});
