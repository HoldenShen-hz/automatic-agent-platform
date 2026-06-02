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

test("metrics service calculates completion rate with mixed terminal/non-terminal", () => {
  const workspace = createTempWorkspace("aa-metrics-completion-mixed-");
  const dbPath = join(workspace, "metrics-completion-mixed.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    // 2 completed, 1 still running
    for (let i = 0; i < 2; i++) {
      seedTaskAndExecution(db, store, {
        taskId: `task-terminal-${i}`,
        executionId: `exec-terminal-${i}`,
        traceId: `trace-terminal-${i}`,
      });
      seedWorkflowState(store, {
        taskId: `task-terminal-${i}`,
        status: "completed",
        retryCount: 0,
        updatedAt: "2026-04-06T08:00:00.000Z",
      });
      db.connection
        .prepare(`UPDATE tasks SET status = ?, updated_at = ?, completed_at = ? WHERE id = ?`)
        .run("done", "2026-04-06T08:00:00.000Z", "2026-04-06T08:00:00.000Z", `task-terminal-${i}`);
    }

    seedTaskAndExecution(db, store, {
      taskId: "task-running",
      executionId: "exec-running",
      traceId: "trace-running",
    });
    seedWorkflowState(store, {
      taskId: "task-running",
      status: "running",
      retryCount: 0,
      updatedAt: "2026-04-06T08:00:00.000Z",
    });

    const summary = new MetricsService(
      db,
      new HealthService(db, store, {
        nowMsSupplier: () => Date.parse("2026-04-06T08:14:59.000Z"),
      }),
    ).buildSummary("2026-04-06T08:14:59.000Z");

    // 2 terminal / 3 total = 0.6667
    assert.equal(summary.taskMetrics.completionRate, 0.6667);
    assert.equal(summary.taskMetrics.terminalCount, 2);
    assert.equal(summary.taskMetrics.activeCount, 1);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("metrics service handles all task statuses correctly", () => {
  const workspace = createTempWorkspace("aa-metrics-all-statuses-");
  const dbPath = join(workspace, "metrics-all-statuses.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    const statuses = ["done", "failed", "cancelled"] as const;

    for (const status of statuses) {
      seedTaskAndExecution(db, store, {
        taskId: `task-${status}`,
        executionId: `exec-${status}`,
        traceId: `trace-${status}`,
      });
      seedWorkflowState(store, {
        taskId: `task-${status}`,
        status: status === "done" ? "completed" : status,
        retryCount: 0,
        updatedAt: "2026-04-06T08:00:00.000Z",
      });
      db.connection
        .prepare(`UPDATE tasks SET status = ?, updated_at = ?, completed_at = ? WHERE id = ?`)
        .run(status, "2026-04-06T08:00:00.000Z", "2026-04-06T08:00:00.000Z", `task-${status}`);
    }

    const summary = new MetricsService(
      db,
      new HealthService(db, store, {
        nowMsSupplier: () => Date.parse("2026-04-06T08:14:59.000Z"),
      }),
    ).buildSummary("2026-04-06T08:14:59.000Z");

    assert.equal(summary.taskMetrics.total, 3);
    assert.equal(summary.taskMetrics.successCount, 1);
    assert.equal(summary.taskMetrics.failedCount, 1);
    assert.equal(summary.taskMetrics.cancelledCount, 1);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("metrics service calculates average token cost correctly", () => {
  const workspace = createTempWorkspace("aa-metrics-token-cost-");
  const dbPath = join(workspace, "metrics-token-cost.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    seedTaskAndExecution(db, store, {
      taskId: "task-cost",
      executionId: "exec-cost",
      traceId: "trace-cost",
    });
    seedWorkflowState(store, {
      taskId: "task-cost",
      status: "completed",
      retryCount: 0,
      updatedAt: "2026-04-06T08:00:00.000Z",
    });

    // Insert steps with costs 100, 200, 300 = total 600, avg 200
    for (let i = 0; i < 3; i++) {
      store.insertStepOutput({
        id: `step-cost-${i}`,
        taskId: "task-cost",
        stepId: `step-${i}`,
        roleId: "executor",
        status: "succeeded",
        dataJson: JSON.stringify({}),
        summary: "step",
        artifactsJson: null,
        tokenCost: (i + 1) * 100,
        durationMs: 100,
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

    assert.equal(summary.stepMetrics.totalTokenCost, 600);
    assert.equal(summary.stepMetrics.averageTokenCost, 200);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("metrics service handles zero token cost steps", () => {
  const workspace = createTempWorkspace("aa-metrics-zero-cost-");
  const dbPath = join(workspace, "metrics-zero-cost.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    seedTaskAndExecution(db, store, {
      taskId: "task-zero-cost",
      executionId: "exec-zero-cost",
      traceId: "trace-zero-cost",
    });
    seedWorkflowState(store, {
      taskId: "task-zero-cost",
      status: "completed",
      retryCount: 0,
      updatedAt: "2026-04-06T08:00:00.000Z",
    });

    store.insertStepOutput({
      id: "step-zero-cost",
      taskId: "task-zero-cost",
      stepId: "step-zero",
      roleId: "executor",
      status: "succeeded",
      dataJson: JSON.stringify({}),
      summary: "step with zero cost",
      artifactsJson: null,
      tokenCost: 0,
      durationMs: 100,
      validationJson: null,
      producedAt: "2026-04-06T08:00:00.000Z",
    });

    const summary = new MetricsService(
      db,
      new HealthService(db, store, {
        nowMsSupplier: () => Date.parse("2026-04-06T08:14:59.000Z"),
      }),
    ).buildSummary("2026-04-06T08:14:59.000Z");

    assert.equal(summary.stepMetrics.totalTokenCost, 0);
    assert.equal(summary.stepMetrics.averageTokenCost, 0);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("metrics service calculates execution retry rate with retries", () => {
  const workspace = createTempWorkspace("aa-metrics-exec-retry-");
  const dbPath = join(workspace, "metrics-exec-retry.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    // Create executions with various attempt numbers
    for (let i = 0; i < 3; i++) {
      seedTaskAndExecution(db, store, {
        taskId: `task-exec-${i}`,
        executionId: `exec-exec-${i}`,
        traceId: `trace-exec-${i}`,
      });
      // attempt > 1 means a retry
      db.connection
        .prepare(`UPDATE executions SET attempt = ?, updated_at = ? WHERE id = ?`)
        .run(i + 2, "2026-04-06T08:00:00.000Z", `exec-exec-${i}`);
    }

    const summary = new MetricsService(
      db,
      new HealthService(db, store, {
        nowMsSupplier: () => Date.parse("2026-04-06T08:14:59.000Z"),
      }),
    ).buildSummary("2026-04-06T08:14:59.000Z");

    // All 3 executions have retries (attempt > 1)
    assert.equal(summary.executionMetrics.retryAttemptCount, 3);
    assert.equal(summary.executionMetrics.retryRate, 1.0);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("metrics service handles tier 1 event counts", () => {
  const workspace = createTempWorkspace("aa-metrics-tier1-");
  const dbPath = join(workspace, "metrics-tier1.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    seedTaskAndExecution(db, store, {
      taskId: "task-tier1",
      executionId: "exec-tier1",
      traceId: "trace-tier1",
    });

    // Insert multiple tier-1 events
    for (let i = 0; i < 5; i++) {
      store.createTier1StatusEvent({
        taskId: "task-tier1",
        executionId: "exec-tier1",
        eventType: "task:status_changed",
        traceId: "trace-tier1",
        payload: { from: "queued", to: "in_progress" },
      });
    }

    const summary = new MetricsService(
      db,
      new HealthService(db, store, {
        nowMsSupplier: () => Date.parse("2026-04-06T08:14:59.000Z"),
      }),
    ).buildSummary("2026-04-06T08:14:59.000Z");

    assert.ok(summary.eventMetrics.tier1Count >= 5);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("metrics service handles cost metrics with decimal values", () => {
  const workspace = createTempWorkspace("aa-metrics-decimal-cost-");
  const dbPath = join(workspace, "metrics-decimal-cost.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    seedTaskAndExecution(db, store, {
      taskId: "task-decimal-cost",
      executionId: "exec-decimal-cost",
      traceId: "trace-decimal-cost",
    });
    seedWorkflowState(store, {
      taskId: "task-decimal-cost",
      status: "completed",
      retryCount: 0,
      updatedAt: "2026-04-06T08:00:00.000Z",
    });

    db.connection
      .prepare(`UPDATE tasks SET status = ?, actual_cost_usd = ?, updated_at = ?, completed_at = ? WHERE id = ?`)
      .run("done", 1.234, "2026-04-06T08:00:00.000Z", "2026-04-06T08:00:00.000Z", "task-decimal-cost");

    const summary = new MetricsService(
      db,
      new HealthService(db, store, {
        nowMsSupplier: () => Date.parse("2026-04-06T08:14:59.000Z"),
      }),
    ).buildSummary("2026-04-06T08:14:59.000Z");

    assert.equal(summary.costMetrics.totalActualCostUsd, 1.234);
    assert.equal(summary.costMetrics.averageActualCostUsdPerTask, 1.234);
    assert.equal(summary.costMetrics.averageActualCostUsdPerSuccessfulTask, 1.234);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("metrics service calculates workflow metrics correctly", () => {
  const workspace = createTempWorkspace("aa-metrics-workflow-");
  const dbPath = join(workspace, "metrics-workflow.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    seedTaskAndExecution(db, store, {
      taskId: "task-workflow-1",
      executionId: "exec-workflow-1",
      traceId: "trace-workflow-1",
    });
    seedWorkflowState(store, {
      taskId: "task-workflow-1",
      status: "completed",
      retryCount: 0,
      updatedAt: "2026-04-06T08:00:00.000Z",
    });

    seedTaskAndExecution(db, store, {
      taskId: "task-workflow-2",
      executionId: "exec-workflow-2",
      traceId: "trace-workflow-2",
    });
    seedWorkflowState(store, {
      taskId: "task-workflow-2",
      status: "failed",
      retryCount: 2,
      updatedAt: "2026-04-06T08:00:00.000Z",
    });

    const summary = new MetricsService(
      db,
      new HealthService(db, store, {
        nowMsSupplier: () => Date.parse("2026-04-06T08:14:59.000Z"),
      }),
    ).buildSummary("2026-04-06T08:14:59.000Z");

    assert.equal(summary.workflowMetrics.total, 2);
    assert.equal(summary.workflowMetrics.retriedCount, 1);
    assert.equal(summary.workflowMetrics.retryRate, 0.5);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("metrics service handles approval metrics with multiple approvals per task", () => {
  const workspace = createTempWorkspace("aa-metrics-multi-approval-");
  const dbPath = join(workspace, "metrics-multi-approval.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const approvals = new ApprovalService(db, store);

    seedTaskAndExecution(db, store, {
      taskId: "task-multi-approval",
      executionId: "exec-multi-approval",
      traceId: "trace-multi-approval",
    });

    // Create multiple approval requests for the same task
    for (let i = 0; i < 3; i++) {
      approvals.createRequest({
        taskId: "task-multi-approval",
        executionId: "exec-multi-approval",
        sourceAgentId: `agent-${i}`,
        reason: `Approval ${i}`,
        riskLevel: "high",
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

    assert.equal(summary.approvalMetrics.total, 3);
    assert.equal(summary.approvalMetrics.pendingCount, 3);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("metrics service handles event metrics with mixed tiers", () => {
  const workspace = createTempWorkspace("aa-metrics-mixed-tier-");
  const dbPath = join(workspace, "metrics-mixed-tier.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    seedTaskAndExecution(db, store, {
      taskId: "task-mixed-tier",
      executionId: "exec-mixed-tier",
      traceId: "trace-mixed-tier",
    });

    // Insert tier-2 event
    store.insertEvent({
      id: "evt-tier2",
      taskId: "task-mixed-tier",
      executionId: "exec-mixed-tier",
      eventType: "task:status_changed",
      eventTier: "tier_2",
      payloadJson: JSON.stringify({}),
      traceId: "trace-mixed-tier",
      createdAt: "2026-04-06T08:00:00.000Z",
    });

    // Insert tier-3 event
    store.insertEvent({
      id: "evt-tier3",
      taskId: "task-mixed-tier",
      executionId: "exec-mixed-tier",
      eventType: "stream:chunk_emitted",
      eventTier: "tier_3",
      payloadJson: JSON.stringify({}),
      traceId: "trace-mixed-tier",
      createdAt: "2026-04-06T08:00:00.000Z",
    });

    const summary = new MetricsService(
      db,
      new HealthService(db, store, {
        nowMsSupplier: () => Date.parse("2026-04-06T08:14:59.000Z"),
      }),
    ).buildSummary("2026-04-06T08:14:59.000Z");

    assert.ok(summary.eventMetrics.tier2Count >= 1);
    assert.ok(summary.eventMetrics.tier3Count >= 1);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});
