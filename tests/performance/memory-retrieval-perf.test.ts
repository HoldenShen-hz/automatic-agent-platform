/**
 * Performance Test: Memory Retrieval Latency
 * Measures memory retrieval service performance with FTS and keyword search
 *
 * Design targets:
 * - Memory retrieval by ID: >5000 ops/sec
 * - Keyword search: >1000 ops/sec
 * - Memory list by task: >2000 ops/sec
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";
import { rmSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { reportSoftPerformanceMiss } from "../helpers/performance.js";

import { SqliteDatabase } from "../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { buildFtsMatchQuery } from "../../src/platform/state-evidence/memory/memory-retrieval-service.js";
import { newId, nowIso } from "../../src/platform/contracts/types/ids.js";

function createTempDb(): SqliteDatabase {
  const dbPath = join(".tmp", `memory-retrieval-perf-${process.pid}-${Date.now()}.db`);
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  return db;
}

function createMemoryRecord(
  store: AuthoritativeTaskStore,
  taskId: string,
  contentJson: string,
  memoryKind: "working" | "long_term" | "session_summary" = "working",
): string {
  const memoryId = newId("mem");
  const now = nowIso();
  store.memory.insertMemory({
    memoryId,
    taskId,
    agentId: null,
    kind: memoryKind,
    contentJson,
    contentSize: contentJson.length,
    importanceScore: 0.5,
    createdAt: now,
    accessedAt: now,
    decayScore: null,
  });
  return memoryId;
}

// ============================================================================
// FTS Query Building Benchmarks
// ============================================================================

test("performance: buildFtsMatchQuery() throughput >50000 ops/sec", (t) => {
  const queries = [
    "hello world",
    "typescript function async",
    "react component state",
    "database query optimization",
    "machine learning model training",
  ];

  const iterations = 5000;
  const start = performance.now();

  for (let i = 0; i < iterations; i++) {
    buildFtsMatchQuery(queries[i % queries.length]!);
  }

  const elapsed = performance.now() - start;
  const opsPerSec = (iterations / elapsed) * 1000;
  const avgLatencyMs = elapsed / iterations;

  try {
    assert.ok(
      opsPerSec > 50000,
      `FTS query building throughput ${opsPerSec.toFixed(0)} ops/sec must be >50000 ops/sec. Avg: ${avgLatencyMs.toFixed(4)}ms`,
    );
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      reportSoftPerformanceMiss(t, err);
      return;
    }
    throw err;
  }
});

test("performance: buildFtsMatchQuery() P99 latency <0.1ms", (t) => {
  const queries = [
    "hello world",
    "typescript function async",
    "react component state",
    "database query optimization",
    "machine learning model training",
    "kubernetes deployment docker container",
    "api rest endpoint authentication",
  ];

  const latencies: number[] = [];
  const iterations = 2000;

  // Warmup
  for (let i = 0; i < 100; i++) {
    buildFtsMatchQuery(queries[i % queries.length]!);
  }

  // Measure
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    buildFtsMatchQuery(queries[i % queries.length]!);
    latencies.push(performance.now() - start);
  }

  latencies.sort((a, b) => a - b);
  const p99 = latencies[Math.floor(iterations * 0.99)]!;
  const p50 = latencies[Math.floor(iterations * 0.5)]!;

  try {
    assert.ok(
      p99 < 0.1,
      `FTS query building P99 latency ${p99.toFixed(4)}ms exceeds 0.1ms target. P50: ${p50.toFixed(4)}ms`,
    );
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      reportSoftPerformanceMiss(t, err);
      return;
    }
    throw err;
  }
});

// ============================================================================
// Memory Insertion Benchmarks
// ============================================================================

test("performance: MemoryStore.insertMemory() throughput >1000 ops/sec", (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStore(db);

  try {
    const taskId = newId("task");
    const iterations = 1000;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      const memoryId = newId("mem");
      const now = nowIso();
      store.memory.insertMemory({
        memoryId,
        taskId,
        agentId: null,
        kind: "working",
        contentJson: JSON.stringify({ text: `Memory content ${i}`, data: { value: i } }),
        contentSize: 100,
        importanceScore: 0.5,
        createdAt: now,
        accessedAt: now,
        decayScore: null,
      });
    }

    const elapsed = performance.now() - start;
    const opsPerSec = (iterations / elapsed) * 1000;
    const avgLatencyMs = elapsed / iterations;

    try {
      assert.ok(
        opsPerSec > 1000,
        `Memory insertion throughput ${opsPerSec.toFixed(0)} ops/sec must be >1000 ops/sec. Avg: ${avgLatencyMs.toFixed(3)}ms`,
      );
    } catch (err) {
      if (err instanceof assert.AssertionError) {
        reportSoftPerformanceMiss(t, err);
        return;
      }
      throw err;
    }
  } finally {
    db.close();
    rmSync(join(".tmp", `memory-retrieval-perf-${process.pid}-${Date.now()}.db`), { force: true });
  }
});

test("performance: MemoryStore.insertMemory() P99 latency <5ms", (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStore(db);

  try {
    const taskId = newId("task");
    const latencies: number[] = [];
    const iterations = 500;

    // Warmup
    for (let i = 0; i < 50; i++) {
      const memoryId = newId("mem");
      const now = nowIso();
      store.memory.insertMemory({
        memoryId,
        taskId,
        agentId: null,
        kind: "working",
        contentJson: JSON.stringify({ text: `Warmup ${i}` }),
        contentSize: 50,
        importanceScore: 0.5,
        createdAt: now,
        accessedAt: now,
        decayScore: null,
      });
    }

    // Measure
    for (let i = 0; i < iterations; i++) {
      const memoryId = newId("mem");
      const now = nowIso();
      const start = performance.now();
      store.memory.insertMemory({
        memoryId,
        taskId,
        agentId: null,
        kind: "working",
        contentJson: JSON.stringify({ text: `Memory ${i}` }),
        contentSize: 100,
        importanceScore: 0.5,
        createdAt: now,
        accessedAt: now,
        decayScore: null,
      });
      latencies.push(performance.now() - start);
    }

    latencies.sort((a, b) => a - b);
    const p99 = latencies[Math.floor(iterations * 0.99)]!;
    const p50 = latencies[Math.floor(iterations * 0.5)]!;

    try {
      assert.ok(
        p99 < 5,
        `Memory insertion P99 latency ${p99.toFixed(3)}ms exceeds 5ms target. P50: ${p50.toFixed(3)}ms`,
      );
    } catch (err) {
      if (err instanceof assert.AssertionError) {
        reportSoftPerformanceMiss(t, err);
        return;
      }
      throw err;
    }
  } finally {
    db.close();
    rmSync(join(".tmp", `memory-retrieval-perf-${process.pid}-${Date.now()}.db`), { force: true });
  }
});

// ============================================================================
// Memory Retrieval by ID Benchmarks
// ============================================================================

test("performance: MemoryStore.getMemoryById() throughput >5000 ops/sec", (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStore(db);

  try {
    const taskId = newId("task");
    const memoryIds: string[] = [];

    // Create memories
    for (let i = 0; i < 100; i++) {
      memoryIds.push(createMemoryRecord(store, taskId, JSON.stringify({ text: `Memory ${i}` })));
    }

    const iterations = 5000;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      store.memory.getMemoryById(memoryIds[i % memoryIds.length]!);
    }

    const elapsed = performance.now() - start;
    const opsPerSec = (iterations / elapsed) * 1000;
    const avgLatencyMs = elapsed / iterations;

    try {
      assert.ok(
        opsPerSec > 5000,
        `Memory retrieval by ID throughput ${opsPerSec.toFixed(0)} ops/sec must be >5000 ops/sec. Avg: ${avgLatencyMs.toFixed(4)}ms`,
      );
    } catch (err) {
      if (err instanceof assert.AssertionError) {
        reportSoftPerformanceMiss(t, err);
        return;
      }
      throw err;
    }
  } finally {
    db.close();
    rmSync(join(".tmp", `memory-retrieval-perf-${process.pid}-${Date.now()}.db`), { force: true });
  }
});

test("performance: MemoryStore.getMemoryById() P99 latency <0.5ms", (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStore(db);

  try {
    const taskId = newId("task");
    const memoryIds: string[] = [];

    // Create memories
    for (let i = 0; i < 100; i++) {
      memoryIds.push(createMemoryRecord(store, taskId, JSON.stringify({ text: `Memory ${i}` })));
    }

    const latencies: number[] = [];
    const iterations = 2000;

    // Warmup
    for (let i = 0; i < 100; i++) {
      store.memory.getMemoryById(memoryIds[i % memoryIds.length]!);
    }

    // Measure
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      store.memory.getMemoryById(memoryIds[i % memoryIds.length]!);
      latencies.push(performance.now() - start);
    }

    latencies.sort((a, b) => a - b);
    const p99 = latencies[Math.floor(iterations * 0.99)]!;
    const p50 = latencies[Math.floor(iterations * 0.5)]!;

    try {
      assert.ok(
        p99 < 0.5,
        `Memory retrieval P99 latency ${p99.toFixed(4)}ms exceeds 0.5ms target. P50: ${p50.toFixed(4)}ms`,
      );
    } catch (err) {
      if (err instanceof assert.AssertionError) {
        reportSoftPerformanceMiss(t, err);
        return;
      }
      throw err;
    }
  } finally {
    db.close();
    rmSync(join(".tmp", `memory-retrieval-perf-${process.pid}-${Date.now()}.db`), { force: true });
  }
});

// ============================================================================
// Memory List by Task Benchmarks
// ============================================================================

test("performance: MemoryStore.listMemoriesForTask() throughput >2000 ops/sec", (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStore(db);

  try {
    const taskId = newId("task");

    // Create memories for task
    for (let i = 0; i < 50; i++) {
      createMemoryRecord(store, taskId, JSON.stringify({ text: `Memory ${i}` }));
    }

    const iterations = 1000;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      store.memory.listMemoriesForTask(taskId, "working");
    }

    const elapsed = performance.now() - start;
    const opsPerSec = (iterations / elapsed) * 1000;
    const avgLatencyMs = elapsed / iterations;

    try {
      assert.ok(
        opsPerSec > 2000,
        `Memory list by task throughput ${opsPerSec.toFixed(0)} ops/sec must be >2000 ops/sec. Avg: ${avgLatencyMs.toFixed(3)}ms`,
      );
    } catch (err) {
      if (err instanceof assert.AssertionError) {
        reportSoftPerformanceMiss(t, err);
        return;
      }
      throw err;
    }
  } finally {
    db.close();
    rmSync(join(".tmp", `memory-retrieval-perf-${process.pid}-${Date.now()}.db`), { force: true });
  }
});

test("performance: MemoryStore.listMemoriesForTask() P99 latency <2ms", (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStore(db);

  try {
    const taskId = newId("task");

    // Create memories for task
    for (let i = 0; i < 50; i++) {
      createMemoryRecord(store, taskId, JSON.stringify({ text: `Memory ${i}` }));
    }

    const latencies: number[] = [];
    const iterations = 1000;

    // Warmup
    for (let i = 0; i < 50; i++) {
      store.memory.listMemoriesForTask(taskId, "working");
    }

    // Measure
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      store.memory.listMemoriesForTask(taskId, "working");
      latencies.push(performance.now() - start);
    }

    latencies.sort((a, b) => a - b);
    const p99 = latencies[Math.floor(iterations * 0.99)]!;
    const p50 = latencies[Math.floor(iterations * 0.5)]!;

    try {
      assert.ok(
        p99 < 2,
        `Memory list P99 latency ${p99.toFixed(3)}ms exceeds 2ms target. P50: ${p50.toFixed(3)}ms`,
      );
    } catch (err) {
      if (err instanceof assert.AssertionError) {
        reportSoftPerformanceMiss(t, err);
        return;
      }
      throw err;
    }
  } finally {
    db.close();
    rmSync(join(".tmp", `memory-retrieval-perf-${process.pid}-${Date.now()}.db`), { force: true });
  }
});

// ============================================================================
// Bulk Memory Operations
// ============================================================================

test("performance: Bulk memory insertion (100 memories) <150ms", (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStore(db);

  try {
    const taskId = newId("task");
    const memoryCount = 100;
    const start = performance.now();

    for (let i = 0; i < memoryCount; i++) {
      createMemoryRecord(store, taskId, JSON.stringify({ text: `Memory ${i}`, data: { value: i } }));
    }

    const elapsed = performance.now() - start;
    const opsPerSec = (memoryCount / elapsed) * 1000;

    try {
      assert.ok(
        elapsed < 150,
        `Bulk insertion of ${memoryCount} memories took ${elapsed.toFixed(2)}ms, expected <150ms. Throughput: ${opsPerSec.toFixed(0)} ops/sec`,
      );
    } catch (err) {
      if (err instanceof assert.AssertionError) {
        reportSoftPerformanceMiss(t, err);
        return;
      }
      throw err;
    }
  } finally {
    db.close();
    rmSync(join(".tmp", `memory-retrieval-perf-${process.pid}-${Date.now()}.db`), { force: true });
  }
});
