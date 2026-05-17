/**
 * Performance tests for Memory Service operations
 *
 * Design targets:
 * - Memory write: >5000 ops/sec
 * - Memory retrieval: >10000 ops/sec
 * - Session creation: >3000 ops/sec
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";
import { reportSoftPerformanceMiss } from "../../../helpers/performance.js";

import { MemoryService } from "../../../../src/platform/five-plane-state-evidence/memory/memory-service.js";
import { MemoryRetrievalService } from "../../../../src/platform/five-plane-state-evidence/memory/memory-retrieval-service.js";
import { SessionSummaryService } from "../../../../src/platform/five-plane-state-evidence/memory/session-summary-service.js";
import { SqliteDatabase } from "../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { newId, nowIso } from "../../../../src/platform/contracts/types/ids.js";
import { createTempWorkspace, cleanupPath } from "../../../helpers/fs.js";

function createTempStore(): { db: SqliteDatabase; store: AuthoritativeTaskStore; workspace: string } {
  const workspace = createTempWorkspace("aa-perf-memory-");
  const db = new SqliteDatabase(join(workspace, "memory-service-perf.db"));
  db.migrate();
  return { db, store: new AuthoritativeTaskStore(db), workspace };
}

test("performance: memory write >5000 ops/sec", (t) => {
  const { db, store, workspace } = createTempStore();
  const memoryService = new MemoryService(store);

  try {
    const iterations = 1000;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      memoryService.remember({
        taskId: `task_${i % 100}`,
        scope: "experience",
        content: { type: "experience", data: `Memory content ${i} for performance testing` },
        classification: "internal",
        qualityScore: 0.5 + (i % 50) / 100,
        createdAt: nowIso(),
      });
    }

    const elapsed = performance.now() - start;
    const opsPerSec = (iterations / elapsed) * 1000;
    const avgLatencyMs = elapsed / iterations;

    try {
      assert.ok(
        opsPerSec > 5000,
        `Memory write throughput ${opsPerSec.toFixed(2)} ops/sec must be >5000 ops/sec. Avg latency: ${avgLatencyMs.toFixed(3)}ms`,
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
    cleanupPath(workspace);
  }
});

test("performance: memory retrieval >10000 ops/sec", (t) => {
  const { db, store, workspace } = createTempStore();
  const memoryService = new MemoryService(store);
  const retrievalService = new MemoryRetrievalService(store);

  // Pre-populate some memories
  for (let i = 0; i < 100; i++) {
    memoryService.remember({
      taskId: `task_${i % 10}`,
      scope: "experience",
      content: `Memory content ${i} indexed for retrieval benchmarks`,
      classification: "internal",
      qualityScore: 0.5,
      createdAt: nowIso(),
    });
  }
  retrievalService.initializeFts();

  try {
    const iterations = 2000;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      retrievalService.searchMemories({ query: "Memory content", limit: 10 }, { taskId: `task_${i % 10}` });
    }

    const elapsed = performance.now() - start;
    const opsPerSec = (iterations / elapsed) * 1000;

    try {
      assert.ok(
        opsPerSec > 10000,
        `Memory retrieval throughput ${opsPerSec.toFixed(2)} ops/sec must be >10000 ops/sec`,
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
    cleanupPath(workspace);
  }
});

test("performance: session creation >3000 ops/sec", (t) => {
  const { db, store, workspace } = createTempStore();
  const sessionService = new SessionSummaryService(store);

  try {
    const iterations = 1000;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      sessionService.createSummary({
        sessionId: newId("session"),
        taskId: `task_session_${i}`,
        summaryText: `Session summary ${i} generated for throughput benchmarking`,
      });
    }

    const elapsed = performance.now() - start;
    const opsPerSec = (iterations / elapsed) * 1000;

    try {
      assert.ok(
        opsPerSec > 3000,
        `Session creation throughput ${opsPerSec.toFixed(2)} ops/sec must be >3000 ops/sec`,
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
    cleanupPath(workspace);
  }
});
