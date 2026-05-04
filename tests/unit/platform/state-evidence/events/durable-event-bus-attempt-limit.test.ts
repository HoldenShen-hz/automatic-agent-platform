import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { DurableEventBus } from "../../../../../src/platform/state-evidence/events/durable-event-bus.js";
import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { seedTaskAndExecution } from "../../../../helpers/seed.js";

test("DurableEventBus retries exactly three total attempts before dead-lettering", async () => {
  const workspace = createTempWorkspace("aa-durable-bus-attempt-limit-");
  let db: SqliteDatabase | undefined;

  try {
    db = new SqliteDatabase(join(workspace, "event-bus.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const bus = new DurableEventBus(db, store);
    seedTaskAndExecution(db, store, {
      taskId: "task-attempt-limit",
      executionId: "exec-attempt-limit",
      traceId: "trace-attempt-limit",
    });

    let attempts = 0;
    bus.subscribe("inspect_projection", async () => {
      attempts += 1;
      throw new Error("force retry");
    });

    bus.publish({
      eventType: "task:status_changed",
      taskId: "task-attempt-limit",
      executionId: "exec-attempt-limit",
      traceId: "trace-attempt-limit",
      payload: { fromStatus: "queued", toStatus: "running" },
    });

    await new Promise((resolve) => setTimeout(resolve, 2_500));

    assert.equal(attempts, 3);
    bus.dispose();
  } finally {
    db?.close();
    cleanupPath(workspace);
  }
});
