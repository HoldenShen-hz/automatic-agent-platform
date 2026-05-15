import test from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";

import { EventOpsService } from "../../../../../src/platform/five-plane-state-evidence/events/event-ops-service.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { seedTaskAndExecution } from "../../../../helpers/seed.js";

test("event ops service drains default tier1 consumers and clears backlog", async () => {
  const workspace = createTempWorkspace("aa-event-ops-");

  try {
    const db = new SqliteDatabase(join(workspace, "event-ops.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    seedTaskAndExecution(db, store, { taskId: "task-ops", executionId: "exec-ops", traceId: "trace-ops" });

    store.createTier1StatusEvent({
      taskId: "task-ops",
      executionId: "exec-ops",
      eventType: "task:status_changed",
      traceId: "trace-ops",
      payload: { fromStatus: "queued", toStatus: "in_progress" },
    });

    const ops = new EventOpsService(db, store);
    const beforePending = store.countPendingTier1Acks();
    const results = await ops.drainDefaultConsumers();
    const afterPending = store.countPendingTier1Acks();

    assert.ok(beforePending > 0);
    assert.equal(afterPending, 0);
    assert.ok(
      results.some(
        (result) =>
          result.consumerId === "task_projection"
          && result.pendingBefore >= 1
          && result.pendingAfter === 0
          && result.outcome === "delivered",
      ),
    );
    assert.ok(
      results.some(
        (result) =>
          result.consumerId === "inspect_projection"
          && result.pendingBefore >= 1
          && result.pendingAfter === 0
          && result.outcome === "delivered",
      ),
    );

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("event ops service replays failed consumer acknowledgements into a clean ack state", async () => {
  const workspace = createTempWorkspace("aa-event-replay-");

  try {
    const db = new SqliteDatabase(join(workspace, "event-replay.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    seedTaskAndExecution(db, store, { taskId: "task-replay", executionId: "exec-replay", traceId: "trace-replay" });

    store.createTier1StatusEvent({
      taskId: "task-replay",
      executionId: "exec-replay",
      eventType: "task:status_changed",
      traceId: "trace-replay",
      payload: { fromStatus: "queued", toStatus: "in_progress" },
    });

    const ops = new EventOpsService(db, store);
    ops.subscribe("task_projection", async () => {
      throw new Error("forced replay failure");
    });

    const first = await ops.replayConsumer("task_projection");
    ops.subscribe("task_projection", async () => {
      // replay succeeds
    });
    const second = await ops.replayConsumer("task_projection");

    assert.equal(first.outcome, "failed");
    assert.ok(first.failedAfter >= 1);
    assert.equal(second.outcome, "delivered");
    assert.equal(second.failedAfter, 0);
    assert.equal(second.pendingAfter, 0);
    assert.equal(store.countFailedTier1Acks(), 0);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("event ops service replays previously acknowledged history for a consumer", async () => {
  const workspace = createTempWorkspace("aa-event-replay-history-");

  try {
    const db = new SqliteDatabase(join(workspace, "event-replay-history.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    seedTaskAndExecution(db, store, { taskId: "task-replay-history", executionId: "exec-replay-history", traceId: "trace-replay-history" });

    const event = store.createTier1StatusEvent({
      taskId: "task-replay-history",
      executionId: "exec-replay-history",
      eventType: "task:status_changed",
      traceId: "trace-replay-history",
      payload: { fromStatus: "queued", toStatus: "in_progress" },
    });
    store.event.markEventAck(event.id, "task_projection");

    const ops = new EventOpsService(db, store);
    let deliveries = 0;
    ops.subscribe("task_projection", async () => {
      deliveries += 1;
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    const replay = await ops.replayConsumer("task_projection");

    assert.equal(replay.outcome, "delivered");
    assert.equal(replay.pendingBefore, 1);
    assert.ok(replay.replayedFromHistoryCount >= 1);
    assert.equal(replay.delivered, 1);
    assert.equal(replay.pendingAfter, 0);
    assert.equal(deliveries, 1);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});
