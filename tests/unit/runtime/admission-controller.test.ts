import test from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";

import { AdmissionController } from "../../../src/platform/execution/dispatcher/admission-controller.js";
import { SqliteDatabase } from "../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { cleanupPath, createTempWorkspace } from "../../helpers/fs.js";
import { seedTaskAndExecution } from "../../helpers/seed.js";

test("admission controller allows work when runtime is below thresholds", () => {
  const workspace = createTempWorkspace("aa-admission-");

  try {
    const db = new SqliteDatabase(join(workspace, "admission.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const controller = new AdmissionController(store);

    const decision = controller.evaluate({
      priority: "normal",
      estimatedCostUsd: 0.2,
      budgetRemainingUsd: 1,
    });

    assert.equal(decision.decision, "allow");
    assert.equal(decision.reasonCode, "admission.ok");
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("admission controller rejects when budget is exceeded", () => {
  const workspace = createTempWorkspace("aa-admission-");

  try {
    const db = new SqliteDatabase(join(workspace, "admission.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const controller = new AdmissionController(store);

    const decision = controller.evaluate({
      priority: "normal",
      estimatedCostUsd: 1.5,
      budgetRemainingUsd: 1,
    });

    assert.equal(decision.decision, "reject");
    assert.equal(decision.reasonCode, "admission.reject_budget_exceeded");
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("admission controller queues under active execution overload and rejects when queue saturates", () => {
  const workspace = createTempWorkspace("aa-admission-");

  try {
    const db = new SqliteDatabase(join(workspace, "admission.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    for (let index = 0; index < 10; index += 1) {
      seedTaskAndExecution(db, store, {
        taskId: `task-active-${index}`,
        executionId: `exec-active-${index}`,
        traceId: `trace-active-${index}`,
      });
    }

    const controller = new AdmissionController(store);
    const overloadedDecision = controller.evaluate({
      priority: "normal",
    });

    assert.equal(overloadedDecision.decision, "queue");
    assert.equal(overloadedDecision.reasonCode, "admission.queue_overloaded");

    db.connection
      .prepare(`UPDATE executions SET status = 'succeeded', finished_at = CURRENT_TIMESTAMP`)
      .run();

    for (let index = 0; index < 5; index += 1) {
      db.transaction(() => {
        store.insertTask({
          id: `task-queued-${index}`,
          parentId: null,
          rootId: `task-queued-${index}`,
          divisionId: "general_ops",
          title: `Queued ${index}`,
          status: "queued",
          source: "user",
          priority: "normal",
          inputJson: "{}",
          normalizedInputJson: "{}",
          outputJson: null,
          estimatedCostUsd: 0,
          actualCostUsd: 0,
          errorCode: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          completedAt: null,
        });
      });
    }

    const saturatedDecision = controller.evaluate({
      priority: "low",
    });

    assert.equal(saturatedDecision.decision, "reject");
    assert.equal(saturatedDecision.reasonCode, "admission.reject_queue_saturated");
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("admission controller rejects when tier1 backlog crosses the hard limit", () => {
  const workspace = createTempWorkspace("aa-admission-");

  try {
    const db = new SqliteDatabase(join(workspace, "admission.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    seedTaskAndExecution(db, store, {
      taskId: "task-tier1",
      executionId: "exec-tier1",
      traceId: "trace-tier1",
    });

    for (let index = 0; index < 25; index += 1) {
      store.createTier1StatusEvent({
        taskId: "task-tier1",
        executionId: "exec-tier1",
        eventType: "task:status_changed",
        traceId: "trace-tier1",
        payload: { index },
      });
    }

    const controller = new AdmissionController(store);
    const decision = controller.evaluate({
      priority: "urgent",
    });

    assert.equal(decision.decision, "reject");
    assert.equal(decision.reasonCode, "admission.reject_tier1_backlog");
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("admission controller queues normal priority work when queue_only backpressure is active", () => {
  const workspace = createTempWorkspace("aa-admission-");

  try {
    const db = new SqliteDatabase(join(workspace, "admission.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const controller = new AdmissionController(store, undefined, () => ({
      status: "overloaded",
      degradationMode: "queue_only",
      queueGovernance: {
        backlogSize: 3,
        dispatchableBacklogSize: 3,
        claimedBacklogSize: 0,
        oldestWaitSeconds: 420,
        oldestClaimAgeSeconds: null,
        queueNames: ["default"],
        starvationDetected: false,
      },
      findings: ["queue_backlog_degraded"],
    }));

    const decision = controller.evaluate({
      priority: "normal",
    });

    assert.equal(decision.decision, "queue");
    assert.equal(decision.reasonCode, "admission.queue_backpressure");
    assert.equal(decision.backpressure?.degradationMode, "queue_only");
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("admission controller rejects low priority work when starvation protection is active", () => {
  const workspace = createTempWorkspace("aa-admission-");

  try {
    const db = new SqliteDatabase(join(workspace, "admission.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const controller = new AdmissionController(store, undefined, () => ({
      status: "overloaded",
      degradationMode: "queue_only",
      queueGovernance: {
        backlogSize: 6,
        dispatchableBacklogSize: 5,
        claimedBacklogSize: 1,
        oldestWaitSeconds: 900,
        oldestClaimAgeSeconds: 600,
        queueNames: ["default"],
        starvationDetected: true,
      },
      findings: ["queue_starvation_detected"],
    }));

    const decision = controller.evaluate({
      priority: "low",
    });

    assert.equal(decision.decision, "reject");
    assert.equal(decision.reasonCode, "admission.reject_starvation_protection");
    assert.equal(decision.backpressure?.queueGovernance.starvationDetected, true);
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("admission controller rejects non-critical work when pause_non_critical mode is active", () => {
  const workspace = createTempWorkspace("aa-admission-");

  try {
    const db = new SqliteDatabase(join(workspace, "admission.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const controller = new AdmissionController(store, undefined, () => ({
      status: "overloaded",
      degradationMode: "pause_non_critical",
      queueGovernance: {
        backlogSize: 0,
        dispatchableBacklogSize: 0,
        claimedBacklogSize: 0,
        oldestWaitSeconds: null,
        oldestClaimAgeSeconds: null,
        queueNames: [],
        starvationDetected: false,
      },
      findings: ["tier1_ack_backlog_overloaded"],
    }));

    const decision = controller.evaluate({
      priority: "normal",
    });

    assert.equal(decision.decision, "reject");
    assert.equal(decision.reasonCode, "admission.reject_non_critical_paused");
    assert.equal(decision.backpressure?.degradationMode, "pause_non_critical");
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("admission controller rejects authoritative work when read-only mode is active", () => {
  const workspace = createTempWorkspace("aa-admission-");

  try {
    const db = new SqliteDatabase(join(workspace, "admission.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const controller = new AdmissionController(store, undefined, () => ({
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

    const decision = controller.evaluate({
      priority: "urgent",
    });

    assert.equal(decision.decision, "reject");
    assert.equal(decision.reasonCode, "admission.reject_read_only_mode");
    assert.equal(decision.backpressure?.degradationMode, "read_only_operations_only");
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});
