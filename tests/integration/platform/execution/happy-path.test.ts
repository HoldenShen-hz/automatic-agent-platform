import test from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";

import { runSingleTaskExecution } from "../../../../src/platform/five-plane-execution/execution-engine/single-task-execution.js";
import { AuthoritativeTaskStore } from "../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";
import { seedQueuedTasks } from "../../../helpers/seed.js";

test("single-task execution persists task, workflow, execution, session, and tier1 events", async () => {
  const workspace = createTempWorkspace("aa-happy-");

  try {
    const snapshot = await runSingleTaskExecution({
      dbPath: join(workspace, "single-task.db"),
      title: "Happy path test",
      request: "Run the minimum automatic agent flow",
    });

    assert.equal(snapshot.task.status, "done");
    assert.equal(snapshot.workflow?.status, "completed");
    assert.equal(snapshot.execution?.status, "succeeded");
    assert.equal(snapshot.session?.status, "completed");
    assert.equal(snapshot.stepOutputs.length, 1);
    assert.deepEqual(
      snapshot.events.map((event) => event.eventType),
      ["task:status_changed", "workflow:step_completed", "platform.workflow.step_completed", "task:status_changed"],
    );

    // Verify cost events were recorded during execution
    const db = new SqliteDatabase(join(workspace, "single-task.db"));
    const store = new AuthoritativeTaskStore(db);
    try {
      const costEvents = store.listCostEventsByTask(snapshot.task.id);
      const persistedExecution = store.getExecution(snapshot.execution!.id);
      const persistedPrecheck = store.getExecutionPrecheck(snapshot.execution!.id);
      assert.equal(costEvents.length, 1, "expected exactly one cost event for single-step happy path");
      const cost = costEvents[0]!;
      assert.equal(cost.taskId, snapshot.task.id);
      assert.equal(cost.executionId, snapshot.execution!.id);
      assert.equal(cost.budgetScope, "task_execution");
      assert.equal(cost.provider, "minimax");
      assert.ok(cost.costUsd > 0, "cost should be positive");
      assert.deepEqual(
        (JSON.parse(persistedExecution!.allowedToolsJson ?? "[]") as string[]).sort(),
        ["bash", "read"],
      );
      assert.deepEqual(
        (JSON.parse(persistedPrecheck!.resolvedToolsJson ?? "[]") as string[]).sort(),
        ["bash", "read"],
      );

      const totalCost = store.sumCostByTask(snapshot.task.id);
      assert.ok(totalCost > 0, "total cost should be positive");
    } finally {
      db.close();
    }
  } finally {
    cleanupPath(workspace);
  }
});

test("single-task execution respects queue-only admission backpressure and defers execution", async () => {
  const workspace = createTempWorkspace("aa-happy-");

  try {
    const snapshot = await runSingleTaskExecution({
      dbPath: join(workspace, "single-task-queued.db"),
      title: "Queued by admission",
      request: "Defer execution under backpressure",
      admissionBackpressureSnapshot: () => ({
        status: "overloaded",
        degradationMode: "queue_only",
        queueGovernance: {
          backlogSize: 8,
          dispatchableBacklogSize: 8,
          claimedBacklogSize: 0,
          oldestWaitSeconds: 600,
          oldestClaimAgeSeconds: null,
          queueNames: ["default"],
          starvationDetected: false,
        },
        findings: ["queue_backlog_overloaded"],
      }),
    });

    assert.equal(snapshot.task.status, "queued");
    assert.equal(snapshot.workflow?.status, "paused");
    assert.equal(snapshot.execution?.status, "created");
    assert.equal(snapshot.session?.status, "open");
    assert.deepEqual(
      snapshot.events.map((event) => event.eventType),
      ["workflow:status_changed", "admission:queued"],
    );
    assert.equal(snapshot.stepOutputs.length, 0);
  } finally {
    cleanupPath(workspace);
  }
});

test("single-task execution derives queue-only admission backpressure from the local health snapshot by default", async () => {
  const workspace = createTempWorkspace("aa-happy-");
  const dbPath = join(workspace, "single-task-default-health-queue.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    seedQueuedTasks(db, store, {
      count: 5,
      prefix: "single-task-default-health",
    });
    db.close();

    const snapshot = await runSingleTaskExecution({
      dbPath,
      title: "Queued by default health snapshot",
      request: "Defer execution because the local queue is already saturated.",
    });

    assert.equal(snapshot.task.status, "queued");
    assert.equal(snapshot.workflow?.status, "paused");
    assert.equal(snapshot.execution?.status, "created");
    assert.equal(snapshot.session?.status, "open");
    assert.deepEqual(
      snapshot.events.map((event) => event.eventType),
      ["workflow:status_changed", "admission:queued"],
    );
    assert.equal(snapshot.events.at(-1)?.payloadJson.includes("\"reasonCode\":\"admission.queue_backpressure\""), true);
    assert.equal(snapshot.stepOutputs.length, 0);
  } finally {
    cleanupPath(workspace);
  }
});

test("single-task execution rejects invalid step output before commit", async () => {
  const workspace = createTempWorkspace("aa-happy-");

  try {
    await assert.rejects(
      async () =>
        await runSingleTaskExecution({
          dbPath: join(workspace, "single-task-invalid-output.db"),
          title: "Invalid happy path output",
          request: "Run the minimum automatic agent flow",
          stepOutputOverride: {
            result: "",
          },
        }),
      /workflow\.output_schema_invalid/,
    );
  } finally {
    cleanupPath(workspace);
  }
});
