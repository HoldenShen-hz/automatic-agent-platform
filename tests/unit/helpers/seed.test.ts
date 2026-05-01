/**
 * Unit tests for tests/helpers/seed.ts
 */

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import {
  createTempWorkspace,
  cleanupPath,
  createFile,
} from "../../helpers/fs.js";
import { SqliteDatabase } from "../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { seedTaskAndExecution, seedQueuedTasks } from "../../helpers/seed.js";

describe("seed helpers", () => {
  let workspace: string;
  let db: SqliteDatabase;
  let store: AuthoritativeTaskStore;

  beforeEach(() => {
    workspace = createTempWorkspace("seed-test-");
    const dbPath = join(workspace, "seed-test.db");
    db = new SqliteDatabase(dbPath);
    db.migrate();
    store = new AuthoritativeTaskStore(db);
  });

  afterEach(() => {
    try {
      db.close();
    } finally {
      cleanupPath(workspace);
    }
  });

  function findTaskById(store: AuthoritativeTaskStore, taskId: string) {
    const tasks = store.listTasks(100);
    return tasks.find(t => t.id === taskId) ?? null;
  }

  describe("seedTaskAndExecution", () => {
    it("should insert a task with in_progress status", () => {
      seedTaskAndExecution(db, store, {
        taskId: "task-seed-001",
        executionId: "exec-seed-001",
      });

      const task = findTaskById(store, "task-seed-001");
      assert.ok(task, "task should be inserted");
      assert.strictEqual(task.id, "task-seed-001");
      assert.strictEqual(task.status, "in_progress");
      assert.strictEqual(task.title, "Seed task");
    });

    it("should insert an execution linked to the task", () => {
      seedTaskAndExecution(db, store, {
        taskId: "task-seed-002",
        executionId: "exec-seed-002",
        traceId: "custom-trace-002",
      });

      const executions = store.listExecutionsByTask("task-seed-002");
      assert.strictEqual(executions.length, 1);
      assert.strictEqual(executions[0].id, "exec-seed-002");
      assert.strictEqual(executions[0].taskId, "task-seed-002");
      assert.strictEqual(executions[0].traceId, "custom-trace-002");
    });

    it("should use default traceId when not provided", () => {
      seedTaskAndExecution(db, store, {
        taskId: "task-seed-003",
        executionId: "exec-seed-003",
      });

      const executions = store.listExecutionsByTask("task-seed-003");
      assert.strictEqual(executions[0].traceId, "trace-seed");
    });

    it("should set execution to executing status", () => {
      seedTaskAndExecution(db, store, {
        taskId: "task-seed-004",
        executionId: "exec-seed-004",
      });

      const executions = store.listExecutionsByTask("task-seed-004");
      assert.strictEqual(executions[0].status, "executing");
    });

    it("should set task divisionId to general_ops", () => {
      seedTaskAndExecution(db, store, {
        taskId: "task-seed-005",
        executionId: "exec-seed-005",
      });

      const task = findTaskById(store, "task-seed-005");
      assert.strictEqual(task.divisionId, "general_ops");
    });

    it("should handle multiple seed calls", () => {
      seedTaskAndExecution(db, store, {
        taskId: "task-multi-1",
        executionId: "exec-multi-1",
      });
      seedTaskAndExecution(db, store, {
        taskId: "task-multi-2",
        executionId: "exec-multi-2",
      });

      const tasks = store.listTasks(10);
      assert.ok(tasks.length >= 2);
    });
  });

  describe("seedQueuedTasks", () => {
    it("should insert multiple tasks with queued status", () => {
      seedQueuedTasks(db, store, { count: 5, prefix: "queued-test" });

      const tasks = store.listTasks(10);
      const queuedTasks = tasks.filter((t) => t.id.startsWith("queued-test-"));
      assert.strictEqual(queuedTasks.length, 5);
    });

    it("should set all tasks to queued status", () => {
      seedQueuedTasks(db, store, { count: 3, prefix: "status-test" });

      const tasks = store.listTasks(10);
      const seededTasks = tasks.filter((t) => t.id.startsWith("status-test-"));
      for (const task of seededTasks) {
        assert.strictEqual(task.status, "queued", `task ${task.id} should be queued`);
      }
    });

    it("should use default prefix when not provided", () => {
      seedQueuedTasks(db, store, { count: 3 });

      const tasks = store.listTasks(10);
      const defaultPrefixTasks = tasks.filter((t) => t.id.startsWith("seed-queued-"));
      assert.strictEqual(defaultPrefixTasks.length, 3);
    });

    it("should name tasks with sequential indices", () => {
      seedQueuedTasks(db, store, { count: 3, prefix: "seq-test" });

      const tasks = store.listTasks(10);
      const seqTasks = tasks.filter((t) => t.id.startsWith("seq-test-")).sort((a, b) => a.id.localeCompare(b.id));
      assert.strictEqual(seqTasks[0].id, "seq-test-1");
      assert.strictEqual(seqTasks[1].id, "seq-test-2");
      assert.strictEqual(seqTasks[2].id, "seq-test-3");
    });

    it("should handle count of 1", () => {
      seedQueuedTasks(db, store, { count: 1, prefix: "single-test" });

      const tasks = store.listTasks(5);
      const singleTasks = tasks.filter((t) => t.id.startsWith("single-test-"));
      assert.strictEqual(singleTasks.length, 1);
    });

    it("should handle empty prefix with count", () => {
      seedQueuedTasks(db, store, { count: 2 });

      const tasks = store.listTasks(5);
      const seededTasks = tasks.filter((t) => t.id.startsWith("seed-queued-"));
      assert.strictEqual(seededTasks.length, 2);
    });
  });
});