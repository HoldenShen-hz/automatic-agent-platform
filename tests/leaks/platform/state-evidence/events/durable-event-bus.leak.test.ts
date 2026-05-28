import assert from "node:assert/strict";
import test from "node:test";

import { DurableEventBus } from "../../../../../src/platform/five-plane-state-evidence/events/durable-event-bus.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { forceFullGc, formatMegabytes, heapUsedBytes, isExplicitGcAvailable, rssBytes } from "../../../../helpers/memory-leak.js";

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

test("leak guard: DurableEventBus does not retain subscribers or polling timers across disposal cycles", async (t) => {
  if (!isExplicitGcAvailable()) {
    t.skip("memory leak guardrails require Node to run with --expose-gc");
    return;
  }
  for (let round = 0; round < 2; round += 1) {
    await exerciseBusLifecycle(round);
  }

  await forceFullGc();
  const baselineHeap = heapUsedBytes();
  const baselineRss = rssBytes();

  for (let round = 2; round < 22; round += 1) {
    await exerciseBusLifecycle(round);
    await forceFullGc();
  }

  const finalHeap = heapUsedBytes();
  const finalRss = rssBytes();
  const retainedBytes = Math.max(0, finalHeap - baselineHeap);
  const retainedRssBytes = Math.max(0, finalRss - baselineRss);
  const retainedThresholdBytes = 10 * 1024 * 1024;

  assert.ok(
    retainedBytes < retainedThresholdBytes,
    `retained heap ${formatMegabytes(retainedBytes)} exceeded ${formatMegabytes(retainedThresholdBytes)} ` +
      `after repeated event bus disposal (baseline=${formatMegabytes(baselineHeap)}, final=${formatMegabytes(finalHeap)})`,
  );
  assert.ok(
    retainedRssBytes < retainedThresholdBytes,
    `retained rss ${formatMegabytes(retainedRssBytes)} exceeded ${formatMegabytes(retainedThresholdBytes)} ` +
      `after repeated event bus disposal (baseline=${formatMegabytes(baselineRss)}, final=${formatMegabytes(finalRss)})`,
  );
});
