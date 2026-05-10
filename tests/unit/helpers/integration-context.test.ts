/**
 * Unit tests for tests/helpers/integration-context.ts
 */

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import {
  createTempWorkspace,
  cleanupPath,
} from "../../helpers/fs.js";
import {
  createIntegrationContext,
  createSeededIntegrationContext,
} from "../../helpers/integration-context.js";

describe("integration-context", () => {
  describe("createIntegrationContext", () => {
    it("should create a workspace directory", () => {
      const ctx = createIntegrationContext("integration-test-");
      try {
        assert.ok(existsSync(ctx.workspace), "workspace should exist");
        assert.ok(ctx.workspace.includes("integration-test-"), "workspace should have prefix");
      } finally {
        ctx.cleanup();
      }
    });

    it("should create a database file at dbPath", () => {
      const ctx = createIntegrationContext("integration-db-");
      try {
        assert.ok(existsSync(ctx.dbPath), "dbPath should exist");
        assert.ok(ctx.dbPath.endsWith(".db"), "dbPath should be a .db file");
      } finally {
        ctx.cleanup();
      }
    });

    it("should return a connected database instance", () => {
      const ctx = createIntegrationContext("integration-connected-");
      try {
        assert.ok(ctx.db, "db should be defined");
      } finally {
        ctx.cleanup();
      }
    });

    it("should have an AuthoritativeTaskStore instance", () => {
      const ctx = createIntegrationContext("integration-store-");
      try {
        assert.ok(ctx.store, "store should be defined");
        // Verify store works
        const tasks = ctx.store.listTasks(10);
        assert.ok(Array.isArray(tasks));
      } finally {
        ctx.cleanup();
      }
    });

    it("should cleanup remove workspace", () => {
      const ctx = createIntegrationContext("integration-cleanup-");
      const workspace = ctx.workspace;
      ctx.cleanup();
      assert.ok(!existsSync(workspace), "workspace should be removed after cleanup");
    });

    it("should use custom prefix", () => {
      const ctx = createIntegrationContext("my-integration-");
      try {
        assert.ok(ctx.workspace.includes("my-integration-"));
      } finally {
        ctx.cleanup();
      }
    });

    it("should allow multiple contexts with unique workspaces", () => {
      const ctx1 = createIntegrationContext("multi-1-");
      const ctx2 = createIntegrationContext("multi-2-");
      try {
        assert.notStrictEqual(ctx1.workspace, ctx2.workspace);
        assert.ok(existsSync(ctx1.workspace));
        assert.ok(existsSync(ctx2.workspace));
      } finally {
        ctx1.cleanup();
        ctx2.cleanup();
      }
    });
  });

  describe("createSeededIntegrationContext", () => {
    function findTaskById(store: AuthoritativeTaskStore, taskId: string) {
      const tasks = store.listTasks(100);
      return tasks.find(t => t.id === taskId) ?? null;
    }

    it("should create a context with seeded task and execution", () => {
      const ctx = createSeededIntegrationContext("seeded-ctx-");
      try {
        assert.ok(ctx.store, "store should be defined");
        // Should have seeded task
        const tasks = ctx.store.listTasks(10);
        assert.ok(tasks.length > 0, "should have seeded tasks");
      } finally {
        ctx.cleanup();
      }
    });

    it("should use default taskId when not provided", () => {
      const ctx = createSeededIntegrationContext("seeded-default-");
      try {
        const task = findTaskById(ctx.store, "task-seeded-001");
        assert.ok(task, "task with default id should exist");
        assert.strictEqual(task.title, "Seeded task");
      } finally {
        ctx.cleanup();
      }
    });

    it("should use default executionId when not provided", () => {
      const ctx = createSeededIntegrationContext("seeded-exec-");
      try {
        const executions = ctx.store.listExecutionsByTask("task-seeded-001");
        assert.strictEqual(executions.length, 1);
        const exec = executions[0];
        assert.ok(exec, "execution should exist");
        assert.strictEqual(exec.id, "exec-seeded-001");
      } finally {
        ctx.cleanup();
      }
    });

    it("should allow custom taskId and executionId", () => {
      const ctx = createSeededIntegrationContext("seeded-custom-", {
        taskId: "custom-task-id",
        executionId: "custom-exec-id",
      });
      try {
        const task = findTaskById(ctx.store, "custom-task-id");
        assert.ok(task, "custom task should exist");
        const executions = ctx.store.listExecutionsByTask("custom-task-id");
        assert.strictEqual(executions.length, 1);
        const exec = executions[0];
        assert.ok(exec, "execution should exist");
        assert.strictEqual(exec.id, "custom-exec-id");
      } finally {
        ctx.cleanup();
      }
    });

    it("should create seeded task with in_progress status", () => {
      const ctx = createSeededIntegrationContext("seeded-status-");
      try {
        const task = findTaskById(ctx.store, "task-seeded-001");
        assert.ok(task, "task should exist");
        assert.strictEqual(task.status, "in_progress");
      } finally {
        ctx.cleanup();
      }
    });

    it("should create seeded execution with executing status", () => {
      const ctx = createSeededIntegrationContext("seeded-exec-status-");
      try {
        const executions = ctx.store.listExecutionsByTask("task-seeded-001");
        const exec = executions[0];
        assert.ok(exec, "execution should exist");
        assert.strictEqual(exec.status, "executing");
      } finally {
        ctx.cleanup();
      }
    });

    it("should link seeded execution to task via taskId", () => {
      const ctx = createSeededIntegrationContext("seeded-link-");
      try {
        const executions = ctx.store.listExecutionsByTask("task-seeded-001");
        const exec = executions[0];
        assert.ok(exec, "execution should exist");
        assert.strictEqual(exec.taskId, "task-seeded-001");
      } finally {
        ctx.cleanup();
      }
    });

    it("should set seeded execution traceId with prefix", () => {
      const ctx = createSeededIntegrationContext("seeded-trace-");
      try {
        const executions = ctx.store.listExecutionsByTask("task-seeded-001");
        const exec = executions[0];
        assert.ok(exec, "execution should exist");
        assert.ok(exec.traceId.startsWith("trace-"), "traceId should start with trace-");
      } finally {
        ctx.cleanup();
      }
    });

    it("should cleanup remove workspace", () => {
      const ctx = createSeededIntegrationContext("seeded-cleanup-");
      const workspace = ctx.workspace;
      ctx.cleanup();
      assert.ok(!existsSync(workspace), "workspace should be removed after cleanup");
    });
  });
});

// Import for type only
import type { AuthoritativeTaskStore } from "../../../src/platform/state-evidence/truth/authoritative-task-store.js";