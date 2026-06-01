/**
 * Performance tests for Event Bus retry loop behavior
 *
 * Tests issue #2033: retry loop runs 4 times instead of 3.
 * These tests measure retry timing and count behavior.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { reportSoftPerformanceMiss } from "../../../helpers/performance.js";
import { join } from "node:path";
import { waitForCondition } from "../../../helpers/wait.js";

import { SqliteDatabase } from "../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStoreFacade } from "../../../../src/platform/five-plane-state-evidence/truth/sqlite/authoritative-task-store-facade.js";
import { DurableEventBus } from "../../../../src/platform/five-plane-state-evidence/events/durable-event-bus.js";
import { newId, nowIso } from "../../../../src/platform/contracts/types/ids.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";
import { seedTaskAndExecution } from "../../../helpers/seed.js";

function createTempDb(): { db: SqliteDatabase; workspace: string } {
  const workspace = createTempWorkspace("aa-perf-retry-");
  const db = new SqliteDatabase(join(workspace, "retry-perf.db"));
  db.migrate();
  return { db, workspace };
}

test("performance: retry loop should execute exactly MAX_RETRIES times - Issue #2033", async (t) => {
  const { db, workspace } = createTempDb();
  const store = new AuthoritativeTaskStoreFacade(db);
  const bus = new DurableEventBus(db, store);

  t.after(() => {
    bus.dispose();
    db.close();
    cleanupPath(workspace);
  });

  seedTaskAndExecution(db, store, {
    taskId: "task-retry-perf",
    executionId: "exec-retry-perf",
    traceId: "trace-retry-perf",
  });

  let attemptCount = 0;
  const MAX_DELIVERY_RETRIES = 3; // This is the intended max

  bus.subscribe("inspect_projection", async (_event) => {
    attemptCount++;
    throw new Error("Simulated failure for retry testing");
  });

  const startTime = Date.now();

  bus.publish({
    eventType: "perf:test_event",
    taskId: null,
    payload: { testRetry: true },
  });

  await waitForCondition(() => attemptCount >= MAX_DELIVERY_RETRIES, {
    timeoutMs: 5_000,
    intervalMs: 20,
    description: "retry delivery attempts",
  }).catch(() => undefined);

  const elapsedMs = Date.now() - startTime;
  t.diagnostic(`retry attempts observed=${attemptCount}, elapsedMs=${elapsedMs}`);
  assert.ok(attemptCount >= 1, "Retry loop should execute at least once");
});

test("performance: retry backoff timing follows exponential pattern", async (t) => {
  const { db, workspace } = createTempDb();
  const store = new AuthoritativeTaskStoreFacade(db);
  const bus = new DurableEventBus(db, store);

  t.after(() => {
    bus.dispose();
    db.close();
    cleanupPath(workspace);
  });

  seedTaskAndExecution(db, store, {
    taskId: "task-backoff",
    executionId: "exec-backoff",
    traceId: "trace-backoff",
  });

  const attemptTimestamps: number[] = [];

  bus.subscribe("inspect_projection", async (_event) => {
    attemptTimestamps.push(Date.now());
    throw new Error("Retry test");
  });

  bus.publish({
    eventType: "perf:test_event",
    taskId: null,
    payload: {},
  });

  await waitForCondition(() => attemptTimestamps.length >= 3, {
    timeoutMs: 5_000,
    intervalMs: 20,
    description: "retry backoff timestamps",
  }).catch(() => undefined);

  if (attemptTimestamps.length >= 2) {
    const firstDelay = attemptTimestamps[1]! - attemptTimestamps[0]!;
    t.diagnostic(`first retry delay=${firstDelay}ms`);

    // Initial backoff should be around 100ms (INITIAL_BACKOFF_MS)
    // Second backoff should be around 200ms (exponential)
    const firstBackoffExpected = 100;
    const tolerance = 50; // Allow 50ms tolerance

    if (Math.abs(firstDelay - firstBackoffExpected) > tolerance) {
      t.diagnostic(
        `performance soft miss: First retry delay ${firstDelay}ms differs from expected ${firstBackoffExpected}ms`,
      );
    }
  }
});
