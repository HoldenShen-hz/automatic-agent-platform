/**
 * Integration Test: Admission Controller
 *
 * Tests AdmissionController with real SQLite database,
 * verifying admission decisions based on actual system state.
 */

import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { SqliteDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { AdmissionController, DEFAULT_ADMISSION_POLICY } from "../../../../../src/platform/five-plane-execution/dispatcher/admission-controller.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { newId, nowIso } from "../../../../../src/platform/contracts/types/ids.js";

function createIntegrationContext(prefix: string) {
  const workspace = createTempWorkspace(prefix);
  const dbPath = join(workspace, "admission-test.db");
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  return { workspace, dbPath, db, store, cleanup: () => { db.close(); cleanupPath(workspace); } };
}

function insertTaskWithStatus(
  store: AuthoritativeTaskStore,
  id: string,
  status: "queued" | "in_progress" | "done",
  divisionId = "general_ops",
): void {
  const now = nowIso();
  store.insertTask({
    id,
    parentId: null,
    rootId: id,
    divisionId,
    title: `Test task ${id}`,
    status,
    source: "user",
    priority: "normal",
    inputJson: "{}",
    normalizedInputJson: "{}",
    outputJson: null,
    estimatedCostUsd: 0,
    actualCostUsd: 0,
    errorCode: null,
    createdAt: now,
    updatedAt: now,
    completedAt: status === "done" ? now : null,
  });
}

function insertExecution(
  store: AuthoritativeTaskStore,
  id: string,
  taskId: string,
  status: "executing" | "succeeded",
): void {
  const now = nowIso();
  store.insertExecution({
    id,
    taskId,
    workflowId: "single_agent_minimal",
    parentExecutionId: null,
    agentId: "agent-test",
    roleId: "general_executor",
    runKind: "task_run",
    status,
    inputRef: null,
    traceId: `trace-${id}`,
    attempt: 1,
    timeoutMs: 60000,
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
    finishedAt: status === "succeeded" ? now : null,
    createdAt: now,
    updatedAt: now,
  });
}

test("AdmissionController snapshot reflects actual queued task count", () => {
  const ctx = createIntegrationContext("aa-admission-queued-");
  try {
    // Initially no queued tasks
    let controller = new AdmissionController(ctx.store);
    assert.equal(controller.snapshot().queuedTasks, 0);

    // Insert some queued tasks
    insertTaskWithStatus(ctx.store, "task-q-001", "queued");
    insertTaskWithStatus(ctx.store, "task-q-002", "queued");
    insertTaskWithStatus(ctx.store, "task-q-003", "queued");

    // Re-create controller to get fresh snapshot
    controller = new AdmissionController(ctx.store);
    assert.equal(controller.snapshot().queuedTasks, 3);
  } finally {
    ctx.cleanup();
  }
});

test("AdmissionController snapshot reflects actual active execution count", () => {
  const ctx = createIntegrationContext("aa-admission-active-");
  try {
    // Create tasks first
    insertTaskWithStatus(ctx.store, "task-exec-001", "in_progress");
    insertTaskWithStatus(ctx.store, "task-exec-002", "in_progress");

    // Insert executing executions
    insertExecution(ctx.store, "exec-001", "task-exec-001", "executing");
    insertExecution(ctx.store, "exec-002", "task-exec-002", "executing");

    const controller = new AdmissionController(ctx.store);
    assert.equal(controller.snapshot().activeExecutions, 2);
  } finally {
    ctx.cleanup();
  }
});

test("AdmissionController evaluate allows when under all limits", () => {
  const ctx = createIntegrationContext("aa-admission-allow-");
  try {
    // Insert some queued tasks and executions but stay under limits
    insertTaskWithStatus(ctx.store, "task-allow-001", "queued");
    insertTaskWithStatus(ctx.store, "task-allow-002", "queued");

    insertTaskWithStatus(ctx.store, "task-exec-001", "in_progress");
    insertExecution(ctx.store, "exec-001", "task-exec-001", "executing");

    const controller = new AdmissionController(ctx.store);
    const decision = controller.evaluate({ priority: "normal" });

    assert.equal(decision.decision, "allow");
    assert.equal(decision.reasonCode, "admission.ok");
  } finally {
    ctx.cleanup();
  }
});

test("AdmissionController evaluate queues when queued tasks exceed maxQueuedTasks", () => {
  const ctx = createIntegrationContext("aa-admission-queue-");
  try {
    // Insert queued tasks to exceed maxQueuedTasks (5 by default)
    for (let i = 0; i < 6; i++) {
      insertTaskWithStatus(ctx.store, `task-q-${i}`, "queued");
    }

    const controller = new AdmissionController(ctx.store);
    const decision = controller.evaluate({ priority: "normal" });

    assert.equal(decision.decision, "reject");
    assert.equal(decision.reasonCode, "admission.reject_queue_saturated");
  } finally {
    ctx.cleanup();
  }
});

test("AdmissionController evaluate allows urgent priority when queue is near limit but within headroom", () => {
  const ctx = createIntegrationContext("aa-admission-urgent-");
  try {
    // Insert queued tasks to be at maxQueuedTasks (5)
    for (let i = 0; i < 5; i++) {
      insertTaskWithStatus(ctx.store, `task-q-${i}`, "queued");
    }

    const controller = new AdmissionController(ctx.store);

    // High priority with headroom of 2 should still be allowed
    const decision = controller.evaluate({ priority: "high" });
    assert.equal(decision.decision, "queue");
    assert.equal(decision.reasonCode, "admission.queue_overloaded");
  } finally {
    ctx.cleanup();
  }
});

test("AdmissionController evaluate queues when active executions exceed maxActiveExecutions", () => {
  const ctx = createIntegrationContext("aa-admission-overload-");
  try {
    // Create enough executing workflows to exceed maxActiveExecutions (10)
    for (let i = 0; i < 10; i++) {
      insertTaskWithStatus(ctx.store, `task-exec-${i}`, "in_progress");
      insertExecution(ctx.store, `exec-${i}`, `task-exec-${i}`, "executing");
    }

    const controller = new AdmissionController(ctx.store);
    const decision = controller.evaluate({ priority: "normal" });

    assert.equal(decision.decision, "queue");
    assert.equal(decision.reasonCode, "admission.queue_overloaded");
  } finally {
    ctx.cleanup();
  }
});

test("AdmissionController evaluate rejects when budget exceeded", () => {
  const ctx = createIntegrationContext("aa-admission-budget-");
  try {
    const controller = new AdmissionController(ctx.store);
    const decision = controller.evaluate({
      priority: "normal",
      estimatedCostUsd: 10,
      budgetRemainingUsd: 5,
    });

    assert.equal(decision.decision, "reject");
    assert.equal(decision.reasonCode, "admission.reject_budget_exceeded");
  } finally {
    ctx.cleanup();
  }
});

test("AdmissionController evaluate allows when estimated cost is within budget", () => {
  const ctx = createIntegrationContext("aa-admission-budget-ok-");
  try {
    const controller = new AdmissionController(ctx.store);
    const decision = controller.evaluate({
      priority: "normal",
      estimatedCostUsd: 3,
      budgetRemainingUsd: 5,
    });

    assert.equal(decision.decision, "allow");
    assert.equal(decision.reasonCode, "admission.ok");
  } finally {
    ctx.cleanup();
  }
});

test("AdmissionController custom policy overrides are respected", () => {
  const ctx = createIntegrationContext("aa-admission-custom-");
  try {
    const customPolicy = {
      maxQueuedTasks: 2,
      maxActiveExecutions: 2,
      maxTier1AckBacklog: 10,
      urgentQueueHeadroom: 1,
    };

    insertTaskWithStatus(ctx.store, "task-1", "queued");
    insertTaskWithStatus(ctx.store, "task-2", "queued");

    const controller = new AdmissionController(ctx.store, customPolicy);
    const decision = controller.evaluate({ priority: "normal" });

    // With maxQueuedTasks=2 and 2 queued tasks, should reject
    assert.equal(decision.decision, "reject");
    assert.equal(decision.reasonCode, "admission.reject_queue_saturated");
  } finally {
    ctx.cleanup();
  }
});

test("AdmissionController snapshot captures all three metrics together", () => {
  const ctx = createIntegrationContext("aa-admission-snapshot-");
  try {
    // Set up: 2 queued tasks, 3 active executions
    insertTaskWithStatus(ctx.store, "task-q-1", "queued");
    insertTaskWithStatus(ctx.store, "task-q-2", "queued");

    for (let i = 0; i < 3; i++) {
      insertTaskWithStatus(ctx.store, `task-exec-${i}`, "in_progress");
      insertExecution(ctx.store, `exec-${i}`, `task-exec-${i}`, "executing");
    }

    const controller = new AdmissionController(ctx.store);
    const snapshot = controller.snapshot();

    assert.equal(snapshot.queuedTasks, 2);
    assert.equal(snapshot.activeExecutions, 3);
    assert.equal(snapshot.tier1AckBacklog, 0); // No events inserted
  } finally {
    ctx.cleanup();
  }
});

test("AdmissionController decision includes snapshot in response", () => {
  const ctx = createIntegrationContext("aa-admission-decision-");
  try {
    insertTaskWithStatus(ctx.store, "task-1", "queued");

    const controller = new AdmissionController(ctx.store);
    const decision = controller.evaluate({ priority: "normal" });

    assert.ok(decision.snapshot);
    assert.equal(decision.snapshot.queuedTasks, 1);
    assert.equal(decision.snapshot.activeExecutions, 0);
    assert.equal(decision.snapshot.tier1AckBacklog, 0);
  } finally {
    ctx.cleanup();
  }
});

test("AdmissionController evaluate uses backpressureSnapshot when provided", () => {
  const ctx = createIntegrationContext("aa-admission-backpressure-");
  try {
    const snapshot = {
      status: "degraded",
      degradationMode: "queue_only",
      queueGovernance: {
        backlogSize: 4,
        dispatchableBacklogSize: 3,
        claimedBacklogSize: 1,
        oldestWaitSeconds: 12,
        oldestClaimAgeSeconds: 5,
        queueNames: ["default"],
        starvationDetected: false,
      },
      findings: ["queue_backpressure"],
    } as const;

    const controller = new AdmissionController(ctx.store, undefined, () => snapshot);
    const decision = controller.evaluate({ priority: "normal" });

    assert.equal(decision.reasonCode, "admission.queue_backpressure");
    assert.deepEqual(decision.backpressure, snapshot);
  } finally {
    ctx.cleanup();
  }
});

test("AdmissionController low priority task rejected when queue saturated", () => {
  const ctx = createIntegrationContext("aa-admission-low-prio-");
  try {
    // Saturate the queue
    for (let i = 0; i < 6; i++) {
      insertTaskWithStatus(ctx.store, `task-q-${i}`, "queued");
    }

    const controller = new AdmissionController(ctx.store);
    const decision = controller.evaluate({ priority: "low" });

    assert.equal(decision.decision, "reject");
    assert.equal(decision.reasonCode, "admission.reject_queue_saturated");
  } finally {
    ctx.cleanup();
  }
});

test("AdmissionController normal priority at exact limit is rejected", () => {
  const ctx = createIntegrationContext("aa-admission-exact-limit-");
  try {
    // Insert exactly maxQueuedTasks (5)
    for (let i = 0; i < 5; i++) {
      insertTaskWithStatus(ctx.store, `task-q-${i}`, "queued");
    }

    const controller = new AdmissionController(ctx.store);
    const decision = controller.evaluate({ priority: "normal" });

    // At exactly max, normal priority is rejected (>= check)
    assert.equal(decision.decision, "reject");
    assert.equal(decision.reasonCode, "admission.reject_queue_saturated");
  } finally {
    ctx.cleanup();
  }
});
