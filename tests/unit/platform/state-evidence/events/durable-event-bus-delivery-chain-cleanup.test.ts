import test from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";

import { DurableEventBus } from "../../../../../src/platform/five-plane-state-evidence/events/durable-event-bus.js";
import { SqliteDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { seedTaskAndExecution } from "../../../../helpers/seed.js";

test("durable event bus cleans deliveryChains after fan-out delivery settles", async () => {
  const workspace = createTempWorkspace("aa-event-bus-delivery-chain-cleanup-");

  try {
    const db = new SqliteDatabase(join(workspace, "events.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const bus = new DurableEventBus(db, store);
    seedTaskAndExecution(db, store, {
      taskId: "task-delivery-chain",
      executionId: "exec-delivery-chain",
      traceId: "trace-delivery-chain",
    });

    bus.subscribe("inspect_projection", async () => undefined);

    bus.publish({
      eventType: "task:status_changed",
      taskId: "task-delivery-chain",
      executionId: "exec-delivery-chain",
      traceId: "trace-delivery-chain",
      payload: {
        fromStatus: "queued",
        toStatus: "in_progress",
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 150));

    assert.equal((bus as { deliveryChains: Map<string, Promise<void>> }).deliveryChains.size, 0);

    bus.dispose();
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});
