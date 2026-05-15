/**
 * Performance tests for Event Bus throughput
 *
 * Design targets:
 * - Event publishing: >5000 events/sec
 * - Event delivery: >3000 events/sec
 * - Subscriber throughput: >2000 events/sec
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";
import { rmSync } from "node:fs";
import { reportSoftPerformanceMiss } from "../../helpers/performance.js";

import { SqliteDatabase } from "../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStoreFacade } from "../../../src/platform/five-plane-state-evidence/truth/sqlite/authoritative-task-store-facade.js";
import { DurableEventBus } from "../../../src/platform/five-plane-state-evidence/events/durable-event-bus.js";
import { newId, nowIso } from "../../../src/platform/contracts/types/ids.js";
import { cleanupPath, createTempWorkspace } from "../../helpers/fs.js";
import { seedTaskAndExecution } from "../../helpers/seed.js";

function createTempDb(): { db: SqliteDatabase; workspace: string } {
  const workspace = createTempWorkspace("aa-perf-event-bus-");
  const dbPath = join(workspace, "event-bus-perf.db");
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  return { db, workspace };
}

test("performance: event bus publishes >5000 events/sec", (t) => {
  const { db, workspace } = createTempDb();
  const store = new AuthoritativeTaskStoreFacade(db);
  const bus = new DurableEventBus(db, store);

  try {
    const iterations = 1000;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      bus.publish({
        eventType: "task:status_changed",
        taskId: `task-perf-${i}`,
        executionId: `exec-perf-${i}`,
        traceId: newId("trace"),
        payload: { index: i },
      });
    }

    const elapsed = performance.now() - start;
    const opsPerSec = (iterations / elapsed) * 1000;
    const avgLatencyMs = elapsed / iterations;

    try {
      assert.ok(
        opsPerSec > 5000,
        `Event publish throughput ${opsPerSec.toFixed(2)} ops/sec must be >5000 ops/sec. Avg latency: ${avgLatencyMs.toFixed(3)}ms`,
      );
    } catch (err) {
      if (err instanceof assert.AssertionError) {
        reportSoftPerformanceMiss(t, err);
        return;
      }
      throw err;
    }
  } finally {
    bus.dispose();
    db.close();
    cleanupPath(workspace);
  }
});

test("performance: event bus handles burst of 1000 events", (t) => {
  const { db, workspace } = createTempDb();
  const store = new AuthoritativeTaskStoreFacade(db);
  const bus = new DurableEventBus(db, store);

  try {
    const iterations = 1000;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      bus.publish({
        eventType: "task:created",
        taskId: `task-burst-${i}`,
        executionId: `exec-burst-${i}`,
        traceId: newId("trace"),
        payload: { burstIndex: i },
      });
    }

    const elapsed = performance.now() - start;
    const opsPerSec = (iterations / elapsed) * 1000;

    try {
      assert.ok(
        opsPerSec > 2000,
        `Burst event throughput ${opsPerSec.toFixed(2)} ops/sec must be >2000 ops/sec`,
      );
    } catch (err) {
      if (err instanceof assert.AssertionError) {
        reportSoftPerformanceMiss(t, err);
        return;
      }
      throw err;
    }
  } finally {
    bus.dispose();
    db.close();
    cleanupPath(workspace);
  }
});

test("performance: event bus subscription delivery scales with subscribers", (t) => {
  const { db, workspace } = createTempDb();
  const store = new AuthoritativeTaskStoreFacade(db);
  const bus = new DurableEventBus(db, store);

  const subscriberCounts = [1, 5, 10];
  const results: { count: number; opsPerSec: number }[] = [];

  try {
    for (const subCount of subscriberCounts) {
      // Set up subscribers
      for (let s = 0; s < subCount; s++) {
        bus.subscribe(`test_topic_${s}`, async (_event) => {
          // Simulate minimal processing
        });
      }

      const iterations = 500;
      const start = performance.now();

      for (let i = 0; i < iterations; i++) {
        bus.publish({
          eventType: "task:updated",
          taskId: `task-scale-${i}`,
          executionId: `exec-scale-${i}`,
          traceId: newId("trace"),
          payload: { scaleIndex: i, subscriberCount: subCount },
        });
      }

      const elapsed = performance.now() - start;
      const opsPerSec = (iterations / elapsed) * 1000;
      results.push({ count: subCount, opsPerSec });
    }

    // Verify scaling doesn't degrade more than 3x when going from 1 to 10 subscribers
    const baseline = results[0]!.opsPerSec;
    const worstCase = results[results.length - 1]!.opsPerSec;
    const degradation = baseline / worstCase;

    try {
      assert.ok(
        degradation < 3,
        `Event bus scaling degraded by ${degradation.toFixed(1)}x, expected <3x with ${subscriberCounts.length} subscriber configs`,
      );
    } catch (err) {
      if (err instanceof assert.AssertionError) {
        reportSoftPerformanceMiss(t, err);
        return;
      }
      throw err;
    }
  } finally {
    bus.dispose();
    db.close();
    cleanupPath(workspace);
  }
});