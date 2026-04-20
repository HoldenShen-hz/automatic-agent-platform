import test from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";

import { ApprovalService } from "../../../../../src/platform/control-plane/approval-center/approval-service.js";
import { ExecutionDispatchService } from "../../../../../src/platform/execution/dispatcher/execution-dispatch-service.js";
import { runSingleTaskExecution } from "../../../../../src/platform/execution/execution-engine/single-task-execution.js";
import { WorkerRegistryService } from "../../../../../src/platform/execution/worker-pool/worker-registry-service.js";
import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { InspectService } from "../../../../../src/platform/shared/observability/inspect-service.js";
import { HealthService } from "../../../../../src/platform/shared/observability/health-service.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { seedTaskAndExecution } from "../../../../helpers/seed.js";

test("inspect service reconstructs task view and health service reports ok", async () => {
  const workspace = createTempWorkspace("aa-observe-");
  const dbPath = join(workspace, "single-task.db");

  try {
    const snapshot = await runSingleTaskExecution({
      dbPath,
      title: "Inspect test",
      request: "Inspect a finished task",
    });

    const db = new SqliteDatabase(dbPath);
    const store = new AuthoritativeTaskStore(db);
    const inspectService = new InspectService(store);
    const healthService = new HealthService(db, store);
    const approvalService = new ApprovalService(db, store);

    const inspect = inspectService.getTaskInspectView(snapshot.task.id);
    const health = healthService.getReport();
    const approval = approvalService.createRequest({
      taskId: snapshot.task.id,
      executionId: snapshot.execution?.id ?? null,
      sourceAgentId: "agent_general_executor",
      reason: "Need inspection approval",
      riskLevel: "medium",
      options: ["approve", "reject"],
      context: { source: "inspect-test" },
      timeoutPolicy: "reject",
    });
    const executionInspect = inspectService.getExecutionInspectView(snapshot.execution?.id ?? "");
    const approvalInspect = inspectService.getApprovalInspectView(approval.approvalId);

    assert.equal(inspect.task.id, snapshot.task.id);
    assert.equal(inspect.workflowState?.status, "completed");
    assert.equal(inspect.approvals.length, 0);
    assert.equal(inspect.takeoverSessions.length, 0);
    assert.equal(inspect.operatorActions.length, 0);
    assert.equal(inspect.agentExecutions.length, 0);
    assert.equal(inspect.recentEvents.length, 3);
    assert.equal(inspect.artifacts.length, 1);
    assert.equal(inspect.runtimeRecovery.candidates.length, 1);
    assert.equal(inspect.runtimeRecovery.candidates[0]?.latestPrecheck?.allowed, true);
    assert.equal(inspect.runtimeRecovery.deadLetters.length, 0);
    assert.equal(executionInspect.execution.id, snapshot.execution?.id);
    assert.ok(executionInspect.executions.length >= 1);
    assert.equal(executionInspect.agentExecution, null);
    assert.equal(executionInspect.artifacts.length, 1);
    assert.equal(executionInspect.runtimeRecovery.candidates.length, 1);
    assert.equal(approvalInspect.approval.id, approval.approvalId);
    assert.equal(approvalInspect.approvals.length, 1);
    assert.equal(approvalInspect.agentExecution, null);
    assert.equal(approvalInspect.artifacts.length, 1);
    assert.equal(approvalInspect.runtimeRecovery.requestedApprovals.length, 1);
    assert.equal(health.dbWritable, true);
    assert.ok(["ok", "degraded", "overloaded"].includes(health.status));

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("inspect service exposes structured dispatch decision traces", () => {
  const workspace = createTempWorkspace("aa-observe-dispatch-");
  const dbPath = join(workspace, "dispatch-inspect.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const workers = new WorkerRegistryService(store);
    const dispatch = new ExecutionDispatchService(db, store);
    const inspectService = new InspectService(store);

    seedTaskAndExecution(db, store, {
      taskId: "task-observe-dispatch",
      executionId: "exec-observe-dispatch",
      traceId: "trace-observe-dispatch",
    });
    db.connection.prepare(`UPDATE executions SET status = ? WHERE id = ?`).run("created", "exec-observe-dispatch");
    workers.recordHeartbeat({
      workerId: "worker-observe-capable",
      status: "idle",
      capabilities: ["bash", "edit"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      queueAffinity: "default",
      occurredAt: "2026-04-04T16:10:00.000Z",
    });
    workers.recordHeartbeat({
      workerId: "worker-observe-basic",
      status: "idle",
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      queueAffinity: "default",
      occurredAt: "2026-04-04T16:10:00.000Z",
    });
    dispatch.createTicket({
      executionId: "exec-observe-dispatch",
      queueName: "default",
      requiredCapabilities: ["bash", "edit"],
      occurredAt: "2026-04-04T16:10:05.000Z",
    });
    dispatch.dispatchNext({
      queueName: "default",
      leaseTtlMs: 30_000,
      occurredAt: "2026-04-04T16:10:06.000Z",
    });

    const taskInspect = inspectService.getTaskInspectView("task-observe-dispatch");
    const executionInspect = inspectService.getExecutionInspectView("exec-observe-dispatch");

    assert.equal(taskInspect.dispatchDecisions.length, 1);
    assert.equal(taskInspect.agentExecutions.length, 1);
    assert.equal(taskInspect.agentExecutions[0]?.status, "dispatch_claimed");
    assert.equal(taskInspect.dispatchDecisions[0]?.selectedWorkerId, "worker-observe-capable");
    assert.ok(
      taskInspect.dispatchDecisions[0]?.evaluations.some(
        (evaluation) =>
          evaluation.workerId === "worker-observe-basic" && evaluation.rejectionReason === "missing_capabilities",
      ),
    );
    assert.equal(executionInspect.dispatchDecisions.length, 1);
    assert.equal(executionInspect.dispatchDecisions[0]?.outcome, "dispatched");
    assert.equal(executionInspect.agentExecution?.status, "dispatch_claimed");
    assert.equal(executionInspect.agentExecution?.lastDecisionJson != null, true);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("inspect service exposes remote fallback routing summaries for remote-aware triage", () => {
  const workspace = createTempWorkspace("aa-observe-remote-routing-");
  const dbPath = join(workspace, "remote-routing-inspect.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const workers = new WorkerRegistryService(store);
    const dispatch = new ExecutionDispatchService(db, store);
    const inspectService = new InspectService(store);

    seedTaskAndExecution(db, store, {
      taskId: "task-observe-remote-routing",
      executionId: "exec-observe-remote-routing",
      traceId: "trace-observe-remote-routing",
    });
    db.connection.prepare(`UPDATE executions SET status = ? WHERE id = ?`).run("created", "exec-observe-remote-routing");
    workers.recordHeartbeat({
      workerId: "worker-observe-remote-offline",
      status: "offline",
      placement: "remote",
      capabilities: ["bash", "edit"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      queueAffinity: "default",
      occurredAt: "2026-04-05T08:10:00.000Z",
    });
    workers.recordHeartbeat({
      workerId: "worker-observe-local-fallback",
      status: "idle",
      placement: "local",
      capabilities: ["bash", "edit"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      queueAffinity: "default",
      occurredAt: "2026-04-05T08:10:00.000Z",
    });
    dispatch.createTicket({
      executionId: "exec-observe-remote-routing",
      queueName: "default",
      dispatchTarget: "prefer_remote",
      requiredCapabilities: ["bash", "edit"],
      occurredAt: "2026-04-05T08:10:05.000Z",
    });
    dispatch.dispatchNext({
      queueName: "default",
      leaseTtlMs: 30_000,
      occurredAt: "2026-04-05T08:10:06.000Z",
    });

    const taskInspect = inspectService.getTaskInspectView("task-observe-remote-routing");

    assert.equal(taskInspect.dispatchDecisions.length, 1);
    assert.equal(taskInspect.dispatchDecisions[0]?.selectedWorkerPlacement, "local");
    assert.equal(taskInspect.dispatchDecisions[0]?.fallbackApplied, true);
    assert.equal(taskInspect.dispatchDecisions[0]?.remoteAvailability, "unavailable");
    assert.deepEqual(taskInspect.dispatchDecisions[0]?.remoteRejectedWorkerIds, ["worker-observe-remote-offline"]);
    assert.equal(taskInspect.remoteRoutingSummary.remoteDecisionCount, 1);
    assert.equal(taskInspect.remoteRoutingSummary.localFallbackCount, 1);
    assert.equal(taskInspect.remoteRoutingSummary.latestSelectedWorkerPlacement, "local");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("inspect service query layer lists task workflow and decision summaries for operator triage", () => {
  const workspace = createTempWorkspace("aa-observe-query-");
  const dbPath = join(workspace, "inspect-query.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const approvals = new ApprovalService(db, store);
    const workers = new WorkerRegistryService(store);
    const dispatch = new ExecutionDispatchService(db, store);
    const inspectService = new InspectService(store);

    seedTaskAndExecution(db, store, {
      taskId: "task-observe-query",
      executionId: "exec-observe-query",
      traceId: "trace-observe-query",
    });
    db.transaction(() => {
      store.insertWorkflowState({
        taskId: "task-observe-query",
        divisionId: "general_ops",
        workflowId: "single_agent_minimal",
        currentStepIndex: 0,
        status: "running",
        outputsJson: "{}",
        lastErrorCode: null,
        retryCount: 0,
        resumableFromStep: null,
        startedAt: "2026-04-05T12:00:00.000Z",
        updatedAt: "2026-04-05T12:00:00.000Z",
      });
      store.insertSession({
        id: "sess-observe-query",
        taskId: "task-observe-query",
        channel: "integration",
        status: "open",
        externalSessionId: null,
        createdAt: "2026-04-05T12:00:00.000Z",
        updatedAt: "2026-04-05T12:00:00.000Z",
      });
    });
    db.connection.prepare(`UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?`).run(
      "awaiting_decision",
      "2026-04-05T12:00:00.000Z",
      "task-observe-query",
    );
    db.connection.prepare(`UPDATE executions SET status = ?, updated_at = ? WHERE id = ?`).run(
      "created",
      "2026-04-05T12:00:00.000Z",
      "exec-observe-query",
    );
    const approval = approvals.createRequest({
      taskId: "task-observe-query",
      executionId: "exec-observe-query",
      sourceAgentId: "agent-observe-query",
      reason: "Need query approval",
      riskLevel: "high",
      options: ["approve", "reject"],
      context: { sessionId: "observe-query-session" },
      timeoutPolicy: "reject",
    });
    workers.recordHeartbeat({
      workerId: "worker-observe-query",
      status: "idle",
      capabilities: ["bash", "edit"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      queueAffinity: "default",
      occurredAt: "2026-04-05T12:00:05.000Z",
    });
    dispatch.createTicket({
      executionId: "exec-observe-query",
      queueName: "default",
      requiredCapabilities: ["bash", "edit"],
      occurredAt: "2026-04-05T12:00:06.000Z",
    });
    dispatch.dispatchNext({
      queueName: "default",
      leaseTtlMs: 30_000,
      occurredAt: "2026-04-05T12:00:07.000Z",
    });

    const taskSummaries = inspectService.queryTaskInspectSummaries({
      taskStatus: "awaiting_decision",
      hasPendingApproval: true,
    });
    const workflowSummaries = inspectService.queryWorkflowInspectSummaries({
      workflowId: "single_agent_minimal",
      workflowStatus: "running",
    });
    const decisionSummaries = inspectService.queryDecisionInspectSummaries({
      taskId: "task-observe-query",
    });

    assert.equal(taskSummaries.length, 1);
    assert.equal(taskSummaries[0]?.taskId, "task-observe-query");
    assert.equal(taskSummaries[0]?.pendingApprovalCount, 1);
    assert.equal(taskSummaries[0]?.dispatchDecisionCount, 1);
    assert.equal(workflowSummaries.length, 1);
    assert.equal(workflowSummaries[0]?.taskId, "task-observe-query");
    assert.equal(workflowSummaries[0]?.activeExecutionId, "exec-observe-query");
    assert.equal(decisionSummaries.length, 2);
    assert.ok(
      decisionSummaries.some(
        (summary) => summary.decisionType === "approval" && summary.decisionId === approval.approvalId,
      ),
    );
    assert.ok(
      decisionSummaries.some(
        (summary) => summary.decisionType === "dispatch" && summary.selectedWorkerId === "worker-observe-query",
      ),
    );

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("health service surfaces queue governance and stale worker findings", () => {
  const workspace = createTempWorkspace("aa-observe-health-findings-");
  const dbPath = join(workspace, "health-findings.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const healthService = new HealthService(db, store, {
      queueStarvationThresholdSeconds: 30,
      staleWorkerThresholdMs: 30_000,
    });
    const oldIso = new Date(Date.now() - 2 * 60_000).toISOString();

    seedTaskAndExecution(db, store, {
      taskId: "task-health-findings",
      executionId: "exec-health-findings",
      traceId: "trace-health-findings",
    });
    db.connection.prepare(`UPDATE executions SET status = ?, updated_at = ? WHERE id = ?`).run(
      "created",
      oldIso,
      "exec-health-findings",
    );
    store.insertExecutionTicket({
      id: "ticket-health-findings",
      executionId: "exec-health-findings",
      taskId: "task-health-findings",
      priority: "normal",
      queueName: "default",
      requiredCapabilitiesJson: JSON.stringify(["bash"]),
      dispatchAfter: null,
      attempt: 1,
      status: "pending",
      assignedWorkerId: null,
      leaseId: null,
      claimedAt: null,
      consumedAt: null,
      invalidatedAt: null,
      createdAt: oldIso,
      updatedAt: oldIso,
    });
    store.upsertWorkerSnapshot({
      workerId: "worker-health-findings",
      status: "busy",
      capabilitiesJson: JSON.stringify(["bash"]),
      runningExecutionsJson: JSON.stringify(["exec-health-findings"]),
      maxConcurrency: 1,
      queueAffinity: "default",
      runtimeInstanceId: "runtime-health-findings",
      restartedFromRuntimeInstanceId: null,
      restartGeneration: 0,
      cpuPct: 75,
      memoryMb: 192,
      toolBacklogCount: 1,
      currentStepId: "analyze_request",
      lastProgressAt: oldIso,
      lastHeartbeatAt: oldIso,
      updatedAt: oldIso,
    });

    const health = healthService.getReport();

    assert.equal(health.status, "overloaded");
    assert.equal(health.degradationMode, "queue_only");
    assert.equal(health.queueGovernance.backlogSize, 1);
    assert.equal(health.queueGovernance.starvationDetected, true);
    assert.equal(health.workerHealth.staleWorkers, 1);
    assert.ok(health.findings.includes("queue_starvation_detected"));
    assert.ok(health.findings.includes("stale_workers_detected"));

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("health service surfaces sticky load skew findings when an affinity hotspot dominates worker leases", () => {
  const workspace = createTempWorkspace("aa-observe-health-load-skew-");
  const dbPath = join(workspace, "health-load-skew.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const nowIso = new Date().toISOString();
    store.upsertWorkerSnapshot({
      workerId: "worker-hotspot",
      status: "busy",
      capabilitiesJson: JSON.stringify(["bash"]),
      runningExecutionsJson: JSON.stringify(["exec-hotspot"]),
      maxConcurrency: 4,
      queueAffinity: "default",
      activeLeaseCount: 3,
      saturation: 0.95,
      runtimeInstanceId: "runtime-hotspot",
      restartedFromRuntimeInstanceId: null,
      restartGeneration: 0,
      cpuPct: 86,
      memoryMb: 384,
      toolBacklogCount: 4,
      currentStepId: "draft_solution",
      lastProgressAt: nowIso,
      lastHeartbeatAt: nowIso,
      updatedAt: nowIso,
    });
    store.upsertWorkerSnapshot({
      workerId: "worker-spare",
      status: "idle",
      capabilitiesJson: JSON.stringify(["bash"]),
      runningExecutionsJson: JSON.stringify([]),
      maxConcurrency: 1,
      queueAffinity: null,
      activeLeaseCount: 0,
      saturation: 0.04,
      runtimeInstanceId: "runtime-spare",
      restartedFromRuntimeInstanceId: null,
      restartGeneration: 0,
      cpuPct: 8,
      memoryMb: 64,
      toolBacklogCount: 0,
      currentStepId: null,
      lastProgressAt: nowIso,
      lastHeartbeatAt: nowIso,
      updatedAt: nowIso,
    });

    const health = new HealthService(db, store).getReport();

    assert.equal(health.status, "degraded");
    assert.equal(health.workerHealth.loadSkewDetected, true);
    assert.equal(health.workerHealth.dominantWorkerId, "worker-hotspot");
    assert.ok(health.findings.includes("worker_load_skew_detected"));

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});
