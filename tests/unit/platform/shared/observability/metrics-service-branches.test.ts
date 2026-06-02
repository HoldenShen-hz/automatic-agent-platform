import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { ApprovalService } from "../../../../../src/platform/five-plane-control-plane/approval-center/approval-service.js";
import { HealthService } from "../../../../../src/platform/shared/observability/health-service.js";
import { MetricsService } from "../../../../../src/platform/shared/observability/metrics-service.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { seedTaskAndExecution } from "../../../../helpers/seed.js";

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
    divisionId: "general-ops",
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

// Test metrics service with all tasks in terminal state (successRate = 1.0)
test("metrics service calculates successRate as 1.0 when all tasks succeed", () => {
  const workspace = createTempWorkspace("aa-metrics-all-success-");
  const dbPath = join(workspace, "metrics-all-success.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    // Create 3 successful tasks
    for (let i = 0; i < 3; i++) {
      seedTaskAndExecution(db, store, {
        taskId: `task-success-${i}`,
        executionId: `exec-success-${i}`,
        traceId: `trace-success-${i}`,
      });
      seedWorkflowState(store, {
        taskId: `task-success-${i}`,
        status: "completed",
        retryCount: 0,
        updatedAt: "2026-04-06T08:00:00.000Z",
      });
      db.connection
        .prepare(`UPDATE tasks SET status = ?, updated_at = ?, completed_at = ? WHERE id = ?`)
        .run("done", "2026-04-06T08:00:00.000Z", "2026-04-06T08:00:00.000Z", `task-success-${i}`);
    }

    const summary = new MetricsService(
      db,
      new HealthService(db, store, {
        nowMsSupplier: () => Date.parse("2026-04-06T08:14:59.000Z"),
      }),
    ).buildSummary("2026-04-06T08:14:59.000Z");

    assert.equal(summary.taskMetrics.total, 3);
    assert.equal(summary.taskMetrics.terminalCount, 3);
    assert.equal(summary.taskMetrics.successCount, 3);
    assert.equal(summary.taskMetrics.failedCount, 0);
    assert.equal(summary.taskMetrics.successRate, 1.0);
    assert.equal(summary.taskMetrics.completionRate, 1.0);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

// Test metrics service with all tasks failed (successRate = 0)
test("metrics service calculates successRate as 0 when all tasks failed", () => {
  const workspace = createTempWorkspace("aa-metrics-all-failed-");
  const dbPath = join(workspace, "metrics-all-failed.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    // Create 3 failed tasks
    for (let i = 0; i < 3; i++) {
      seedTaskAndExecution(db, store, {
        taskId: `task-failed-${i}`,
        executionId: `exec-failed-${i}`,
        traceId: `trace-failed-${i}`,
      });
      seedWorkflowState(store, {
        taskId: `task-failed-${i}`,
        status: "failed",
        retryCount: 0,
        updatedAt: "2026-04-06T08:00:00.000Z",
      });
      db.connection
        .prepare(`UPDATE tasks SET status = ?, updated_at = ?, completed_at = ?, error_code = ? WHERE id = ?`)
        .run("failed", "2026-04-06T08:00:00.000Z", "2026-04-06T08:00:00.000Z", "task.failed", `task-failed-${i}`);
    }

    const summary = new MetricsService(
      db,
      new HealthService(db, store, {
        nowMsSupplier: () => Date.parse("2026-04-06T08:14:59.000Z"),
      }),
    ).buildSummary("2026-04-06T08:14:59.000Z");

    assert.equal(summary.taskMetrics.total, 3);
    assert.equal(summary.taskMetrics.terminalCount, 3);
    assert.equal(summary.taskMetrics.successCount, 0);
    assert.equal(summary.taskMetrics.failedCount, 3);
    assert.equal(summary.taskMetrics.successRate, 0);
    // All tasks are terminal so completion rate is 100%
    assert.equal(summary.taskMetrics.completionRate, 1.0);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

// Test metrics service with workflow retry rate = 0 (no retries)
test("metrics service calculates retryRate as 0 when no workflows have retries", () => {
  const workspace = createTempWorkspace("aa-metrics-no-retries-");
  const dbPath = join(workspace, "metrics-no-retries.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

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

    assert.equal(summary.workflowMetrics.total, 1);
    assert.equal(summary.workflowMetrics.retriedCount, 0);
    assert.equal(summary.workflowMetrics.retryRate, 0);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

// Test metrics service with execution retry rate = 0
test("metrics service calculates execution retryRate as 0 when no executions have retries", () => {
  const workspace = createTempWorkspace("aa-metrics-exec-no-retries-");
  const dbPath = join(workspace, "metrics-exec-no-retries.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    seedTaskAndExecution(db, store, {
      taskId: "task-exec-no-retry",
      executionId: "exec-exec-no-retry",
      traceId: "trace-exec-no-retry",
    });
    // Default execution attempt = 1, so this should not count as retry
    db.connection
      .prepare(`UPDATE executions SET status = ?, updated_at = ? WHERE id = ?`)
      .run("succeeded", "2026-04-06T08:00:00.000Z", "exec-exec-no-retry");

    const summary = new MetricsService(
      db,
      new HealthService(db, store, {
        nowMsSupplier: () => Date.parse("2026-04-06T08:14:59.000Z"),
      }),
    ).buildSummary("2026-04-06T08:14:59.000Z");

    assert.equal(summary.executionMetrics.total, 1);
    assert.equal(summary.executionMetrics.retryAttemptCount, 0);
    assert.equal(summary.executionMetrics.retryRate, 0);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

// Test metrics service with all active executions (retry rate based on total)
test("metrics service calculates retryRate with only active executions", () => {
  const workspace = createTempWorkspace("aa-metrics-active-execs-");
  const dbPath = join(workspace, "metrics-active-execs.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    // Create 3 active (non-terminal) executions
    for (let i = 0; i < 3; i++) {
      seedTaskAndExecution(db, store, {
        taskId: `task-active-${i}`,
        executionId: `exec-active-${i}`,
        traceId: `trace-active-${i}`,
      });
      db.connection
        .prepare(`UPDATE executions SET status = ?, updated_at = ? WHERE id = ?`)
        .run("executing", "2026-04-06T08:00:00.000Z", `exec-active-${i}`);
    }

    const summary = new MetricsService(
      db,
      new HealthService(db, store, {
        nowMsSupplier: () => Date.parse("2026-04-06T08:14:59.000Z"),
      }),
    ).buildSummary("2026-04-06T08:14:59.000Z");

    assert.equal(summary.executionMetrics.total, 3);
    assert.equal(summary.executionMetrics.activeCount, 3);
    assert.equal(summary.executionMetrics.retryRate, 0); // 0 / 3 = 0

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

// Test metrics service with recovery success rate = 1.0
test("metrics service calculates recovery successRate as 1.0 when all recoveries succeed", () => {
  const workspace = createTempWorkspace("aa-metrics-all-recovered-");
  const dbPath = join(workspace, "metrics-all-recovered.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    // Create 2 tasks that recovered successfully
    for (let i = 0; i < 2; i++) {
      seedTaskAndExecution(db, store, {
        taskId: `task-recovered-${i}`,
        executionId: `exec-recovered-${i}`,
        traceId: `trace-recovered-${i}`,
      });
      db.connection
        .prepare(`UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?`)
        .run("done", "2026-04-06T08:00:00.000Z", `task-recovered-${i}`);
      store.insertEvent({
        id: `evt-dec-${i}`,
        taskId: `task-recovered-${i}`,
        executionId: `exec-recovered-${i}`,
        eventType: "recovery:decision_recorded",
        eventTier: "tier_2",
        payloadJson: JSON.stringify({}),
        traceId: `trace-recovered-${i}`,
        createdAt: "2026-04-06T08:00:00.000Z",
      });
    }

    const summary = new MetricsService(
      db,
      new HealthService(db, store, {
        nowMsSupplier: () => Date.parse("2026-04-06T08:14:59.000Z"),
      }),
    ).buildSummary("2026-04-06T08:14:59.000Z");

    assert.equal(summary.recoveryMetrics.taskCount, 2);
    assert.equal(summary.recoveryMetrics.successfulTaskCount, 2);
    assert.equal(summary.recoveryMetrics.successRate, 1.0);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

// Test metrics service with no recovery events (successRate = 0 due to division by 0)
test("metrics service calculates recovery successRate as 0 when no tasks have recovery events", () => {
  const workspace = createTempWorkspace("aa-metrics-no-recovery-");
  const dbPath = join(workspace, "metrics-no-recovery.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    // Create tasks without any recovery events
    seedTaskAndExecution(db, store, {
      taskId: "task-no-recovery",
      executionId: "exec-no-recovery",
      traceId: "trace-no-recovery",
    });

    const summary = new MetricsService(
      db,
      new HealthService(db, store, {
        nowMsSupplier: () => Date.parse("2026-04-06T08:14:59.000Z"),
      }),
    ).buildSummary("2026-04-06T08:14:59.000Z");

    // No recovery task count means successRate = 0 (0 / 0 handled)
    assert.equal(summary.recoveryMetrics.taskCount, 0);
    assert.equal(summary.recoveryMetrics.successRate, 0);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

// Test metrics service with only pending approvals
test("metrics service calculates approval metrics with only pending approvals", () => {
  const workspace = createTempWorkspace("aa-metrics-pending-only-");
  const dbPath = join(workspace, "metrics-pending-only.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const approvals = new ApprovalService(db, store);

    seedTaskAndExecution(db, store, {
      taskId: "task-pending",
      executionId: "exec-pending",
      traceId: "trace-pending",
    });
    db.connection.prepare(`UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?`).run(
      "awaiting_decision",
      "2026-04-06T08:00:00.000Z",
      "task-pending",
    );
    approvals.createRequest({
      taskId: "task-pending",
      executionId: "exec-pending",
      sourceAgentId: "agent-pending",
      reason: "Need approval",
      riskLevel: "high",
      options: ["approve", "reject"],
      context: { source: "metrics-test" },
      timeoutPolicy: "reject",
    });

    const summary = new MetricsService(
      db,
      new HealthService(db, store, {
        nowMsSupplier: () => Date.parse("2026-04-06T08:14:59.000Z"),
      }),
    ).buildSummary("2026-04-06T08:14:59.000Z");

    assert.equal(summary.approvalMetrics.total, 1);
    assert.equal(summary.approvalMetrics.pendingCount, 1);
    assert.equal(summary.approvalMetrics.resolvedCount, 0);
    // taskTriggerRate = 1 / 1 = 1
    assert.equal(summary.approvalMetrics.taskTriggerRate, 1.0);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

// Test metrics service with step metrics for single step
test("metrics service calculates step metrics with single step", () => {
  const workspace = createTempWorkspace("aa-metrics-single-step-");
  const dbPath = join(workspace, "metrics-single-step.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    seedTaskAndExecution(db, store, {
      taskId: "task-single-step",
      executionId: "exec-single-step",
      traceId: "trace-single-step",
    });
    seedWorkflowState(store, {
      taskId: "task-single-step",
      status: "completed",
      retryCount: 0,
      updatedAt: "2026-04-06T08:00:00.000Z",
    });
    store.insertStepOutput({
      id: "step-single",
      taskId: "task-single-step",
      stepId: "only-step",
      roleId: "general_executor",
      status: "succeeded",
      dataJson: JSON.stringify({ summary: "done" }),
      summary: "done",
      artifactsJson: null,
      tokenCost: 50,
      durationMs: 200,
      validationJson: null,
      producedAt: "2026-04-06T08:00:00.000Z",
    });

    const summary = new MetricsService(
      db,
      new HealthService(db, store, {
        nowMsSupplier: () => Date.parse("2026-04-06T08:14:59.000Z"),
      }),
    ).buildSummary("2026-04-06T08:14:59.000Z");

    assert.equal(summary.stepMetrics.total, 1);
    assert.equal(summary.stepMetrics.averageDurationMs, 200);
    assert.equal(summary.stepMetrics.p95DurationMs, 200); // Single value = that value
    assert.equal(summary.stepMetrics.averageTokenCost, 50);
    assert.equal(summary.stepMetrics.totalTokenCost, 50);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

// Test metrics service with zero task total (division by zero in rates)
test("metrics service handles zero task total for rate calculations", () => {
  const workspace = createTempWorkspace("aa-metrics-zero-tasks-");
  const dbPath = join(workspace, "metrics-zero-tasks.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    // Don't create any tasks

    const summary = new MetricsService(
      db,
      new HealthService(db, store, {
        nowMsSupplier: () => Date.parse("2026-04-06T08:14:59.000Z"),
      }),
    ).buildSummary("2026-04-06T08:14:59.000Z");

    assert.equal(summary.taskMetrics.total, 0);
    // Success rate = 0 / 0 = 0 (handled by ratio function)
    assert.equal(summary.taskMetrics.successRate, 0);
    // Completion rate = 0 / 0 = 0
    assert.equal(summary.taskMetrics.completionRate, 0);
    // Approval trigger rate = 0 / 0 = 0
    assert.equal(summary.approvalMetrics.taskTriggerRate, 0);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

// Test metrics service with cancelled tasks
test("metrics service correctly counts cancelled tasks", () => {
  const workspace = createTempWorkspace("aa-metrics-cancelled-");
  const dbPath = join(workspace, "metrics-cancelled.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    seedTaskAndExecution(db, store, {
      taskId: "task-cancelled",
      executionId: "exec-cancelled",
      traceId: "trace-cancelled",
    });
    seedWorkflowState(store, {
      taskId: "task-cancelled",
      status: "cancelled",
      retryCount: 0,
      updatedAt: "2026-04-06T08:00:00.000Z",
    });
    db.connection
      .prepare(`UPDATE tasks SET status = ?, updated_at = ?, completed_at = ? WHERE id = ?`)
      .run("cancelled", "2026-04-06T08:00:00.000Z", "2026-04-06T08:00:00.000Z", "task-cancelled");

    const summary = new MetricsService(
      db,
      new HealthService(db, store, {
        nowMsSupplier: () => Date.parse("2026-04-06T08:14:59.000Z"),
      }),
    ).buildSummary("2026-04-06T08:14:59.000Z");

    assert.equal(summary.taskMetrics.cancelledCount, 1);
    assert.equal(summary.taskMetrics.terminalCount, 1);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

// Test metrics service with superseded executions
test("metrics service correctly counts superseded executions", () => {
  const workspace = createTempWorkspace("aa-metrics-superseded-");
  const dbPath = join(workspace, "metrics-superseded.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    seedTaskAndExecution(db, store, {
      taskId: "task-superseded",
      executionId: "exec-superseded",
      traceId: "trace-superseded",
    });
    db.connection
      .prepare(`UPDATE executions SET status = ?, updated_at = ? WHERE id = ?`)
      .run("superseded", "2026-04-06T08:00:00.000Z", "exec-superseded");

    const summary = new MetricsService(
      db,
      new HealthService(db, store, {
        nowMsSupplier: () => Date.parse("2026-04-06T08:14:59.000Z"),
      }),
    ).buildSummary("2026-04-06T08:14:59.000Z");

    assert.equal(summary.executionMetrics.supersededCount, 1);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

// Test metrics service with p95 calculation for 20 steps (even number)
test("metrics service calculates p95 correctly for 20 steps", () => {
  const workspace = createTempWorkspace("aa-metrics-p95-20-");
  const dbPath = join(workspace, "metrics-p95-20.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    seedTaskAndExecution(db, store, {
      taskId: "task-p95-20",
      executionId: "exec-p95-20",
      traceId: "trace-p95-20",
    });
    seedWorkflowState(store, {
      taskId: "task-p95-20",
      status: "completed",
      retryCount: 0,
      updatedAt: "2026-04-06T08:00:00.000Z",
    });

    // Insert 20 steps with durations 100, 200, 300, ..., 2000
    for (let i = 1; i <= 20; i++) {
      store.insertStepOutput({
        id: `step-p95-20-${i}`,
        taskId: "task-p95-20",
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

    // P95 of 20 elements: index = ceil(20 * 0.95) - 1 = ceil(19) - 1 = 19 - 1 = 18
    // So p95 = 1900 (index 18, 0-based)
    assert.equal(summary.stepMetrics.p95DurationMs, 1900);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

// Test metrics service with cost metrics where averageCostPerSuccessfulTask is null
test("metrics service handles null average cost per successful task", () => {
  const workspace = createTempWorkspace("aa-metrics-null-successful-cost-");
  const dbPath = join(workspace, "metrics-null-successful-cost.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    seedTaskAndExecution(db, store, {
      taskId: "task-no-success",
      executionId: "exec-no-success",
      traceId: "trace-no-success",
    });
    // Task is not successful, so averageActualCostUsdPerSuccessfulTask should be null
    seedWorkflowState(store, {
      taskId: "task-no-success",
      status: "failed",
      retryCount: 0,
      updatedAt: "2026-04-06T08:00:00.000Z",
    });
    db.connection
      .prepare(`UPDATE tasks SET status = ?, updated_at = ?, completed_at = ?, actual_cost_usd = ? WHERE id = ?`)
      .run("failed", "2026-04-06T08:00:00.000Z", "2026-04-06T08:00:00.000Z", 10, "task-no-success");

    const summary = new MetricsService(
      db,
      new HealthService(db, store, {
        nowMsSupplier: () => Date.parse("2026-04-06T08:14:59.000Z"),
      }),
    ).buildSummary("2026-04-06T08:14:59.000Z");

    // No successful tasks, so average cost per successful task is null
    assert.equal(summary.costMetrics.averageActualCostUsdPerSuccessfulTask, null);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

// Test metrics service with task window where both are null
test("metrics service handles null task window bounds", () => {
  const workspace = createTempWorkspace("aa-metrics-null-window-");
  const dbPath = join(workspace, "metrics-null-window.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    // No tasks means no window bounds
    const summary = new MetricsService(
      db,
      new HealthService(db, store, {
        nowMsSupplier: () => Date.parse("2026-04-06T08:14:59.000Z"),
      }),
    ).buildSummary("2026-04-06T08:14:59.000Z");

    assert.equal(summary.window.firstTaskCreatedAt, null);
    assert.equal(summary.window.lastTaskUpdatedAt, null);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});
