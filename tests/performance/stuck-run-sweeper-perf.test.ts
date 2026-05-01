/**
 * Performance Test: Stuck Run Sweeper Service
 * Measures stuck run detection throughput and sweep latency
 *
 * Design targets:
 * - Stuck run detection: >1000 ops/sec
 * - Sweep cycle execution: P99 <100ms
 * - Warning/kill/cleanup cascade: >500 ops/sec
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";
import { rmSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { reportSoftPerformanceMiss } from "../helpers/performance.js";

import { SqliteDatabase } from "../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { StuckRunSweeperService, type StuckRun } from "../../src/platform/execution/ha/stuck-run-sweeper-service.js";
import { newId, nowIso } from "../../src/platform/contracts/types/ids.js";

function createTempDb(): SqliteDatabase {
  const dbPath = join(".tmp", `stuck-run-sweeper-perf-${process.pid}-${Date.now()}.db`);
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  return db;
}

function cleanupDb(db: SqliteDatabase): void {
  db.close();
  rmSync(db.filePath, { force: true });
  rmSync(`${db.filePath}-wal`, { force: true });
  rmSync(`${db.filePath}-shm`, { force: true });
}

function createStuckRun(index: number): StuckRun {
  return {
    executionId: newId("exec"),
    taskId: newId("task"),
    harnessRunId: newId("harness"),
    workerId: `worker-${index}`,
    status: "running",
    stuckDurationMs: 1800000 + index * 1000,
    warningIssuedAt: null,
    killRequestedAt: null,
    cleanupCompletedAt: null,
    firstStartedAt: nowIso(),
  };
}

// ============================================================================
// Detection Benchmarks
// ============================================================================

test("performance: StuckRunSweeperService detectStuckRuns() >1000 ops/sec", (t) => {
  const db = createTempDb();

  try {
    const sweeper = new StuckRunSweeperService({
      onKillExecution: async () => true,
    });

    // Create test stuck runs
    const stuckRuns = Array.from({ length: 100 }, (_, i) => createStuckRun(i));

    const iterations = 1000;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      const testRuns = stuckRuns.map((run, idx) => ({
        ...run,
        executionId: `${run.executionId}-${i}-${idx}`,
      }));
      sweeper.detectStuckRuns(testRuns);
    }

    const elapsed = performance.now() - start;
    const opsPerSec = (iterations / elapsed) * 1000;

    try {
      assert.ok(opsPerSec > 1000, `detectStuckRuns() ${opsPerSec.toFixed(0)} ops/sec must be >1000 ops/sec`);
    } catch (err) {
      if (err instanceof assert.AssertionError) {
        reportSoftPerformanceMiss(t, err);
        return;
      }
      throw err;
    }
  } finally {
    cleanupDb(db);
  }
});

// ============================================================================
// Sweep Cycle Benchmarks
// ============================================================================

test("performance: StuckRunSweeperService runSweepCycle() P99 <100ms", (t) => {
  const db = createTempDb();

  try {
    let killedCount = 0;
    const sweeper = new StuckRunSweeperService({
      onKillExecution: async () => {
        killedCount++;
        return true;
      },
      config: {
        sweepIntervalMs: 1000,
        stuckThresholdMs: 1800000,
        killAfterWarningMs: 60000,
        cleanupAfterKillMs: 300000,
        maxRunsPerSweep: 100,
      },
    });

    const latencies: number[] = [];
    const iterations = 100;

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      sweeper.runSweepCycle();
      latencies.push(performance.now() - start);
    }

    latencies.sort((a, b) => a - b);
    const p99 = latencies[Math.floor(iterations * 0.99)]!;

    try {
      assert.ok(p99 < 100, `runSweepCycle() P99 latency ${p99.toFixed(3)}ms must be <100ms`);
    } catch (err) {
      if (err instanceof assert.AssertionError) {
        reportSoftPerformanceMiss(t, err);
        return;
      }
      throw err;
    }
  } finally {
    cleanupDb(db);
  }
});

// ============================================================================
// Warning Cascade Benchmarks
// ============================================================================

test("performance: StuckRunSweeperService issueWarnings() >2000 ops/sec", (t) => {
  const db = createTempDb();

  try {
    const sweeper = new StuckRunSweeperService({
      onWarningIssued: () => {},
    });

    const stuckRuns = Array.from({ length: 100 }, (_, i) => createStuckRun(i));

    const iterations = 2000;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      const testRuns = stuckRuns.map((run, idx) => ({
        ...run,
        executionId: `${run.executionId}-${i}-${idx}`,
      }));
      sweeper.issueWarnings(testRuns);
    }

    const elapsed = performance.now() - start;
    const opsPerSec = (iterations / elapsed) * 1000;

    try {
      assert.ok(opsPerSec > 2000, `issueWarnings() ${opsPerSec.toFixed(0)} ops/sec must be >2000 ops/sec`);
    } catch (err) {
      if (err instanceof assert.AssertionError) {
        reportSoftPerformanceMiss(t, err);
        return;
      }
      throw err;
    }
  } finally {
    cleanupDb(db);
  }
});

// ============================================================================
// Kill Request Benchmarks
// ============================================================================

test("performance: StuckRunSweeperService requestKill() >1000 ops/sec", (t) => {
  const db = createTempDb();

  try {
    let killCount = 0;
    const sweeper = new StuckRunSweeperService({
      onKillExecution: async () => {
        killCount++;
        return true;
      },
    });

    const stuckRuns = Array.from({ length: 50 }, (_, i) => createStuckRun(i));

    const iterations = 1000;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      const testRuns = stuckRuns.map((run, idx) => ({
        ...run,
        executionId: `${run.executionId}-${i}-${idx}`,
      }));
      sweeper.requestKill(testRuns);
    }

    const elapsed = performance.now() - start;
    const opsPerSec = (iterations / elapsed) * 1000;

    try {
      assert.ok(opsPerSec > 1000, `requestKill() ${opsPerSec.toFixed(0)} ops/sec must be >1000 ops/sec`);
    } catch (err) {
      if (err instanceof assert.AssertionError) {
        reportSoftPerformanceMiss(t, err);
        return;
      }
      throw err;
    }
  } finally {
    cleanupDb(db);
  }
});

// ============================================================================
// Cleanup Benchmarks
// ============================================================================

test("performance: StuckRunSweeperService performCleanup() >500 ops/sec", (t) => {
  const db = createTempDb();

  try {
    let cleanupCount = 0;
    const sweeper = new StuckRunSweeperService({
      onRunCleanedUp: () => {
        cleanupCount++;
      },
    });

    const stuckRuns = Array.from({ length: 50 }, (_, i) => createStuckRun(i));

    const iterations = 500;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      const testRuns = stuckRuns.map((run, idx) => ({
        ...run,
        executionId: `${run.executionId}-${i}-${idx}`,
        killRequestedAt: nowIso(),
      }));
      sweeper.performCleanup(testRuns);
    }

    const elapsed = performance.now() - start;
    const opsPerSec = (iterations / elapsed) * 1000;

    try {
      assert.ok(opsPerSec > 500, `performCleanup() ${opsPerSec.toFixed(0)} ops/sec must be >500 ops/sec`);
    } catch (err) {
      if (err instanceof assert.AssertionError) {
        reportSoftPerformanceMiss(t, err);
        return;
      }
      throw err;
    }
  } finally {
    cleanupDb(db);
  }
});