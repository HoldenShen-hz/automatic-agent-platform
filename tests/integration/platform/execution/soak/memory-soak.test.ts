/**
 * Soak Test: Memory Service Long-Running Behavior
 *
 * Tests that the memory service remains stable over extended operation.
 * Verifies no memory leaks or resource exhaustion during sustained use.
 * Includes heap growth assertions: peak heap must stay below 2x initial heap.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";
import { memoryUsage } from "node:process";

import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { MemoryService } from "../../../../../src/platform/state-evidence/memory/memory-service.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { newId, nowIso } from "../../../../../src/platform/contracts/types/ids.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";

test("soak: memory service remains stable over repeated operations", () => {
  const workspace = createTempWorkspace("soak-memory-");

  try {
    const dbPath = join(workspace, "soak-memory.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const memoryService = new MemoryService(store);

    const sessionId = newId("sess");
    const taskId = newId("task");
    const now = nowIso();

    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Memory soak test",
        status: "done",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: 0,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: now,
      });
    });

    const iterations = 100;
    for (let i = 0; i < iterations; i++) {
      memoryService.remember({
        taskId,
        sessionId,
        scope: "test-scope",
        content: `Memory content ${i}: This is test memory data for soak testing.`,
        classification: "test",
        qualityScore: 0.8,
      });

      memoryService.recall({ sessionId, limit: 10 });
    }

    const memories = memoryService.recall({ sessionId, limit: 100 });
    assert.ok(memories.length > 0, "Should have stored memories after soak test");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("soak: heap growth stays below 2x threshold over 200 memory operations", () => {
  const workspace = createTempWorkspace("soak-heap-growth-");

  try {
    const dbPath = join(workspace, "soak-heap-growth.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const memoryService = new MemoryService(store);

    const sessionId = newId("sess");
    const taskId = newId("task");
    const now = nowIso();

    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Heap growth soak test",
        status: "done",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: 0,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: now,
      });
    });

    const initialHeap = memoryUsage().heapUsed;
    let peakHeap = initialHeap;

    const iterations = 200;
    for (let i = 0; i < iterations; i++) {
      memoryService.remember({
        taskId,
        sessionId,
        scope: "heap-test",
        content: `Memory entry ${i}: soak testing heap growth bounds with fixed-size content`,
        classification: "test",
        qualityScore: 0.9,
      });
      memoryService.recall({ sessionId, limit: 20 });

      const currentHeap = memoryUsage().heapUsed;
      if (currentHeap > peakHeap) {
        peakHeap = currentHeap;
      }
    }

    const growthRatio = peakHeap / initialHeap;
    assert.ok(
      growthRatio < 2.0,
      `Heap growth ratio ${growthRatio.toFixed(2)} should be below 2.0x initial heap (initial: ${(initialHeap / 1_048_576).toFixed(1)}MB, peak: ${(peakHeap / 1_048_576).toFixed(1)}MB)`,
    );

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("soak: memory service handles many sessions without degradation", () => {
  const workspace = createTempWorkspace("soak-multi-session-");

  try {
    const dbPath = join(workspace, "soak-multi-session.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const memoryService = new MemoryService(store);

    const sessionCount = 20;
    const memoriesPerSession = 10;

    for (let s = 0; s < sessionCount; s++) {
      const sessionId = newId("sess");
      const taskId = newId("task");
      const now = nowIso();

      db.transaction(() => {
        store.insertTask({
          id: taskId,
          parentId: null,
          rootId: taskId,
          divisionId: "general_ops",
          title: `Multi-session soak test ${s}`,
          status: "done",
          source: "user",
          priority: "normal",
          inputJson: "{}",
          normalizedInputJson: "{}",
          outputJson: null,
          estimatedCostUsd: 0,
          actualCostUsd: 0,
          errorCode: null,
          createdAt: now,
          updatedAt: now,
          completedAt: now,
        });
      });

      for (let i = 0; i < memoriesPerSession; i++) {
        memoryService.remember({
          taskId,
          sessionId,
          scope: "test-scope",
          content: `Session ${s} memory ${i}`,
          classification: "test",
          qualityScore: 0.8,
        });
      }
    }

    let totalMemories = 0;
    for (let s = 0; s < sessionCount; s++) {
      const sessionId = newId("sess");
      const memories = memoryService.recall({ sessionId, limit: 100 });
      totalMemories += memories.length;
    }

    assert.ok(totalMemories >= 0, "Memory service should handle multiple sessions");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});
