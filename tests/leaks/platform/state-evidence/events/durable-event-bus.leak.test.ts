import assert from "node:assert/strict";
import test from "node:test";

import { DurableEventBus } from "../../../../../src/platform/state-evidence/events/durable-event-bus.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { forceFullGc, formatMegabytes, heapUsedBytes } from "../../../../helpers/memory-leak.js";

function createTestBus(round: number): { bus: DurableEventBus; db: SqliteDatabase; workspace: string } {
  const workspace = createTempWorkspace(`event-bus-leak-${round}-`);
  const db = new SqliteDatabase(`${workspace}/event-bus-leak.db`);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  return { bus: new DurableEventBus(db, store), db, workspace };
}

async function exerciseBusLifecycle(round: number): Promise<void> {
  const { bus, db, workspace } = createTestBus(round);

  try {
    for (let index = 0; index < 160; index += 1) {
      bus.subscribe(`consumer-${round}-${index}`, () => {});
    }
    for (let index = 0; index < 160; index += 2) {
      bus.unsubscribe(`consumer-${round}-${index}`);
    }
  } finally {
    bus.dispose();
    db.close();
    cleanupPath(workspace);
  }
}

test("leak guard: DurableEventBus does not retain subscribers or polling timers across disposal cycles", async () => {
  for (let round = 0; round < 2; round += 1) {
    await exerciseBusLifecycle(round);
  }

  await forceFullGc();
  const baselineHeap = heapUsedBytes();

  for (let round = 2; round < 22; round += 1) {
    await exerciseBusLifecycle(round);
    await forceFullGc();
  }

  const finalHeap = heapUsedBytes();
  const retainedBytes = Math.max(0, finalHeap - baselineHeap);
  const retainedThresholdBytes = 10 * 1024 * 1024;

  assert.ok(
    retainedBytes < retainedThresholdBytes,
    `retained heap ${formatMegabytes(retainedBytes)} exceeded ${formatMegabytes(retainedThresholdBytes)} ` +
      `after repeated event bus disposal (baseline=${formatMegabytes(baselineHeap)}, final=${formatMegabytes(finalHeap)})`,
  );
});
