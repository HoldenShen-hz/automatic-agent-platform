import test from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";

import { DurableEventBus } from "../../../../../src/platform/five-plane-state-evidence/events/durable-event-bus.js";
import { SqliteDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { seedTaskAndExecution } from "../../../../helpers/seed.js";

test("durable event bus deliverPending returns 0 when pending events exist but the consumer has no handler", async () => {
  const workspace = createTempWorkspace("aa-event-bus-no-handler-");

  try {
    const db = new SqliteDatabase(join(workspace, "events.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const bus = new DurableEventBus(db, store);

    seedTaskAndExecution(db, store, {
      taskId: "task-no-handler",
      executionId: "exec-no-handler",
      traceId: "trace-no-handler",
    });

    bus.subscribe("inspect_projection", async () => {});
    bus.publish({
      eventType: "task:status_changed",
      taskId: "task-no-handler",
      executionId: "exec-no-handler",
      traceId: "trace-no-handler",
      payload: {
        fromStatus: "queued",
        toStatus: "in_progress",
      },
    });

    const pendingBefore = bus.pendingForConsumer("inspect_projection");
    assert.equal(pendingBefore.length, 1);

    bus.unsubscribe("inspect_projection");

    const delivered = await bus.deliverPending("inspect_projection");
    assert.equal(delivered, 0);

    const pendingAfter = bus.pendingForConsumer("inspect_projection");
    assert.equal(pendingAfter.length, 1);

    bus.dispose();
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});
