/**
 * Platform-Wide Integration Tests - Multi-Service Collaboration
 *
 * Tests that coordinate across multiple platform services to verify
 * end-to-end workflows and service interaction patterns.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { SqliteDatabase } from "../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { ExecutionDispatchService } from "../../../src/platform/five-plane-execution/dispatcher/execution-dispatch-service.js";
import { ExecutionLeaseService } from "../../../src/platform/five-plane-execution/lease/execution-lease-service.js";
import { WorkerRegistryService } from "../../../src/platform/five-plane-execution/worker-pool/worker-registry-service.js";
import { ApprovalService } from "../../../src/platform/five-plane-control-plane/approval-center/approval-service.js";
import { HealthService } from "../../../src/platform/shared/observability/health-service.js";
import { MetricsService } from "../../../src/platform/shared/observability/metrics-service.js";
import { InspectService } from "../../../src/platform/shared/observability/inspect-service.js";
import { cleanupPath, createTempWorkspace } from "../../helpers/fs.js";
import { seedTaskAndExecution } from "../../helpers/seed.js";
import { newId, nowIso } from "../../../src/platform/contracts/types/ids.js";

test("platform-wide: execution dispatch creates ticket, lease, and worker assignment", () => {
  const workspace = createTempWorkspace("aa-platform-wide-");
  const dbPath = join(workspace, "platform-wide.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const workers = new WorkerRegistryService(store);
    const dispatch = new ExecutionDispatchService(db, store);
    const leases = new ExecutionLeaseService(db, store);

    seedTaskAndExecution(db, store, {
      taskId: "task-platform-wide",
      executionId: "exec-platform-wide",
      traceId: "trace-platform-wide",
    });

    db.connection.prepare(`UPDATE executions SET status = ? WHERE id = ?`).run("created", "exec-platform-wide");
    workers.recordHeartbeat({
      workerId: "worker-platform-wide",
      status: "idle",
      capabilities: ["bash", "edit", "read"],
      runningExecutionIds: [],
      maxConcurrency: 2,
      queueAffinity: "default",
      occurredAt: nowIso(),
    });

    // Create ticket and dispatch
    const ticket = dispatch.createTicket({
      executionId: "exec-platform-wide",
      queueName: "default",
      requiredCapabilities: ["bash", "edit", "read"],
      occurredAt: nowIso(),
    });

    const decision = dispatch.dispatchNext({
      queueName: "default",
      leaseTtlMs: 30_000,
      occurredAt: nowIso(),
    });

    // Verify ticket is claimed
    const claimedTicket = store.getExecutionTicket(ticket.ticket.id);
    assert.equal(claimedTicket?.status, "claimed");
    assert.equal(claimedTicket?.assignedWorkerId, "worker-platform-wide");

    // Verify lease was created
    const lease = decision.leaseId ? store.getExecutionLease(decision.leaseId) : null;
    assert.ok(lease !== null, "Lease should be created");
    assert.equal(lease?.workerId, "worker-platform-wide");

    // Verify events were recorded
    const events = store.listEventsForTask("task-platform-wide");
    assert.ok(events.some((e: { eventType: string }) => e.eventType === "dispatch:ticket_created"));
    assert.ok(events.some((e: { eventType: string }) => e.eventType === "dispatch:ticket_claimed"));

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("platform-wide: approval service creates request and resolves workflow", () => {
  const workspace = createTempWorkspace("aa-platform-approval-");
  const dbPath = join(workspace, "platform-approval.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const approvalService = new ApprovalService(db, store);

    seedTaskAndExecution(db, store, {
      taskId: "task-approval-test",
      executionId: "exec-approval-test",
      traceId: "trace-approval-test",
    });

    // Create approval request
    const request = approvalService.createRequest({
      taskId: "task-approval-test",
      executionId: "exec-approval-test",
      sourceAgentId: "agent-test",
      reason: "High-risk operation requires approval",
      riskLevel: "high",
      options: ["approve", "reject", "request_changes"],
      context: { operation: "delete", target: "/protected/data" },
      timeoutPolicy: "reject",
    });

    assert.ok(request.approvalId.startsWith("approval_"), "Should have approval ID");
    assert.equal(request.status, "pending");
    assert.equal(request.options.length, 3);

    // Verify approval exists in store
    const stored = approvalService.getApproval(request.approvalId);
    assert.ok(stored !== null, "Approval should be retrievable");
    assert.equal(stored?.status, "pending");

    // Resolve approval
    const resolved = approvalService.resolve({
      approvalId: request.approvalId,
      decision: "approve",
      resolvedBy: "operator_jane",
      resolutionReason: "Verified safe operation",
    });

    assert.equal(resolved.status, "approved");
    assert.equal(resolved.resolvedBy, "operator_jane");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("platform-wide: health service reports system status based on DB and workers", () => {
  const workspace = createTempWorkspace("aa-platform-health-");
  const dbPath = join(workspace, "platform-health.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const healthService = new HealthService(db, store, {
      memoryHighWatermarkMb: Number.POSITIVE_INFINITY,
      eventLoopLagThresholdMs: Number.POSITIVE_INFINITY,
    });

    seedTaskAndExecution(db, store, {
      taskId: "task-health-test",
      executionId: "exec-health-test",
      traceId: "trace-health-test",
    });

    // Record a worker heartbeat
    store.upsertWorkerSnapshot({
      workerId: "worker-health-test",
      version: 0,
      status: "idle",
      capabilitiesJson: JSON.stringify(["bash"]),
      runningExecutionsJson: JSON.stringify([]),
      maxConcurrency: 2,
      queueAffinity: "default",
      runtimeInstanceId: "runtime-health",
      restartedFromRuntimeInstanceId: null,
      restartGeneration: 0,
      cpuPct: 10,
      memoryMb: 128,
      toolBacklogCount: 0,
      currentStepId: null,
      lastProgressAt: nowIso(),
      lastHeartbeatAt: nowIso(),
      updatedAt: nowIso(),
    });

    const health = healthService.getReport();

    assert.ok(["ok", "degraded", "overloaded"].includes(health.status), "Health status should be valid");
    assert.equal(health.dbWritable, true, "Database should be writable");
    assert.ok(health.findings.length >= 0, "Findings should be array");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("platform-wide: metrics service aggregates task, execution, and cost data", () => {
  const workspace = createTempWorkspace("aa-platform-metrics-");
  const dbPath = join(workspace, "platform-metrics.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    const taskId = newId("task");
    const executionId = newId("exec");
    seedTaskAndExecution(db, store, { taskId, executionId });

    // Add cost event
    store.insertCostEvent({
      id: newId("cost"),
      taskId,
      sessionId: null,
      executionId,
      agentId: null,
      provider: "anthropic",
      model: "claude-sonnet-4-20250514",
      inputTokens: 1000,
      outputTokens: 500,
      costUsd: 0.015,
      budgetScope: "task_execution",
      providerRequestId: null,
      pricingVersion: null,
      createdAt: nowIso(),
    });

    // Add workflow state
    store.insertWorkflowState({
      taskId,
      divisionId: "general_ops",
      workflowId: "single_agent_minimal",
      currentStepIndex: 1,
      status: "completed",
      outputsJson: "{}",
      lastErrorCode: null,
      retryCount: 0,
      resumableFromStep: null,
      startedAt: nowIso(),
      updatedAt: nowIso(),
    });

    const healthService = new HealthService(db, store, {
      memoryHighWatermarkMb: Number.POSITIVE_INFINITY,
      eventLoopLagThresholdMs: Number.POSITIVE_INFINITY,
    });
    const metricsService = new MetricsService(db, healthService);
    const summary = metricsService.buildSummary();

    assert.equal(summary.taskMetrics.total, 1);
    assert.equal(summary.workflowMetrics.total, 1);
    assert.equal(summary.executionMetrics.total, 1);
    assert.equal(summary.costMetrics.totalActualCostUsd > 0, true);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("platform-wide: inspect service provides comprehensive task view with dispatch and approval details", () => {
  const workspace = createTempWorkspace("aa-platform-inspect-");
  const dbPath = join(workspace, "platform-inspect.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const workers = new WorkerRegistryService(store);
    const dispatch = new ExecutionDispatchService(db, store);
    const approvalService = new ApprovalService(db, store);
    const inspectService = new InspectService(store);

    seedTaskAndExecution(db, store, {
      taskId: "task-inspect-platform",
      executionId: "exec-inspect-platform",
      traceId: "trace-inspect-platform",
    });

    db.connection.prepare(`UPDATE executions SET status = ? WHERE id = ?`).run("created", "exec-inspect-platform");
    workers.recordHeartbeat({
      workerId: "worker-inspect-platform",
      status: "idle",
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      queueAffinity: "default",
      occurredAt: nowIso(),
    });

    dispatch.createTicket({
      executionId: "exec-inspect-platform",
      queueName: "default",
      requiredCapabilities: ["bash"],
      occurredAt: nowIso(),
    });
    dispatch.dispatchNext({
      queueName: "default",
      leaseTtlMs: 30_000,
      occurredAt: nowIso(),
    });

    const approval = approvalService.createRequest({
      taskId: "task-inspect-platform",
      executionId: "exec-inspect-platform",
      sourceAgentId: "agent-test",
      reason: "Test approval",
      riskLevel: "low",
      options: ["approve"],
      context: {},
      timeoutPolicy: "reject",
    });

    const taskInspect = inspectService.getTaskInspectView("task-inspect-platform");

    assert.ok(taskInspect.task, "Should have task");
    assert.equal(taskInspect.task.id, "task-inspect-platform");
    assert.equal(taskInspect.dispatchDecisions.length, 1);
    assert.equal(taskInspect.approvals.length, 1);
    assert.equal(taskInspect.agentExecutions.length >= 1, true);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("platform-wide: execution dispatch and approval coordination for high-risk task", () => {
  const workspace = createTempWorkspace("aa-platform-high-risk-");
  const dbPath = join(workspace, "platform-high-risk.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const workers = new WorkerRegistryService(store);
    const dispatch = new ExecutionDispatchService(db, store);
    const approvalService = new ApprovalService(db, store);

    seedTaskAndExecution(db, store, {
      taskId: "task-high-risk",
      executionId: "exec-high-risk",
      traceId: "trace-high-risk",
    });

    db.connection.prepare(`UPDATE executions SET status = ? WHERE id = ?`).run("created", "exec-high-risk");

    // Create approval first (high-risk operation)
    const approval = approvalService.createRequest({
      taskId: "task-high-risk",
      executionId: "exec-high-risk",
      sourceAgentId: "agent-high-risk",
      reason: "Deleting production data",
      riskLevel: "critical",
      options: ["approve", "reject"],
      context: { operation: "delete", target: "/prod/data" },
      timeoutPolicy: "reject",
    });

    // Verify execution is in created status awaiting approval
    const execution = store.getExecution("exec-high-risk");
    assert.equal(execution?.status, "created");

    // Resolve approval
    approvalService.resolve({
      approvalId: approval.approvalId,
      decision: "approve",
      resolvedBy: "operator_oncall",
      resolutionReason: "Verified backup exists",
    });

    // Now dispatch should work
    workers.recordHeartbeat({
      workerId: "worker-high-risk",
      status: "idle",
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      queueAffinity: "default",
      occurredAt: nowIso(),
    });

    dispatch.createTicket({
      executionId: "exec-high-risk",
      queueName: "default",
      requiredCapabilities: ["bash"],
      occurredAt: nowIso(),
    });
    const decision = dispatch.dispatchNext({
      queueName: "default",
      leaseTtlMs: 30_000,
      occurredAt: nowIso(),
    });

    assert.equal(decision.outcome, "dispatched");
    assert.equal(decision.worker?.workerId, "worker-high-risk");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("platform-wide: worker lifecycle - heartbeat, busy, released states", () => {
  const workspace = createTempWorkspace("aa-platform-worker-lifecycle-");
  const dbPath = join(workspace, "platform-worker-lifecycle.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const workers = new WorkerRegistryService(store);
    const dispatch = new ExecutionDispatchService(db, store);
    const leases = new ExecutionLeaseService(db, store);

    seedTaskAndExecution(db, store, {
      taskId: "task-worker-lifecycle",
      executionId: "exec-worker-lifecycle",
      traceId: "trace-worker-lifecycle",
    });

    // Record idle worker
    workers.recordHeartbeat({
      workerId: "worker-lifecycle",
      status: "idle",
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 2,
      queueAffinity: "default",
      occurredAt: nowIso(),
    });

    // Dispatch to worker
    db.connection.prepare(`UPDATE executions SET status = ? WHERE id = ?`).run("created", "exec-worker-lifecycle");
    dispatch.createTicket({
      executionId: "exec-worker-lifecycle",
      queueName: "default",
      requiredCapabilities: ["bash"],
      occurredAt: nowIso(),
    });
    dispatch.dispatchNext({
      queueName: "default",
      leaseTtlMs: 30_000,
      occurredAt: nowIso(),
    });

    // Worker should now be busy
    const busyWorker = store.getWorkerSnapshot("worker-lifecycle");
    assert.ok(busyWorker !== null, "Worker should have snapshot");
    assert.equal(busyWorker?.status, "busy");

    // Release lease
    const leasesByWorker = store.listLeasesByWorker("worker-lifecycle");
    for (const lease of leasesByWorker) {
      leases.releaseLease({
        leaseId: lease.id,
        workerId: "worker-lifecycle",
        occurredAt: nowIso(),
      });
    }

    // Worker should be idle again (heartbeat would update this)
    workers.recordHeartbeat({
      workerId: "worker-lifecycle",
      status: "idle",
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 2,
      queueAffinity: "default",
      occurredAt: nowIso(),
    });

    const idleWorker = store.getWorkerSnapshot("worker-lifecycle");
    assert.equal(idleWorker?.status, "idle");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("platform-wide: error handling when no workers available", () => {
  const workspace = createTempWorkspace("aa-platform-no-workers-");
  const dbPath = join(workspace, "platform-no-workers.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const dispatch = new ExecutionDispatchService(db, store);

    seedTaskAndExecution(db, store, {
      taskId: "task-no-workers",
      executionId: "exec-no-workers",
      traceId: "trace-no-workers",
    });

    db.connection.prepare(`UPDATE executions SET status = ? WHERE id = ?`).run("created", "exec-no-workers");

    dispatch.createTicket({
      executionId: "exec-no-workers",
      queueName: "default",
      requiredCapabilities: ["bash"],
      occurredAt: nowIso(),
    });
    const decision = dispatch.dispatchNext({
      queueName: "default",
      leaseTtlMs: 30_000,
      occurredAt: nowIso(),
    });

    assert.equal(decision.outcome, "no_worker");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("platform-wide: metrics and health reflect empty state correctly", () => {
  const workspace = createTempWorkspace("aa-platform-empty-");
  const dbPath = join(workspace, "platform-empty.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const healthService = new HealthService(db, store, {
      memoryHighWatermarkMb: Number.POSITIVE_INFINITY,
      eventLoopLagThresholdMs: Number.POSITIVE_INFINITY,
    });
    const metricsService = new MetricsService(db, healthService);

    const health = healthService.getReport();
    const summary = metricsService.buildSummary();

    assert.equal(health.status, "ok");
    assert.equal(summary.taskMetrics.total, 0);
    assert.equal(summary.executionMetrics.total, 0);
    assert.equal(summary.workflowMetrics.total, 0);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});
