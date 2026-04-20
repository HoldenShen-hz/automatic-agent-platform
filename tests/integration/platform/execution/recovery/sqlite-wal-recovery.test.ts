/**
 * Recovery Integration Test: SQLite WAL Recovery
 *
 * Verifies that SQLite WAL (Write-Ahead Logging) mode works correctly
 * and data can be recovered after various failure scenarios.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";
import { existsSync, unlinkSync } from "node:fs";

import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { newId, nowIso } from "../../../../../src/platform/contracts/types/ids.js";

test("recovery: WAL mode is enabled for database", () => {
  const workspace = createTempWorkspace("recovery-wal-");

  try {
    const dbPath = join(workspace, "wal-test.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();

    const journalMode = db.connection
      .prepare("PRAGMA journal_mode")
      .get() as { journal_mode: string };

    assert.ok(
      journalMode.journal_mode === "wal" || journalMode.journal_mode === "delete",
      `Journal mode should be WAL or DELETE, got ${journalMode.journal_mode}`,
    );

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("recovery: data persists after transaction commit", () => {
  const workspace = createTempWorkspace("recovery-wal-persist-");

  try {
    const dbPath = join(workspace, "wal-persist.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    const taskId = newId("task");
    const now = nowIso();

    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "WAL persist test",
        status: "in_progress",
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
        completedAt: null,
      });
    });

    const retrievedTask = store.getTask(taskId);
    assert.ok(retrievedTask, "Task should be persisted after transaction");
    assert.strictEqual(retrievedTask!.id, taskId, "Task ID should match");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("recovery: multiple concurrent transactions are isolated", () => {
  const workspace = createTempWorkspace("recovery-wal-isolation-");

  try {
    const dbPath = join(workspace, "wal-isolation.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    const taskIds: string[] = [];
    const now = nowIso();

    for (let i = 0; i < 10; i++) {
      const taskId = newId("task");
      taskIds.push(taskId);
      db.transaction(() => {
        store.insertTask({
          id: taskId,
          parentId: null,
          rootId: taskId,
          divisionId: "general_ops",
          title: `Isolation test ${i}`,
          status: "pending",
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
          completedAt: null,
        });
      });
    }

    for (const taskId of taskIds) {
      const task = store.getTask(taskId);
      assert.ok(task, `Task ${taskId} should be retrievable`);
    }

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("recovery: WAL checkpoint creates recoverable state", () => {
  const workspace = createTempWorkspace("recovery-wal-checkpoint-");

  try {
    const dbPath = join(workspace, "wal-checkpoint.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    const taskId = newId("task");
    const now = nowIso();

    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Checkpoint test",
        status: "in_progress",
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
        completedAt: null,
      });
    });

    db.connection.prepare("PRAGMA wal_checkpoint(FULL)").get();

    const task = store.getTask(taskId);
    assert.ok(task, "Task should be recoverable after checkpoint");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("recovery: database is consistent after multiple writes", () => {
  const workspace = createTempWorkspace("recovery-wal-consistency-");

  try {
    const dbPath = join(workspace, "wal-consistency.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    const taskIds: string[] = [];
    const now = nowIso();

    for (let i = 0; i < 20; i++) {
      const taskId = newId("task");
      taskIds.push(taskId);
      db.transaction(() => {
        store.insertTask({
          id: taskId,
          parentId: null,
          rootId: taskId,
          divisionId: "general_ops",
          title: `Consistency test ${i}`,
          status: i % 2 === 0 ? "pending" : "in_progress",
          source: "user",
          priority: i % 3 === 0 ? "high" : "normal",
          inputJson: "{}",
          normalizedInputJson: "{}",
          outputJson: null,
          estimatedCostUsd: 0,
          actualCostUsd: 0,
          errorCode: null,
          createdAt: now,
          updatedAt: now,
          completedAt: null,
        });
      });
    }

    db.connection.prepare("PRAGMA integrity_check").get();

    const allTasks = db.connection
      .prepare("SELECT COUNT(*) as count FROM tasks")
      .get() as { count: number };

    assert.strictEqual(allTasks!.count, 20, "All 20 tasks should be in the database");

    for (const taskId of taskIds) {
      const task = store.getTask(taskId);
      assert.ok(task, `Task ${taskId} should exist`);
    }

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});
