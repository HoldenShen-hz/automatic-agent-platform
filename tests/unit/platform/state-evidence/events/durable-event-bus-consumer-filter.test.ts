import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { DurableEventBus } from "../../../../../src/platform/state-evidence/events/durable-event-bus.js";
import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { seedTaskAndExecution } from "../../../../helpers/seed.js";

test("durable event bus only creates pending acks for consumers registered to the event type", () => {
  const workspace = createTempWorkspace("aa-event-bus-consumer-filter-");

  try {
    const db = new SqliteDatabase(join(workspace, "events.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const bus = new DurableEventBus(db, store);
    seedTaskAndExecution(db, store, { taskId: "task-filter", executionId: "exec-filter", traceId: "trace-filter" });

    bus.subscribe("custom_projection", async () => undefined);

    bus.publish({
      eventType: "task:status_changed",
      taskId: "task-filter",
      executionId: "exec-filter",
      traceId: "trace-filter",
      payload: {
        fromStatus: "queued",
        toStatus: "in_progress",
        reasonCode: "scheduler.dispatch",
      },
    });

    assert.equal(bus.pendingForConsumer("custom_projection").length, 0);

    bus.dispose();
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});
