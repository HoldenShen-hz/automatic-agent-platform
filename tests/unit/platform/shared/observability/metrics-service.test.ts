import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { ApprovalService } from "../../../../../src/platform/control-plane/approval-center/approval-service.js";
import { HealthService } from "../../../../../src/platform/shared/observability/health-service.js";
import { MetricsService } from "../../../../../src/platform/shared/observability/metrics-service.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { newId } from "../../../../../src/platform/contracts/types/ids.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { seedTaskAndExecution } from "../../../../helpers/seed.js";

test("metrics service returns empty metrics structure when no data exists", () => {
  const workspace = createTempWorkspace("aa-metrics-empty-");
  const dbPath = join(workspace, "metrics-empty.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const approvals = new ApprovalService(db, store);

    const summary = new MetricsService(
      db,
      new HealthService(db, store, {
        nowMsSupplier: () => Date.parse("2026-04-06T08:14:59.000Z"),
      }),
    ).buildSummary("2026-04-06T08:14:59.000Z");

    // Verify structure exists with expected fields
    assert.ok(typeof summary.generatedAt === "string");
    assert.ok(summary.window !== undefined);
    assert.ok(summary.taskMetrics !== undefined);
    assert.ok(summary.workflowMetrics !== undefined);
    assert.ok(summary.executionMetrics !== undefined);
    assert.ok(summary.recoveryMetrics !== undefined);
    assert.ok(summary.stepMetrics !== undefined);
    assert.ok(summary.costMetrics !== undefined);
    assert.ok(summary.approvalMetrics !== undefined);
    assert.ok(summary.eventMetrics !== undefined);
    assert.ok(summary.runtimeMetrics !== undefined);

    // Task metrics structure
    assert.ok(typeof summary.taskMetrics.total === "number");
    assert.ok(typeof summary.taskMetrics.successRate === "number" || summary.taskMetrics.successRate === null);
    assert.ok(typeof summary.taskMetrics.completionRate === "number" || summary.taskMetrics.completionRate === null);

    // Runtime metrics structure
    assert.ok(["ok", "degraded", "unhealthy", "overloaded"].includes(summary.runtimeMetrics.status));

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

function seedWorkflowState(
  store: AuthoritativeTaskStore,
  input: {
    taskId: string;
    status: "running" | "completed" | "failed" | "cancelled";
    retryCount: number;
    updatedAt: string;
  },
): void {
  store.insertWorkflowState({
    taskId: input.taskId,
    divisionId: "general_ops",
    workflowId: "single_agent_minimal",
    currentStepIndex: 0,
    status: input.status,
    outputsJson: "{}",
    lastErrorCode: input.status === "failed" ? "workflow.failed" : null,
    retryCount: input.retryCount,
    resumableFromStep: null,
    startedAt: input.updatedAt,
    updatedAt: input.updatedAt,
  });
}

test("metrics service summarizes success recovery retry cost and backlog signals", () => {
  const workspace = createTempWorkspace("aa-metrics-unit-");
  const dbPath = join(workspace, "metrics-unit.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const approvals = new ApprovalService(db, store);

    seedTaskAndExecution(db, store, {
      taskId: "task-metrics-success",
      executionId: "exec-metrics-success",
      traceId: "trace-metrics-success",
    });
    seedWorkflowState(store, {
      taskId: "task-metrics-success",
      status: "completed",
      retryCount: 0,
      updatedAt: "2026-04-06T08:00:00.000Z",
    });
    db.connection
      .prepare(
        `UPDATE tasks
         SET status = ?, actual_cost_usd = ?, updated_at = ?, completed_at = ?
         WHERE id = ?`,
      )
      .run("done", 1.5, "2026-04-06T08:00:00.000Z", "2026-04-06T08:00:00.000Z", "task-metrics-success");
    db.connection
      .prepare(`UPDATE executions SET status = ?, updated_at = ?, finished_at = ? WHERE id = ?`)
      .run("succeeded", "2026-04-06T08:00:00.000Z", "2026-04-06T08:00:00.000Z", "exec-metrics-success");
    store.insertStepOutput({
      id: "step-output-metrics-1",
      taskId: "task-metrics-success",
      stepId: "analyze",
      roleId: "general_executor",
      status: "succeeded",
      dataJson: JSON.stringify({ summary: "analyzed" }),
      summary: "analyzed",
      artifactsJson: null,
      tokenCost: 10,
      durationMs: 100,
      validationJson: null,
      producedAt: "2026-04-06T08:00:00.000Z",
    });
    store.insertEvent({
      id: newId("evt"),
      taskId: "task-metrics-success",
      executionId: "exec-metrics-success",
      eventType: "recovery:decision_recorded",
      eventTier: "tier_2",
      payloadJson: JSON.stringify({ action: "retry_new_ticket", decisionId: "rdec-success" }),
      traceId: "trace-metrics-success",
      createdAt: "2026-04-06T07:58:00.000Z",
    });
    store.insertEvent({
      id: newId("evt"),
      taskId: "task-metrics-success",
      executionId: "exec-metrics-success",
      eventType: "recovery:repair_applied",
      eventTier: "tier_2",
      payloadJson: JSON.stringify({ repairAction: "requeue_execution", targetId: "exec-metrics-success" }),
      traceId: "trace-metrics-success",
      createdAt: "2026-04-06T07:59:00.000Z",
    });

    seedTaskAndExecution(db, store, {
      taskId: "task-metrics-failed",
      executionId: "exec-metrics-failed",
      traceId: "trace-metrics-failed",
    });
    seedWorkflowState(store, {
      taskId: "task-metrics-failed",
      status: "failed",
      retryCount: 2,
      updatedAt: "2026-04-06T08:05:00.000Z",
    });
    db.connection
      .prepare(
        `UPDATE tasks
         SET status = ?, actual_cost_usd = ?, updated_at = ?, completed_at = ?, error_code = ?
         WHERE id = ?`,
      )
      .run("failed", 0.8, "2026-04-06T08:05:00.000Z", "2026-04-06T08:05:00.000Z", "task.failed", "task-metrics-failed");
    db.connection
      .prepare(`UPDATE executions SET status = ?, attempt = ?, updated_at = ?, finished_at = ? WHERE id = ?`)
      .run("failed", 2, "2026-04-06T08:05:00.000Z", "2026-04-06T08:05:00.000Z", "exec-metrics-failed");
    store.insertStepOutput({
      id: "step-output-metrics-2",
      taskId: "task-metrics-failed",
      stepId: "execute",
      roleId: "general_executor",
      status: "failed",
      dataJson: JSON.stringify({ error: "broken" }),
      summary: "failed",
      artifactsJson: null,
      tokenCost: 20,
      durationMs: 400,
      validationJson: null,
      producedAt: "2026-04-06T08:05:00.000Z",
    });
    store.insertEvent({
      id: newId("evt"),
      taskId: "task-metrics-failed",
      executionId: "exec-metrics-failed",
      eventType: "recovery:decision_recorded",
      eventTier: "tier_2",
      payloadJson: JSON.stringify({ action: "move_dead_letter", decisionId: "rdec-failed" }),
      traceId: "trace-metrics-failed",
      createdAt: "2026-04-06T08:04:00.000Z",
    });
    store.insertEvent({
      id: newId("evt"),
      taskId: "task-metrics-failed",
      executionId: "exec-metrics-failed",
      eventType: "recovery:dead_lettered",
      eventTier: "tier_2",
      payloadJson: JSON.stringify({ decisionId: "rdec-failed", deadLetterId: "dlq-failed" }),
      traceId: "trace-metrics-failed",
      createdAt: "2026-04-06T08:05:00.000Z",
    });

    seedTaskAndExecution(db, store, {
      taskId: "task-metrics-awaiting",
      executionId: "exec-metrics-awaiting",
      traceId: "trace-metrics-awaiting",
    });
    seedWorkflowState(store, {
      taskId: "task-metrics-awaiting",
      status: "running",
      retryCount: 0,
      updatedAt: "2026-04-06T08:10:00.000Z",
    });
    db.connection.prepare(`UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?`).run(
      "awaiting_decision",
      "2026-04-06T08:10:00.000Z",
      "task-metrics-awaiting",
    );
    db.connection.prepare(`UPDATE executions SET status = ?, updated_at = ? WHERE id = ?`).run(
      "created",
      "2026-04-06T08:10:00.000Z",
      "exec-metrics-awaiting",
    );
    store.insertStepOutput({
      id: "step-output-metrics-3",
      taskId: "task-metrics-awaiting",
      stepId: "plan",
      roleId: "general_executor",
      status: "partial_success",
      dataJson: JSON.stringify({ summary: "waiting" }),
      summary: "waiting",
      artifactsJson: null,
      tokenCost: 30,
      durationMs: 1000,
      validationJson: null,
      producedAt: "2026-04-06T08:10:00.000Z",
    });
    approvals.createRequest({
      taskId: "task-metrics-awaiting",
      executionId: "exec-metrics-awaiting",
      sourceAgentId: "agent-metrics",
      reason: "Need approval",
      riskLevel: "high",
      options: ["approve", "reject"],
      context: { source: "metrics-test" },
      timeoutPolicy: "reject",
    });
    const resolvedApproval = approvals.createRequest({
      taskId: "task-metrics-failed",
      executionId: "exec-metrics-failed",
      sourceAgentId: "agent-metrics",
      reason: "Resolved approval",
      riskLevel: "medium",
      options: ["approve", "reject"],
      context: { source: "metrics-test" },
      timeoutPolicy: "reject",
    });
    approvals.applyDecision({
      approvalId: resolvedApproval.approvalId,
      decisionType: "rejected",
      respondedBy: "operator-metrics",
      respondedAt: "2026-04-06T08:06:00.000Z",
    });

    store.insertExecutionTicket({
      id: "ticket-metrics-awaiting",
      executionId: "exec-metrics-awaiting",
      taskId: "task-metrics-awaiting",
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
      createdAt: "2026-04-06T08:10:00.000Z",
      updatedAt: "2026-04-06T08:10:00.000Z",
    });
    store.upsertWorkerSnapshot({
      workerId: "worker-metrics-idle",
      status: "idle",
      capabilitiesJson: JSON.stringify(["bash"]),
      runningExecutionsJson: JSON.stringify([]),
      maxConcurrency: 1,
      queueAffinity: "default",
      runtimeInstanceId: "runtime-metrics-idle",
      restartedFromRuntimeInstanceId: null,
      restartGeneration: 0,
      cpuPct: 15,
      memoryMb: 128,
      toolBacklogCount: 0,
      currentStepId: null,
      lastProgressAt: "2026-04-06T08:10:00.000Z",
      lastHeartbeatAt: "2026-04-06T08:10:00.000Z",
      updatedAt: "2026-04-06T08:10:00.000Z",
    });
    store.createTier1StatusEvent({
      taskId: "task-metrics-awaiting",
      executionId: "exec-metrics-awaiting",
      eventType: "task:status_changed",
      traceId: "trace-metrics-awaiting",
      payload: { fromStatus: "in_progress", toStatus: "awaiting_decision" },
    });

    const summary = new MetricsService(
      db,
      new HealthService(db, store, {
        nowMsSupplier: () => Date.parse("2026-04-06T08:14:59.000Z"),
      }),
    ).buildSummary("2026-04-06T08:14:59.000Z");

    assert.equal(summary.taskMetrics.total, 3);
    assert.equal(summary.taskMetrics.terminalCount, 2);
    assert.equal(summary.taskMetrics.successCount, 1);
    assert.equal(summary.taskMetrics.failedCount, 1);
    assert.equal(summary.taskMetrics.activeCount, 1);
    assert.equal(summary.taskMetrics.successRate, 0.5);
    assert.equal(summary.taskMetrics.completionRate, 0.6667);

    assert.equal(summary.workflowMetrics.total, 3);
    assert.equal(summary.workflowMetrics.retriedCount, 1);
    assert.equal(summary.workflowMetrics.retryRate, 0.3333);

    assert.equal(summary.executionMetrics.total, 3);
    assert.equal(summary.executionMetrics.activeCount, 1);
    assert.equal(summary.executionMetrics.retryAttemptCount, 1);
    assert.equal(summary.executionMetrics.retryRate, 0.3333);

    assert.equal(summary.recoveryMetrics.taskCount, 2);
    assert.equal(summary.recoveryMetrics.successfulTaskCount, 1);
    assert.equal(summary.recoveryMetrics.successRate, 0.5);
    assert.equal(summary.recoveryMetrics.decisionCount, 2);
    assert.equal(summary.recoveryMetrics.repairEventCount, 1);
    assert.equal(summary.recoveryMetrics.deadLetterCount, 1);

    assert.equal(summary.stepMetrics.total, 3);
    assert.equal(summary.stepMetrics.averageDurationMs, 500);
    assert.equal(summary.stepMetrics.p95DurationMs, 1000);
    assert.equal(summary.stepMetrics.averageTokenCost, 20);
    assert.equal(summary.stepMetrics.totalTokenCost, 60);

    assert.equal(summary.costMetrics.totalActualCostUsd, 2.3);
    assert.equal(summary.costMetrics.averageActualCostUsdPerTask, 0.7667);
    assert.equal(summary.costMetrics.averageActualCostUsdPerSuccessfulTask, 1.5);

    assert.equal(summary.approvalMetrics.total, 2);
    assert.equal(summary.approvalMetrics.pendingCount, 1);
    assert.equal(summary.approvalMetrics.resolvedCount, 1);
    assert.equal(summary.approvalMetrics.taskTriggerCount, 2);
    assert.equal(summary.approvalMetrics.taskTriggerRate, 0.6667);

    assert.equal(summary.eventMetrics.tier1Count >= 1, true);
    assert.equal(summary.eventMetrics.pendingTier1AckCount >= 1, true);
    assert.equal(summary.runtimeMetrics.queueGovernance.backlogSize, 1);
    assert.equal(summary.runtimeMetrics.workerHealth.totalWorkers, 1);
    assert.equal(summary.runtimeMetrics.status, "ok");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("metrics service returns valid event metrics structure", () => {
  const workspace = createTempWorkspace("aa-metrics-events-");
  const dbPath = join(workspace, "metrics-events.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    seedTaskAndExecution(db, store, {
      taskId: "task-events",
      executionId: "exec-events",
      traceId: "trace-events",
    });

    // Insert tier-1 events
    store.createTier1StatusEvent({
      taskId: "task-events",
      executionId: "exec-events",
      eventType: "task:status_changed",
      traceId: "trace-events",
      payload: { fromStatus: "queued", toStatus: "in_progress" },
    });

    const summary = new MetricsService(
      db,
      new HealthService(db, store, {
        nowMsSupplier: () => Date.parse("2026-04-06T08:14:59.000Z"),
      }),
    ).buildSummary("2026-04-06T08:14:59.000Z");

    assert.ok(summary.eventMetrics !== undefined);
    assert.ok(typeof summary.eventMetrics.tier1Count === "number");
    assert.ok(typeof summary.eventMetrics.pendingTier1AckCount === "number");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("metrics service calculates correct ratio when denominator is zero", () => {
  const workspace = createTempWorkspace("aa-metrics-ratio-zero-");
  const dbPath = join(workspace, "metrics-ratio-zero.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    // Create task with no terminal status - will cause denominator issues
    seedTaskAndExecution(db, store, {
      taskId: "task-no-terminal",
      executionId: "exec-no-terminal",
      traceId: "trace-no-terminal",
    });
    // Don't set status to terminal - active task

    const summary = new MetricsService(
      db,
      new HealthService(db, store, {
        nowMsSupplier: () => Date.parse("2026-04-06T08:14:59.000Z"),
      }),
    ).buildSummary("2026-04-06T08:14:59.000Z");

    // Success rate should be 0 when no terminal tasks
    assert.equal(summary.taskMetrics.successRate, 0);
    assert.equal(summary.taskMetrics.completionRate, 0);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("metrics service calculates correct workflow retry rate", () => {
  const workspace = createTempWorkspace("aa-metrics-retry-rate-");
  const dbPath = join(workspace, "metrics-retry-rate.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    // Create tasks with workflows
    seedTaskAndExecution(db, store, {
      taskId: "task-retry-1",
      executionId: "exec-retry-1",
      traceId: "trace-retry-1",
    });
    seedWorkflowState(store, {
      taskId: "task-retry-1",
      status: "completed",
      retryCount: 1, // Has retry
      updatedAt: "2026-04-06T08:00:00.000Z",
    });

    seedTaskAndExecution(db, store, {
      taskId: "task-no-retry",
      executionId: "exec-no-retry",
      traceId: "trace-no-retry",
    });
    seedWorkflowState(store, {
      taskId: "task-no-retry",
      status: "completed",
      retryCount: 0, // No retry
      updatedAt: "2026-04-06T08:00:00.000Z",
    });

    const summary = new MetricsService(
      db,
      new HealthService(db, store, {
        nowMsSupplier: () => Date.parse("2026-04-06T08:14:59.000Z"),
      }),
    ).buildSummary("2026-04-06T08:14:59.000Z");

    // 1 retry out of 2 workflows = 0.5
    assert.equal(summary.workflowMetrics.retryRate, 0.5);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("metrics service handles empty step outputs gracefully", () => {
  const workspace = createTempWorkspace("aa-metrics-no-steps-");
  const dbPath = join(workspace, "metrics-no-steps.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    seedTaskAndExecution(db, store, {
      taskId: "task-no-steps",
      executionId: "exec-no-steps",
      traceId: "trace-no-steps",
    });

    const summary = new MetricsService(
      db,
      new HealthService(db, store, {
        nowMsSupplier: () => Date.parse("2026-04-06T08:14:59.000Z"),
      }),
    ).buildSummary("2026-04-06T08:14:59.000Z");

    // Step metrics should be null for average/p95 when no steps
    assert.equal(summary.stepMetrics.total, 0);
    assert.equal(summary.stepMetrics.averageDurationMs, null);
    assert.equal(summary.stepMetrics.p95DurationMs, null);
    assert.equal(summary.stepMetrics.averageTokenCost, null);
    assert.equal(summary.stepMetrics.totalTokenCost, 0);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("metrics service calculates step p95 correctly with odd number of steps", () => {
  const workspace = createTempWorkspace("aa-metrics-p95-odd-");
  const dbPath = join(workspace, "metrics-p95-odd.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    seedTaskAndExecution(db, store, {
      taskId: "task-p95-odd",
      executionId: "exec-p95-odd",
      traceId: "trace-p95-odd",
    });
    seedWorkflowState(store, {
      taskId: "task-p95-odd",
      status: "completed",
      retryCount: 0,
      updatedAt: "2026-04-06T08:00:00.000Z",
    });

    // Insert 5 steps with durations 100, 200, 300, 400, 500
    for (let i = 1; i <= 5; i++) {
      store.insertStepOutput({
        id: `step-p95-${i}`,
        taskId: "task-p95-odd",
        stepId: `step-${i}`,
        roleId: "general_executor",
        status: "succeeded",
        dataJson: JSON.stringify({ summary: `step ${i}` }),
        summary: `step ${i}`,
        artifactsJson: null,
        tokenCost: i * 10,
        durationMs: i * 100,
        validationJson: null,
        producedAt: "2026-04-06T08:00:00.000Z",
      });
    }

    const summary = new MetricsService(
      db,
      new HealthService(db, store, {
        nowMsSupplier: () => Date.parse("2026-04-06T08:14:59.000Z"),
      }),
    ).buildSummary("2026-04-06T08:14:59.000Z");

    // P95 of [100, 200, 300, 400, 500] with 5 elements
    // index = ceil(5 * 0.95) - 1 = ceil(4.75) - 1 = 5 - 1 = 4
    // So p95 = 500
    assert.equal(summary.stepMetrics.p95DurationMs, 500);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("metrics service calculates step p95 correctly with even number of steps", () => {
  const workspace = createTempWorkspace("aa-metrics-p95-even-");
  const dbPath = join(workspace, "metrics-p95-even.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    seedTaskAndExecution(db, store, {
      taskId: "task-p95-even",
      executionId: "exec-p95-even",
      traceId: "trace-p95-even",
    });
    seedWorkflowState(store, {
      taskId: "task-p95-even",
      status: "completed",
      retryCount: 0,
      updatedAt: "2026-04-06T08:00:00.000Z",
    });

    // Insert 4 steps with durations 100, 200, 300, 400
    for (let i = 1; i <= 4; i++) {
      store.insertStepOutput({
        id: `step-p95-even-${i}`,
        taskId: "task-p95-even",
        stepId: `step-${i}`,
        roleId: "general_executor",
        status: "succeeded",
        dataJson: JSON.stringify({ summary: `step ${i}` }),
        summary: `step ${i}`,
        artifactsJson: null,
        tokenCost: i * 10,
        durationMs: i * 100,
        validationJson: null,
        producedAt: "2026-04-06T08:00:00.000Z",
      });
    }

    const summary = new MetricsService(
      db,
      new HealthService(db, store, {
        nowMsSupplier: () => Date.parse("2026-04-06T08:14:59.000Z"),
      }),
    ).buildSummary("2026-04-06T08:14:59.000Z");

    // P95 of [100, 200, 300, 400] with 4 elements
    // index = ceil(4 * 0.95) - 1 = ceil(3.8) - 1 = 4 - 1 = 3
    // So p95 = 400
    assert.equal(summary.stepMetrics.p95DurationMs, 400);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("metrics service handles null average costs from SQL", () => {
  const workspace = createTempWorkspace("aa-metrics-null-cost-");
  const dbPath = join(workspace, "metrics-null-cost.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    seedTaskAndExecution(db, store, {
      taskId: "task-null-cost",
      executionId: "exec-null-cost",
      traceId: "trace-null-cost",
    });
    seedWorkflowState(store, {
      taskId: "task-null-cost",
      status: "completed",
      retryCount: 0,
      updatedAt: "2026-04-06T08:00:00.000Z",
    });
    // Don't set actual_cost_usd - it will be NULL in the database

    const summary = new MetricsService(
      db,
      new HealthService(db, store, {
        nowMsSupplier: () => Date.parse("2026-04-06T08:14:59.000Z"),
      }),
    ).buildSummary("2026-04-06T08:14:59.000Z");

    // Should handle null costs gracefully
    assert.ok(typeof summary.costMetrics.totalActualCostUsd === "number");
    assert.ok(typeof summary.costMetrics.averageActualCostUsdPerTask === "number" || summary.costMetrics.averageActualCostUsdPerTask === null);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("metrics service calculates approval task trigger rate correctly", () => {
  const workspace = createTempWorkspace("aa-metrics-approval-rate-");
  const dbPath = join(workspace, "metrics-approval-rate.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const approvals = new ApprovalService(db, store);

    // Create multiple tasks
    for (let i = 0; i < 4; i++) {
      seedTaskAndExecution(db, store, {
        taskId: `task-approval-${i}`,
        executionId: `exec-approval-${i}`,
        traceId: `trace-approval-${i}`,
      });
      db.connection.prepare(`UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?`).run(
        "awaiting_decision",
        "2026-04-06T08:00:00.000Z",
        `task-approval-${i}`,
      );
    }

    // Only 2 tasks have approval requests
    for (let i = 0; i < 2; i++) {
      approvals.createRequest({
        taskId: `task-approval-${i}`,
        executionId: `exec-approval-${i}`,
        sourceAgentId: "agent-test",
        reason: "Test approval",
        riskLevel: "medium",
        options: ["approve", "reject"],
        context: {},
        timeoutPolicy: "reject",
      });
    }

    const summary = new MetricsService(
      db,
      new HealthService(db, store, {
        nowMsSupplier: () => Date.parse("2026-04-06T08:14:59.000Z"),
      }),
    ).buildSummary("2026-04-06T08:14:59.000Z");

    // 2 approvals for 4 tasks = 0.5
    assert.equal(summary.approvalMetrics.taskTriggerRate, 0.5);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("metrics service correctly counts tier 2 and tier 3 events", () => {
  const workspace = createTempWorkspace("aa-metrics-tier23-");
  const dbPath = join(workspace, "metrics-tier23.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    seedTaskAndExecution(db, store, {
      taskId: "task-tier23",
      executionId: "exec-tier23",
      traceId: "trace-tier23",
    });

    // Insert tier-2 event
    store.insertEvent({
      id: newId("evt"),
      taskId: "task-tier23",
      executionId: "exec-tier23",
      eventType: "task:status_changed",
      eventTier: "tier_2",
      payloadJson: JSON.stringify({}),
      traceId: "trace-tier23",
      createdAt: "2026-04-06T08:00:00.000Z",
    });

    // Insert tier-3 event
    store.insertEvent({
      id: newId("evt"),
      taskId: "task-tier23",
      executionId: "exec-tier23",
      eventType: "task:status_changed",
      eventTier: "tier_3",
      payloadJson: JSON.stringify({}),
      traceId: "trace-tier23",
      createdAt: "2026-04-06T08:00:00.000Z",
    });

    const summary = new MetricsService(
      db,
      new HealthService(db, store, {
        nowMsSupplier: () => Date.parse("2026-04-06T08:14:59.000Z"),
      }),
    ).buildSummary("2026-04-06T08:14:59.000Z");

    assert.equal(summary.eventMetrics.tier2Count, 1);
    assert.equal(summary.eventMetrics.tier3Count, 1);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("metrics service calculates recovery success rate correctly", () => {
  const workspace = createTempWorkspace("aa-metrics-recovery-rate-");
  const dbPath = join(workspace, "metrics-recovery-rate.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    // Task 1: recovered successfully
    seedTaskAndExecution(db, store, {
      taskId: "task-recovered",
      executionId: "exec-recovered",
      traceId: "trace-recovered",
    });
    db.connection.prepare(`UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?`).run(
      "done",
      "2026-04-06T08:00:00.000Z",
      "task-recovered",
    );
    store.insertEvent({
      id: newId("evt"),
      taskId: "task-recovered",
      executionId: "exec-recovered",
      eventType: "recovery:decision_recorded",
      eventTier: "tier_2",
      payloadJson: JSON.stringify({}),
      traceId: "trace-recovered",
      createdAt: "2026-04-06T08:00:00.000Z",
    });

    // Task 2: recovery failed (dead lettered)
    seedTaskAndExecution(db, store, {
      taskId: "task-dead-lettered",
      executionId: "exec-dead-lettered",
      traceId: "trace-dead-lettered",
    });
    db.connection.prepare(`UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?`).run(
      "failed",
      "2026-04-06T08:00:00.000Z",
      "task-dead-lettered",
    );
    store.insertEvent({
      id: newId("evt"),
      taskId: "task-dead-lettered",
      executionId: "exec-dead-lettered",
      eventType: "recovery:dead_lettered",
      eventTier: "tier_2",
      payloadJson: JSON.stringify({}),
      traceId: "trace-dead-lettered",
      createdAt: "2026-04-06T08:00:00.000Z",
    });

    const summary = new MetricsService(
      db,
      new HealthService(db, store, {
        nowMsSupplier: () => Date.parse("2026-04-06T08:14:59.000Z"),
      }),
    ).buildSummary("2026-04-06T08:14:59.000Z");

    // 1 successful recovery out of 2 tasks = 0.5
    assert.equal(summary.recoveryMetrics.taskCount, 2);
    assert.equal(summary.recoveryMetrics.successfulTaskCount, 1);
    assert.equal(summary.recoveryMetrics.successRate, 0.5);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("metrics service handles cancelled recovery events", () => {
  const workspace = createTempWorkspace("aa-metrics-recovery-cancelled-");
  const dbPath = join(workspace, "metrics-recovery-cancelled.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    seedTaskAndExecution(db, store, {
      taskId: "task-recovery-cancelled",
      executionId: "exec-recovery-cancelled",
      traceId: "trace-recovery-cancelled",
    });
    store.insertEvent({
      id: newId("evt"),
      taskId: "task-recovery-cancelled",
      executionId: "exec-recovery-cancelled",
      eventType: "recovery:cancelled",
      eventTier: "tier_2",
      payloadJson: JSON.stringify({}),
      traceId: "trace-recovery-cancelled",
      createdAt: "2026-04-06T08:00:00.000Z",
    });

    const summary = new MetricsService(
      db,
      new HealthService(db, store, {
        nowMsSupplier: () => Date.parse("2026-04-06T08:14:59.000Z"),
      }),
    ).buildSummary("2026-04-06T08:14:59.000Z");

    assert.equal(summary.recoveryMetrics.cancelledCount, 1);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});
